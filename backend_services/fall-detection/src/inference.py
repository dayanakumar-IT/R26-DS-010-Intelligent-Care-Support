"""
Live inference engine.

Supports three source modes:
    webcam   — OpenCV VideoCapture(index) from Hikvision USB camera
    video    — pre-recorded .mp4 / .avi file
    skeleton — saved (N, 14, 4) .npy skeleton sequence (no MediaPipe needed)

Pipeline per frame
------------------
frame → MediaPipe → (14,4) joint matrix
                 → 90-frame ring buffer
                 → every INFER_EVERY_N frames:
                       apply_clip_normalization
                       enforce_temporal_uniformity
                       feature extraction
                       ST-GCN + feature classifier + fusion
                       → InferenceResult

Usage
-----
    engine = InferenceEngine(source=0)          # webcam index 0
    engine = InferenceEngine(source="clip.mp4") # video file
    engine.load_models()
    engine.start()
    for result in engine.results():
        print(result.risk_score, result.pose_quality)
    engine.stop()
"""
from __future__ import annotations

import os
import sys
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Iterator, List, Optional, Union

import cv2
import numpy as np

# Suppress OpenCV/MSMF verbose warnings — they appear even when DSHOW is used
cv2.setLogLevel(3)   # 3 = ERROR only (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR, 4=FATAL)
import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    MODELS_DIR, TARGET_FRAMES, NUM_JOINTS, FRAME_RATE,
)
from src.data_processor import DataProcessor
from src.features import FeatureExtractor
from src.models.stgcn import SkeletalSTGCN
from src.models.classifier import FeatureClassifier
from src.models.fusion import LateFusionNetwork
from src.data_splits import load_scaler

# Run model inference every N captured frames (≈5 inferences/sec at 30 FPS)
INFER_EVERY_N = 3
# Minimum fraction of buffer that must have valid joints before inference fires
MIN_BUFFER_FILL = 0.3      # was 0.5 — fire sooner, don't wait for full 45 frames
# Per-joint visibility threshold — lower = more joints count as "visible"
VIS_THRESH = 0.2           # was 0.4 — laptop webcam gives lower visibility scores
# Fraction of joints that must be visible for GOOD / DEGRADED quality
GOOD_JOINT_FRAC     = 0.65 # was 0.85 — partial body view still scores GOOD
DEGRADED_JOINT_FRAC = 0.35 # was 0.5  — partial body view is DEGRADED not UNAVAILABLE


@dataclass
class InferenceResult:
    timestamp:    float
    risk_score:   float          # fusion fall probability 0..1
    stgcn_score:  float
    feat_score:   float
    pose_quality: str            # GOOD | DEGRADED | UNAVAILABLE
    skeleton:     List[List[float]]   # (14, 4) as nested list for JSON
    key_factors:  List[str]      # top contributing feature names
    frame_count:  int


class InferenceEngine:
    def __init__(
        self,
        source: Union[int, str] = 0,
        suffix: str = "",
        device: Optional[torch.device] = None,
        patient_id: str = "P001",
        room_id:    str = "ROOM_01",
    ):
        self.source     = source
        self.suffix     = suffix
        self.patient_id = patient_id
        self.room_id    = room_id
        self.device     = device or torch.device(
            "cuda" if torch.cuda.is_available() else "cpu")

        self._buffer: Deque[np.ndarray] = deque(maxlen=TARGET_FRAMES)
        self._result_queue: deque       = deque(maxlen=30)
        self._running = False
        self._thread:  Optional[threading.Thread] = None
        self._frame_count = 0

        # MJPEG stream state — updated every frame
        self._latest_frame_bytes: Optional[bytes] = None
        self._latest_skeleton: Optional[np.ndarray] = None   # (14,4) raw MediaPipe frame
        self._disp_level    = "NORMAL"
        self._disp_score    = 0.0
        self._disp_posture  = "UNKNOWN"
        self._disp_buffering = True

        self._dp    = DataProcessor()
        self._feat  = FeatureExtractor()
        self._scaler = None
        self._stgcn:  Optional[SkeletalSTGCN]       = None
        self._fusion: Optional[LateFusionNetwork]   = None
        self._clf:    Optional[FeatureClassifier]   = None
        self._pose    = None   # MediaPipe Pose handle

    # ------------------------------------------------------------------ #
    def load_models(self):
        self._scaler = load_scaler(self.suffix)

        self._stgcn = SkeletalSTGCN().to(self.device).eval()
        self._stgcn.load_state_dict(torch.load(
            os.path.join(MODELS_DIR, f"stgcn_best{self.suffix}.pth"),
            map_location=self.device, weights_only=True))

        self._fusion = LateFusionNetwork().to(self.device).eval()
        self._fusion.load_state_dict(torch.load(
            os.path.join(MODELS_DIR, f"fusion_best{self.suffix}.pth"),
            map_location=self.device, weights_only=True))

        clf_path = os.path.join(MODELS_DIR, f"classifier_best{self.suffix}.pth")
        if os.path.exists(clf_path):
            self._clf = FeatureClassifier().to(self.device).eval()
            self._clf.load_state_dict(torch.load(
                clf_path, map_location=self.device, weights_only=True))

        print(f"[inference] Models loaded. Device: {self.device}")

    # ------------------------------------------------------------------ #
    def start(self):
        if self._running:
            return
        self._running = True
        self._thread  = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)

    def results(self) -> Iterator[InferenceResult]:
        """Yield inference results as they arrive."""
        while self._running or self._result_queue:
            if self._result_queue:
                yield self._result_queue.popleft()
            else:
                time.sleep(0.01)

    # ------------------------------------------------------------------ #
    def _run_loop(self):
        if isinstance(self.source, str) and self.source.endswith(".npy"):
            self._run_skeleton_source()
            return

        import mediapipe as mp
        with mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as pose:
            self._pose = pose
            # On Windows, MSMF (default backend) often fails with -1072873821.
            # Force DirectShow which is more compatible with USB webcams.
            if isinstance(self.source, int):
                cap = cv2.VideoCapture(self.source, cv2.CAP_DSHOW)
            else:
                cap = cv2.VideoCapture(self.source)

            if not cap.isOpened():
                print(f"[inference] Cannot open source: {self.source}")
                self._running = False
                return

            # Request MJPEG + manageable resolution for USB camera via DSHOW
            if isinstance(self.source, int):
                cap.set(cv2.CAP_PROP_FOURCC,
                        cv2.VideoWriter_fourcc(*"MJPG"))
                cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                cap.set(cv2.CAP_PROP_FPS, FRAME_RATE)

            print(f"[inference] Capture started: {self.source}")
            last_joints = None
            while self._running:
                ok, frame = cap.read()
                if not ok:
                    if isinstance(self.source, str):
                        break   # video file ended
                    continue

                self._frame_count += 1
                joint_frame = self._mediapipe_frame(frame, pose)
                if joint_frame is not None:
                    self._buffer.append(joint_frame)
                    last_joints = joint_frame
                    self._latest_skeleton = joint_frame   # expose for per-frame WS streaming

                if (self._frame_count % INFER_EVERY_N == 0
                        and len(self._buffer) >= int(TARGET_FRAMES * MIN_BUFFER_FILL)):
                    result = self._infer()
                    if result:
                        self._result_queue.append(result)
                        print(f"[inference] score={result.risk_score:.3f} quality={result.pose_quality} frame={result.frame_count}")
                        # Use calibrated thresholds from settings, not hardcoded 0.50
                        from config.settings import RISK_TAU_HIGH, RISK_TAU_LOW
                        self._disp_level    = "HIGH" if result.risk_score >= RISK_TAU_HIGH else "MODERATE" if result.risk_score >= RISK_TAU_LOW else "NORMAL"
                        self._disp_score    = result.risk_score
                        self._disp_buffering = False

                # Annotate and store MJPEG frame
                self._encode_display_frame(frame, last_joints)

            cap.release()
        self._running = False

    def _run_skeleton_source(self):
        """Replay a saved .npy skeleton sequence without MediaPipe."""
        seqs = np.load(self.source)   # (N, 14, 4) or (T, 14, 4)
        if seqs.ndim == 3:
            seqs = seqs[np.newaxis]   # treat as single sequence
        for seq in seqs:
            if not self._running:
                break
            for frame in seq:
                self._buffer.append(frame)
            self._frame_count += len(seq)
            result = self._infer()
            if result:
                self._result_queue.append(result)
            time.sleep(3.0)   # simulate 3-second window

    # ------------------------------------------------------------------ #
    def _mediapipe_frame(self, bgr: np.ndarray, pose) -> Optional[np.ndarray]:
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        res = pose.process(rgb)
        if res.pose_landmarks is None:
            return None
        return self._dp.extract_mediapipe_14_joints(res)

    # ------------------------------------------------------------------ #
    _SKEL_EDGES = [
        (0,1),(1,2),(1,3),(2,4),(3,5),(4,6),(5,7),
        (1,8),(1,9),(8,9),(8,10),(9,11),(10,12),(11,13),
    ]
    _RISK_COLORS = {
        "NORMAL":   (50, 200, 80),
        "MODERATE": (30, 165, 255),
        "HIGH":     (50,  50, 220),
    }

    def _encode_display_frame(self, bgr: np.ndarray,
                               joints: Optional[np.ndarray]) -> None:
        """Draw skeleton + risk overlay on a copy of the frame and JPEG-encode it."""
        display = bgr.copy()
        h, w = display.shape[:2]

        # ── Face blur (privacy) ──────────────────────────────────────────
        if joints is not None:
            nose = joints[0]; neck = joints[1]
            nx, ny = int(nose[0]*w), int(nose[1]*h)
            nnx, nny = int(neck[0]*w), int(neck[1]*h)
            radius = max(35, int(abs(ny - nny) * 1.5))
            x1, y1 = max(0,nx-radius), max(0,ny-radius)
            x2, y2 = min(w,nx+radius), min(h,ny+radius)
            if x2 > x1 and y2 > y1:
                roi = display[y1:y2, x1:x2]
                display[y1:y2, x1:x2] = cv2.GaussianBlur(roi, (51,51), 20)

        # ── Skeleton ─────────────────────────────────────────────────────
        if joints is not None:
            pts = {}
            for i, (jx, jy, *_) in enumerate(joints):
                if jx > 0.01 or jy > 0.01:
                    pts[i] = (int(jx*w), int(jy*h))
            for a, b in self._SKEL_EDGES:
                if a in pts and b in pts:
                    cv2.line(display, pts[a], pts[b], (60, 220, 90), 2)
            for i, pt in pts.items():
                r = 8 if i == 0 else 5
                cv2.circle(display, pt, r, (30, 100, 255), -1)
                cv2.circle(display, pt, r, (255,255,255), 1)

        # ── HUD overlay ──────────────────────────────────────────────────
        level  = self._disp_level
        score  = self._disp_score
        color  = self._RISK_COLORS.get(level, (200,200,200))
        pct    = int(score * 100)

        overlay = display.copy()
        cv2.rectangle(overlay, (0,0), (w, 100), (15,15,25), -1)
        cv2.addWeighted(overlay, 0.65, display, 0.35, 0, display)

        if self._disp_buffering:
            cv2.putText(display, "Initialising — stand in frame",
                        (15,52), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,220,220), 2)
        else:
            cv2.putText(display, f"{level}   {pct}%",
                        (15,55), cv2.FONT_HERSHEY_SIMPLEX, 1.4, color, 3)
            cv2.putText(display, f"Posture: {self._disp_posture}",
                        (15,85), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200,200,200), 1)
            # Risk bar
            bx, by, bw, bh = w-230, 20, 200, 24
            cv2.rectangle(display, (bx,by), (bx+bw, by+bh), (55,55,55), -1)
            cv2.rectangle(display, (bx,by), (bx+int(bw*score), by+bh), color, -1)
            cv2.rectangle(display, (bx,by), (bx+bw, by+bh), (130,130,130), 1)

        # HIGH alert border
        if level == "HIGH":
            cv2.rectangle(display, (0,0), (w,h), (50,50,220), 6)
            cv2.putText(display, "!!! HIGH FALL RISK !!!",
                        (w//2-200, h-35), cv2.FONT_HERSHEY_SIMPLEX,
                        1.0, (50,50,220), 3)

        # Watermark
        cv2.putText(display, "SENTRY | CareSense",
                    (15, h-12), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100,100,120), 1)

        # Encode to JPEG
        ok, buf = cv2.imencode(".jpg", display, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ok:
            self._latest_frame_bytes = buf.tobytes()

    # ------------------------------------------------------------------ #
    def _pose_quality(self, buffer_arr: np.ndarray) -> str:
        """Assess pose quality from the last frame in the buffer."""
        last = buffer_arr[-1]          # (14, 4)
        vis  = last[:, 3]
        frac = float((vis >= VIS_THRESH).mean())
        if frac >= GOOD_JOINT_FRAC:
            return "GOOD"
        if frac >= DEGRADED_JOINT_FRAC:
            return "DEGRADED"
        return "UNAVAILABLE"

    # ------------------------------------------------------------------ #
    def _infer(self) -> Optional[InferenceResult]:
        if self._stgcn is None:
            return None

        buf = np.stack(list(self._buffer), axis=0)  # (T, 14, 4)
        quality = self._pose_quality(buf)
        # Only skip inference if truly UNAVAILABLE (< 35% joints visible).
        # DEGRADED still runs the model — a partial-body view on a laptop webcam
        # is normal and should still produce a risk score.
        if quality == "UNAVAILABLE":
            return InferenceResult(
                timestamp=time.time(), risk_score=0.0,
                stgcn_score=0.0, feat_score=0.0,
                pose_quality="UNAVAILABLE",
                skeleton=buf[-1].tolist(),
                key_factors=["pose unavailable — ensure full body is visible"],
                frame_count=self._frame_count,
            )

        try:
            seq_norm = self._dp.apply_clip_normalization(buf)
            seq_90   = self._dp.enforce_temporal_uniformity(seq_norm)
            raw_feats = self._feat.extract_sequence_features(seq_90)
            if self._scaler is not None:
                feats_std = self._scaler.transform(
                    raw_feats.reshape(1, -1)).astype(np.float32)
            else:
                feats_std = raw_feats.reshape(1, -1).astype(np.float32)
        except Exception as e:
            print(f"[inference] preprocessing error: {e}")
            return None

        sk_t  = torch.from_numpy(seq_90[np.newaxis].astype(np.float32)).to(self.device)
        ft_t  = torch.from_numpy(feats_std).to(self.device)

        with torch.no_grad():
            emb          = self._stgcn(sk_t, extract_embedding=True)
            stgcn_prob   = float(torch.softmax(self._stgcn.fc(emb), 1)[0, 1])
            fusion_prob  = float(torch.softmax(self._fusion(emb, ft_t), 1)[0, 1])
            feat_prob    = 0.0
            if self._clf is not None:
                feat_prob = float(torch.softmax(self._clf(ft_t), 1)[0, 1])

        key_factors = self._top_factors(raw_feats, quality)

        return InferenceResult(
            timestamp    = time.time(),
            risk_score   = round(fusion_prob, 4),
            stgcn_score  = round(stgcn_prob, 4),
            feat_score   = round(feat_prob, 4),
            pose_quality = quality,
            skeleton     = buf[-1].tolist(),
            key_factors  = key_factors,
            frame_count  = self._frame_count,
        )

    # ------------------------------------------------------------------ #
    def _top_factors(self, feats: np.ndarray, quality: str,
                     top_n: int = 3) -> List[str]:
        from config.settings import FEATURE_NAMES, FEATURE_DISPLAY_NAMES
        if quality == "DEGRADED":
            return ["degraded pose quality"]
        # Simple threshold-based attribution: which features are high?
        high = []
        for i, val in enumerate(feats):
            if abs(float(val)) > 1.5:
                name = FEATURE_NAMES[i]
                high.append(FEATURE_DISPLAY_NAMES.get(name, name))
        return high[:top_n] if high else ["stable movement"]
