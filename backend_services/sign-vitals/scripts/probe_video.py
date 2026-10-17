"""
scripts/probe_video.py
GLOSS component — recognition diagnosis. NOT part of the app.

Reports how the server's decoder (OpenCV, as in landmark_extraction.py)
sees a video: container (from the file's first bytes), codec, resolution,
fps, the frame count the file claims and the frames actually decoded.
Optionally saves 3 decoded frames (start, middle, end) as PNG, exactly
as MediaPipe receives them (before the BGR->RGB swap).

Usage (.venv_mediapipe — it has OpenCV):
  python scripts/probe_video.py [--png-dir DIR] <video> [<video> ...]
"""

import argparse
import json
import os

import cv2


def container(path: str) -> str:
    with open(path, "rb") as f:
        head = f.read(64)
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "webm/matroska"
    if head[4:8] == b"ftyp":
        brand = head[8:12].decode("ascii", "replace")
        frag = b"moof" in open(path, "rb").read(1 << 20)
        return f"mp4 (brand {brand}{', fragmented' if frag else ''})"
    return f"unknown ({head[:8].hex()})"


def probe(path: str, png_dir: str | None) -> dict:
    cap = cv2.VideoCapture(path)
    fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
    info = {
        "file": os.path.basename(path),
        "size_kb": os.path.getsize(path) // 1024,
        "container": container(path),
        "codec": "".join(chr((fourcc >> 8 * i) & 0xFF) for i in range(4)) if fourcc else "?",
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        "fps_reported": round(cap.get(cv2.CAP_PROP_FPS), 3),
        "frame_count_reported": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        "orientation_meta": cap.get(cv2.CAP_PROP_ORIENTATION_META) if hasattr(cv2, "CAP_PROP_ORIENTATION_META") else None,
    }
    frames, shapes, means = [], set(), []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(frame)
        shapes.add(frame.shape)
        means.append(float(frame.mean()))
    cap.release()
    info["frames_decoded"] = len(frames)
    info["decoded_shapes"] = sorted(str(s) for s in shapes)
    info["mean_brightness_min_max"] = [round(min(means), 1), round(max(means), 1)] if means else None
    if png_dir and frames:
        os.makedirs(png_dir, exist_ok=True)
        stem = os.path.splitext(info["file"])[0]
        for tag, i in (("start", 0), ("middle", len(frames) // 2), ("end", len(frames) - 1)):
            cv2.imwrite(os.path.join(png_dir, f"{stem}_{tag}_f{i}.png"), frames[i])
    return info


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--png-dir")
    ap.add_argument("videos", nargs="+")
    a = ap.parse_args()
    for v in a.videos:
        print(json.dumps(probe(v, a.png_dir)))
