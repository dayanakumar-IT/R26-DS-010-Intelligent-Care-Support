"""
FastAPI server — REST endpoints + WebSocket live stream.

Start
-----
    cd backend
    uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload

WebSocket message schema
------------------------
{
  "patient_id":  "P001",
  "room_id":     "ROOM_01",
  "timestamp":   "2026-08-05T10:30:45.123Z",
  "skeleton":    [[x,y,z,v], ...],   // 14 joints
  "risk_score":  0.82,
  "risk_level":  "HIGH",
  "posture":     "STANDING",
  "zone":        "WALKING",
  "pose_quality":"GOOD",
  "confidence":  0.92,
  "key_factors": ["body sway", "forward body tilt"],
  "stgcn_score": 0.79,
  "feat_score":  0.61,
  "alert":       true
}
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

import warnings
# Suppress noisy protobuf SymbolDatabase deprecation spam from mediapipe internals
warnings.filterwarnings("ignore", message="SymbolDatabase.GetPrototype", category=UserWarning)

import cv2
import torch
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

# ── API key auth ──────────────────────────────────────────────────────────────
# Set SENTRY_API_KEY in .env to require X-API-Key header on all endpoints.
# Leave blank to run unauthenticated (local-network-only deployments).
_API_KEY: str = os.environ.get("SENTRY_API_KEY", "").strip()
_UNPROTECTED = {"/api/health", "/", "/docs", "/openapi.json", "/redoc", "/api/auth/login"}

def _check_key(request: Request) -> bool:
    """Return True if the request is allowed (no key configured, or key matches)."""
    if not _API_KEY:
        return True
    if request.url.path in _UNPROTECTED:
        return True
    if request.url.path.startswith("/video/"):
        return True
    return request.headers.get("X-API-Key", "") == _API_KEY

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import (
    init_db,
    get_patients, get_patient, get_patient_by_code, upsert_patient, get_rooms, get_rooms_with_camera,
    get_alerts, acknowledge_alert, get_replay,
    get_patient_history, get_dashboard_summary,
    insert_event, insert_alert, save_replay_frames,
    get_room_zones, set_room_zones, update_room_camera, assign_caregiver_to_room,
    get_caregivers, get_caregiver, upsert_room,
)
from src.inference import InferenceEngine
from src.postprocess import RiskPostProcessor
from src.context_engine import ContextEngine

import numpy as np
from supabase import create_client as _create_supabase_client

# ── Supabase client (used for auth proxy) ─────────────────────────────────────
_SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
_SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
_supabase = _create_supabase_client(_SUPABASE_URL, _SUPABASE_KEY) if _SUPABASE_URL and _SUPABASE_KEY else None

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Fall Risk Monitoring API",
    version="1.0.0",
    description="Edge-enabled skeletal fall risk detection system.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-API-Key"],
)

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    if not _check_key(request):
        return JSONResponse(
            status_code=401,
            content={"error": "Unauthorized — X-API-Key header required"},
        )
    return await call_next(request)

# ── Global state ─────────────────────────────────────────────────────────────
_engines:     Dict[str, InferenceEngine]   = {}   # room_id → engine
_processors:  Dict[str, RiskPostProcessor] = {}   # room_id → postprocessor
_contexts:    Dict[str, ContextEngine]     = {}   # room_id → context engine
_ws_clients:  Dict[str, Set[WebSocket]]    = {}   # room_id → connected sockets
_disp_ema:    Dict[str, float]             = {}   # room_id → fast display EMA (alpha=0.75)
_DISP_EMA_ALPHA = 0.75  # very fast decay — 2-3 frames to settle; purely cosmetic, not used for alerts
_ws_alert_clients: Set[WebSocket]          = set() # /ws/alerts subscribers (Flutter app)
_replay_buf:  Dict[str, list]              = {}   # room_id → rolling 5-sec buffer
_replay_mem:  Dict[int, list]              = {}   # alert_id → saved frames (in-memory, no R2 needed)


def _find_hikvision_index() -> Optional[int]:
    """
    Check Windows device list for a connected Hikvision camera by name.
    If found, scan cv2 indices 1..4 and return the first one that opens.
    Returns None if Hikvision is not physically connected.
    """
    try:
        result = subprocess.run(
            [
                "powershell", "-NoProfile", "-Command",
                "Get-PnpDevice -Class Camera -Status OK | Select-Object -ExpandProperty FriendlyName",
            ],
            capture_output=True, text=True, timeout=5,
        )
        names = result.stdout.lower()
        if "hikvision" in names or "ds-u02" in names or "ds-u" in names:
            # Hikvision is in device list — find its cv2 index (skip 0 = built-in)
            for idx in range(1, 5):
                cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
                opened = cap.isOpened()
                cap.release()
                if opened:
                    return idx
    except Exception as e:
        print(f"[server] Hikvision detection error: {e}")
    return None


def _resolve_camera_source(src: str):
    """
    Resolve camera source:
    - If CAMERA_SRC_OVERRIDE is set in .env → use that index directly, no Hikvision detection.
    - If src is an RTSP URL (non-digit) → use it unchanged.
    - Otherwise auto-detect Hikvision; fall back to 0 if not found.
    """
    override = os.environ.get("CAMERA_SRC_OVERRIDE", "").strip()
    if override and override.isdigit():
        idx = int(override)
        print(f"[server] CAMERA_SRC_OVERRIDE set — using camera index {idx}.")
        return idx

    if not str(src).isdigit():
        return src  # RTSP URL — use as-is

    hik_idx = _find_hikvision_index()
    if hik_idx is not None:
        print(f"[server] Hikvision camera detected at index {hik_idx} — using USB camera.")
        return hik_idx

    print("[server] Hikvision not connected — using built-in camera (index 0).")
    return 0


# ── Startup / shutdown ───────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # DB init — non-fatal, server starts even if Supabase is slow
    try:
        await asyncio.to_thread(init_db)
    except Exception as e:
        print(f"[server] DB init warning: {e} — continuing.")

    # Auto-start engine for the FIRST room with a camera only (single physical camera).
    try:
        rooms_with_cam = await asyncio.to_thread(get_rooms_with_camera)
        if rooms_with_cam:
            room       = rooms_with_cam[0]  # use first room only — one camera, one engine
            src        = os.environ.get("CAMERA_SRC_OVERRIDE") or room["camera_src"]
            suffix     = room.get("camera_suffix") or ""
            source     = _resolve_camera_source(src)
            room_key   = room["room_code"]
            patient_id = room.get("patient_id") or "P001"
            _start_room_engine(room_key, source=source, suffix=suffix, patient_id=patient_id)
            print(f"[server] Auto-started engine for {room_key} (source={source})")
            if len(rooms_with_cam) > 1:
                print(f"[server] {len(rooms_with_cam)-1} other room(s) skipped — single camera mode.")
        else:
            print("[server] No cameras configured yet — configure via portal.")
    except Exception as e:
        print(f"[server] Camera auto-start skipped ({e.__class__.__name__}: {e}).")

    print("[server] SENTRY backend ready on :8000")


@app.on_event("shutdown")
async def shutdown():
    for eng in _engines.values():
        eng.stop()


# ── Internal helpers ─────────────────────────────────────────────────────────
def _start_room_engine(room_id: str, source=None, suffix: str = "", patient_id: str = "P001"):
    if room_id in _engines:
        _engines[room_id].stop()

    if source is None:
        return   # no camera configured yet

    eng = InferenceEngine(source=source, suffix=suffix,
                          room_id=room_id, patient_id=patient_id)
    try:
        eng.load_models()
    except Exception as e:
        print(f"[server] Cannot load models for {room_id}: {e}")
        return

    _engines[room_id]    = eng
    _processors[room_id] = RiskPostProcessor()
    _disp_ema[room_id]   = 0.0
    ctx = ContextEngine()
    zones = get_room_zones(room_id)   # load from DB — empty dict if not configured
    if zones:
        ctx.configure_zones(zones)
    _contexts[room_id]   = ctx
    _ws_clients[room_id] = set()
    _replay_buf[room_id] = []

    eng.start()
    loop = asyncio.get_event_loop()
    loop.create_task(_broadcast_loop(room_id))
    loop.create_task(_skel_frame_loop(room_id))


async def _skel_frame_loop(room_id: str):
    """
    Stream raw skeleton frames at ~25 fps so the frontend canvas animates
    smoothly even while the full inference result (risk score, etc.) only
    arrives every 3 capture frames.  Sends lightweight 'skeleton' messages
    that the frontend merges into the live frame without overwriting the
    last known risk_level / posture / etc.
    """
    while room_id in _engines:
        eng = _engines.get(room_id)
        skel = getattr(eng, "_latest_skeleton", None) if eng else None
        if skel is not None and _ws_clients.get(room_id):
            msg = {
                "type":      "skeleton",
                "room_id":   room_id,
                "timestamp": datetime.utcnow().isoformat(),
                "skeleton":  skel.tolist(),
            }
            dead = set()
            for ws in list(_ws_clients.get(room_id, set())):
                try:
                    await ws.send_json(msg)
                except Exception:
                    dead.add(ws)
            _ws_clients[room_id] -= dead
        await asyncio.sleep(0.04)   # ~25 fps


async def _broadcast_loop(room_id: str):
    eng  = _engines[room_id]
    proc = _processors[room_id]
    ctx  = _contexts[room_id]

    # Resolve numeric patient_id — DB column is bigint, eng.patient_id is a code string.
    numeric_patient_id = None
    try:
        pat_row = await asyncio.to_thread(get_patient_by_code, eng.patient_id)
        numeric_patient_id = pat_row["id"] if pat_row else None
    except Exception as e:
        print(f"[server] Could not resolve patient '{eng.patient_id}' ({e.__class__.__name__}) — events will be skipped.")
    if not numeric_patient_id:
        print(f"[server] Patient '{eng.patient_id}' not in DB — events will be skipped. "
              f"Add the patient via Patients & Beds tab first.")

    # Resolve numeric room_id — fall_events.room_id is bigint; room_id arg may be a
    # room_code string like "ROOM_01" (when started via Camera Config endpoint).
    numeric_room_id: object = room_id   # fallback — will fail DB write if still a string
    try:
        from src.database import get_rooms
        rooms_list = await asyncio.to_thread(get_rooms)
        matched = next((r for r in rooms_list if r["room_code"] == room_id or str(r["id"]) == str(room_id)), None)
        if matched:
            numeric_room_id = matched["id"]
    except Exception as e:
        print(f"[server] Could not resolve numeric room_id for '{room_id}' ({e.__class__.__name__})")

    # eng.results() is a BLOCKING sync generator. Running it directly in an
    # async function starves the event loop and prevents startup from completing.
    # Fix: run the blocking next() call in a thread executor each iteration.
    loop   = asyncio.get_event_loop()
    gen    = eng.results()

    def _pull():
        try:
            return next(gen)
        except StopIteration:
            return None

    while True:
        result = await loop.run_in_executor(None, _pull)
        if result is None or room_id not in _ws_clients:
            break

        # Context — posture, zone, and zone-aware risk modifier
        last_frame = np.array(result.skeleton, dtype=np.float32)
        ctx_result = ctx.update(last_frame, result.timestamp)

        # Feed raw model score directly to postprocessor — no zone modifier.
        # Zone modifier was causing false HIGHs: harmless posture jitter (TRANSITION)
        # in a configured BED/CHAIR zone added +0.12–+0.15 to the score, pushing
        # normal standing (0.35–0.45) over the HIGH threshold. The trained model
        # already encodes fall risk; zone context is shown in the UI for caregiver
        # awareness only, not as a score boost.
        state = proc.update(result.risk_score, result.timestamp)

        # ── Posture-aware clamping ────────────────────────────────────────────
        # Only one rule: confirmed stable SITTING → cap at MODERATE.
        # Rationale: if the posture classifier has already settled on SITTING
        # (not TRANSITION), the person is seated — not mid-fall.
        # We do NOT add rules for STANDING/WALKING — the trained model handles
        # those. False positives while standing are a threshold/EMA issue, not
        # a posture-rule issue.
        from dataclasses import replace as _dc_replace
        if ctx_result.posture == "SITTING" and state.level == "HIGH":
            state = _dc_replace(state, level="MODERATE", alert=False)

        # 5-second replay buffer (~150 frames at 30fps → keep last 150)
        buf = _replay_buf.setdefault(room_id, [])
        buf.append((len(buf), result.timestamp, result.skeleton))
        if len(buf) > 150:
            buf.pop(0)

        # Alert handling — only write to DB if we have a valid numeric patient id.
        # Run in thread (blocking sync call) and catch all network errors so a
        # transient Supabase disconnect never kills the broadcast loop.
        # ── Audio alert (edge device speaker) ────────────────────────────────
        # HIGH → repeating two-tone beep (800 Hz / 1200 Hz, 400 ms each).
        # MODERATE → single low beep (600 Hz, 300 ms).
        # Runs in a daemon thread so it never blocks the async loop.
        # winsound is a stdlib module on Windows — no extra package needed.
        if state.alert:
            def _high_beep():
                try:
                    import winsound
                    winsound.Beep(1200, 400)
                    winsound.Beep(800, 400)
                except Exception:
                    pass
            threading.Thread(target=_high_beep, daemon=True).start()
        elif state.moderate_alert:
            def _mod_beep():
                try:
                    import winsound
                    winsound.Beep(600, 300)
                except Exception:
                    pass
            threading.Thread(target=_mod_beep, daemon=True).start()

        alert_id = None
        if state.alert:
            try:
                # Insert alert — patient_id may be None if P001 not registered yet
                alert_id = await asyncio.to_thread(
                    insert_alert,
                    numeric_patient_id, numeric_room_id, result.timestamp,
                    state.score, state.level, ctx_result.posture,
                    result.key_factors,
                )
                if alert_id:
                    # Save replay to memory first (no R2 required for demo)
                    replay_frames = buf[-90:]
                    _replay_mem[alert_id] = [
                        {"frame": f[0], "timestamp": f[1], "skeleton": f[2]}
                        for f in replay_frames
                    ]
                    print(f"[server] Alert #{alert_id} saved — {len(replay_frames)} replay frames in memory")
                    # Also try R2 (non-fatal if not configured)
                    try:
                        await asyncio.to_thread(save_replay_frames, alert_id, replay_frames)
                    except Exception:
                        pass
            except Exception as db_err:
                print(f"[server] insert_alert skipped ({db_err.__class__.__name__}): {db_err}")
        elif state.moderate_alert:
            # MODERATE alerts are logged too (no replay clip — HIGH-only) so a
            # caregiver who was away from the dashboard/app still sees them
            # and hears a single catch-up beep next time they check in.
            try:
                alert_id = await asyncio.to_thread(
                    insert_alert,
                    numeric_patient_id, numeric_room_id, result.timestamp,
                    state.score, state.level, ctx_result.posture,
                    result.key_factors,
                )
                if alert_id:
                    replay_frames = buf[-90:]
                    _replay_mem[alert_id] = [
                        {"frame_index": i, "skeleton": f[2]}
                        for i, f in enumerate(replay_frames)
                    ]
                    print(f"[server] MODERATE Alert #{alert_id} saved — {len(replay_frames)} replay frames in memory")
            except Exception as db_err:
                print(f"[server] insert_alert (moderate) skipped ({db_err.__class__.__name__}): {db_err}")

        # Persist event every window — numeric_room_id instead of room_code string.
        if numeric_patient_id:
            try:
                await asyncio.to_thread(
                    insert_event,
                    numeric_patient_id, numeric_room_id, result.timestamp,
                    state.score, state.level, ctx_result.posture,
                    ctx_result.zone, result.pose_quality, result.risk_score,
                    result.key_factors, alert_id,
                )
            except Exception as db_err:
                print(f"[server] insert_event skipped ({db_err.__class__.__name__}): {db_err}")

        # Build WebSocket message
        # Display EMA — fast (alpha=0.75) so it feels instantaneous but rejects single-frame spikes.
        # Pure model score only, no zone modifier — zone modifier goes to alert pipeline only.
        # Alpha=0.75: a spike decays to 6% of its value in 3 frames (~0.1s at 30fps).
        from config.settings import RISK_TAU_HIGH as _TAU_H, RISK_TAU_LOW as _TAU_L
        raw_score = float(result.risk_score)   # pure model output 0-1, no zone modifier
        prev_disp = _disp_ema.get(room_id, 0.0)
        disp_score = _DISP_EMA_ALPHA * raw_score + (1.0 - _DISP_EMA_ALPHA) * prev_disp
        _disp_ema[room_id] = disp_score
        disp_level = "HIGH" if disp_score >= _TAU_H else "MODERATE" if disp_score >= _TAU_L else "NORMAL"

        msg = {
            "patient_id":  eng.patient_id,
            "room_id":     room_id,
            "timestamp":   datetime.fromtimestamp(
                result.timestamp, tz=timezone.utc).isoformat(),
            "skeleton":    result.skeleton,
            "risk_score":  round(disp_score * 100),     # fast-EMA score for display bar
            "risk_level":  disp_level,                  # fast display level — responsive, not noisy
            "alert_level": state.level,                 # EMA+dwell+zone — alert decisions only
            "posture":     ctx_result.posture,
            "zone":          ctx_result.zone,
            "zone_modifier": round(ctx_result.zone_modifier, 2),
            "pose_quality":  result.pose_quality,
            "confidence":  round(result.risk_score, 2),
            "key_factors": result.key_factors,
            "stgcn_score": result.stgcn_score,
            "feat_score":  result.feat_score,
            "alert":          state.alert,           # True every ALERT_COOLDOWN_S while HIGH
            "moderate_alert": state.moderate_alert,   # True once per MODERATE episode
            "alert_id":       alert_id,
        }

        # Push to room live clients (dashboard)
        dead = set()
        for ws in list(_ws_clients.get(room_id, set())):
            try:
                await ws.send_json(msg)
            except Exception:
                dead.add(ws)
        # Use .difference_update() — augmented assignment (-=) creates an unintended local
        _ws_clients.get(room_id, set()).difference_update(dead)

        # Push alerts to Flutter mobile app clients (/ws/alerts)
        if state.alert or (state.level == "MODERATE" and
                           getattr(proc, "_prev_ws_level", "NORMAL") == "NORMAL"):
            # get_patient_by_code (by patient_code string), NOT get_patient (by numeric id)
            pt = None
            try:
                pt = await asyncio.to_thread(get_patient_by_code, eng.patient_id)
            except Exception:
                pass
            alert_msg = {
                "type":         "ALERT",
                "risk_level":   state.level,
                "risk_score":   round(state.score * 100),
                "patient_id":   eng.patient_id,
                "patient_name": pt.get("patient_code") if pt else eng.patient_id,
                "room_id":      room_id,
                "posture":      ctx_result.posture,
                "key_factors":  result.key_factors,
                "alert_id":     alert_id,
                "timestamp":    msg["timestamp"],
            }
            dead_alert = set()
            for ws in list(_ws_alert_clients):
                try:
                    await ws.send_json(alert_msg)
                except Exception:
                    dead_alert.add(ws)
            # Use .difference_update() not -= to avoid UnboundLocalError:
            # augmented assignment (_ws_alert_clients -= x) makes Python treat
            # _ws_alert_clients as a local variable for the entire function scope.
            _ws_alert_clients.difference_update(dead_alert)
        proc._prev_ws_level = state.level

        await asyncio.sleep(0)   # yield to event loop


# ── REST endpoints ───────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


class _LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/login")
async def auth_login(body: _LoginRequest):
    """Proxy Supabase login so the mobile app doesn't need direct DNS to supabase.co."""
    if _supabase is None:
        raise HTTPException(status_code=503, detail="Auth service not configured.")
    try:
        resp = await asyncio.to_thread(
            lambda: _supabase.auth.sign_in_with_password(
                {"email": body.email, "password": body.password}
            )
        )
        user = resp.user
        if user is None:
            raise HTTPException(status_code=401, detail="Login failed.")

        profile = await asyncio.to_thread(
            lambda: _supabase.table("profiles")
                .select("name, role")
                .eq("id", user.id)
                .maybe_single()
                .execute()
        )
        profile_data = profile.data if profile else None
        if not profile_data:
            raise HTTPException(status_code=403, detail="Profile not found.")

        role = profile_data.get("role", "")
        if role not in ("caregiver", "admin", "supervisor"):
            raise HTTPException(status_code=403, detail="Access denied.")

        return {
            "access_token": resp.session.access_token if resp.session else "",
            "user_id":      user.id,
            "name":         profile_data.get("name", body.email),
            "role":         role,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.get("/api/dashboard/summary")
async def dashboard_summary():
    return await asyncio.to_thread(get_dashboard_summary)


@app.get("/api/rooms")
async def rooms():
    return await asyncio.to_thread(get_rooms)


@app.get("/api/patients")
async def patients(caregiver_id: str = None):
    return await asyncio.to_thread(get_patients, caregiver_id)


@app.get("/api/patients/{patient_id}")
async def patient(patient_id: str):
    p = await asyncio.to_thread(get_patient, patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    return p


@app.get("/api/patients/{patient_id}/history")
async def patient_history(patient_id: str, limit: int = 100):
    return await asyncio.to_thread(get_patient_history, patient_id, limit)


@app.get("/api/alerts")
async def alerts(unacked_only: bool = False, limit: int = 100):
    return await asyncio.to_thread(get_alerts, unacked_only, limit)


class AckBody(BaseModel):
    ack_by: str = "caregiver"


@app.patch("/api/alerts/{alert_id}/acknowledge")
async def ack_alert(alert_id: int, body: AckBody = AckBody()):
    ok = await asyncio.to_thread(acknowledge_alert, alert_id, body.ack_by)
    if not ok:
        raise HTTPException(404, "Alert not found or already acknowledged")
    return {"acknowledged": True, "alert_id": alert_id}


@app.get("/api/events")
async def events(patient_id: str = None, limit: int = 100):
    if patient_id:
        return await asyncio.to_thread(get_patient_history, patient_id, limit)
    return []


@app.get("/api/events/{alert_id}/replay")
async def replay(alert_id: int):
    # Check in-memory store first (populated on alert, no R2 needed)
    if alert_id in _replay_mem:
        return {"alert_id": alert_id, "frames": _replay_mem[alert_id]}
    # Fall back to R2 / Supabase
    frames = await asyncio.to_thread(get_replay, alert_id)
    if not frames:
        raise HTTPException(404, "No replay data for this alert")
    return {"alert_id": alert_id, "frames": frames}


@app.delete("/api/alerts/clear-demo")
async def clear_demo_alerts(confirm: str = ""):
    """Clear ALL alerts and reset all in-memory risk state — use before a viva/demo.
    Requires ?confirm=yes to prevent accidental wipe.
    """
    if confirm.lower() != "yes":
        return JSONResponse(status_code=400, content={
            "error": "Pass ?confirm=yes to clear all alerts. This cannot be undone."
        })
    try:
        # 1. Clear DB alerts and replay memory
        _replay_mem.clear()
        deleted = _get_client().table("fall_alerts").delete().neq("id", 0).execute()
        count = len(deleted.data) if deleted.data else 0

        # 2. Reset postprocessor EMA so accumulated history can't immediately re-trigger HIGH
        for proc in _processors.values():
            proc.reset()

        # 3. Reset fast display EMA so display also starts fresh
        for key in list(_disp_ema.keys()):
            _disp_ema[key] = 0.0

        return {"status": "cleared", "alerts_deleted": count,
                "replay_memory_cleared": True, "ema_reset": True}
    except Exception as e:
        raise HTTPException(500, f"Clear failed: {e}")

def _get_client():
    from src.database import _get_client as db_client
    return db_client()

@app.get("/api/replay/status")
async def replay_status():
    """Return which alert IDs have in-memory replay data and total frame counts."""
    return {
        "count": len(_replay_mem),
        "alert_ids": list(_replay_mem.keys()),
        "total_frames": sum(len(v) for v in _replay_mem.values()),
    }

@app.get("/api/analytics/summary")
async def analytics():
    return await asyncio.to_thread(get_dashboard_summary)


# Zone config endpoint — caregiver sets zone polygons for a room
class ZoneConfig(BaseModel):
    zones: dict   # e.g. {"BED": [[0.1,0.1],[0.4,0.1],...], "CHAIR": [...]}

@app.put("/api/rooms/{room_id}/zones")
async def set_zones(room_id: str, cfg: ZoneConfig):
    set_room_zones(room_id, cfg.zones)
    # Apply immediately to running context engine
    if room_id in _contexts:
        _contexts[room_id].configure_zones(cfg.zones)
    return {"room_id": room_id, "zones": cfg.zones, "status": "saved"}

@app.get("/api/rooms/{room_id}/zones")
async def get_zones(room_id: str):
    zones = await asyncio.to_thread(get_room_zones, room_id)
    return {"room_id": room_id, "zones": zones, "configured": bool(zones)}


@app.post("/api/rooms/{room_id}/calibrate")
async def calibrate_zones(room_id: str, duration_s: int = 60):
    """
    Passive zone calibration.

    Observes the patient's body-centre position (midpoint of left and right
    hip joints) for `duration_s` seconds using the running inference engine.
    Clusters the positions into three zones using K-Means (k=3) and saves
    the resulting convex-hull polygons as BED, CHAIR, and WALKING zones.

    Typical usage: place the patient in their normal positions (lying in bed,
    sitting in chair, walking) and let the system observe for 60 seconds.

    Returns the discovered zone polygons.
    """
    import numpy as np
    from sklearn.cluster import KMeans
    from scipy.spatial import ConvexHull

    eng = _engines.get(room_id)
    if eng is None:
        raise HTTPException(400, f"No running engine for room '{room_id}'. "
                                 "Configure camera first via /api/rooms/{room_id}/camera.")

    # Collect body-centre samples (x, y) from the running engine
    centres: list[tuple[float, float]] = []
    deadline = time.monotonic() + duration_s
    print(f"[calibrate] Collecting body-centre samples for {duration_s}s …")

    while time.monotonic() < deadline:
        skel = getattr(eng, "_latest_skeleton", None)
        if skel is not None:
            arr = np.array(skel, dtype=np.float32)  # (14, 4)
            # Left hip = joint 6, Right hip = joint 7 (SENTRY 14-joint mapping)
            if arr.shape[0] >= 8:
                cx = float((arr[6, 0] + arr[7, 0]) / 2)
                cy = float((arr[6, 1] + arr[7, 1]) / 2)
                centres.append((cx, cy))
        await asyncio.sleep(0.1)  # sample at ~10 Hz

    if len(centres) < 30:
        raise HTTPException(422, f"Only {len(centres)} samples collected — "
                                 "ensure the patient is visible and moving.")

    pts = np.array(centres)

    # K-Means: 3 clusters → BED (lowest y = highest on screen),
    # CHAIR (mid y), WALKING (spread / highest y)
    k = min(3, len(pts))
    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(pts)

    # Sort clusters by mean y (ascending) → BED first (person lies lowest on screen)
    cluster_mean_y = [pts[labels == i, 1].mean() for i in range(k)]
    order = sorted(range(k), key=lambda i: cluster_mean_y[i])
    zone_names = ["BED", "CHAIR", "WALKING"]

    zones: dict[str, list[list[float]]] = {}
    for zone_name, cluster_idx in zip(zone_names, order):
        cluster_pts = pts[labels == cluster_idx]
        if len(cluster_pts) < 3:
            # Too few points — use bounding box as fallback
            xmin, ymin = cluster_pts.min(axis=0)
            xmax, ymax = cluster_pts.max(axis=0)
            pad = 0.05
            polygon = [
                [float(xmin - pad), float(ymin - pad)],
                [float(xmax + pad), float(ymin - pad)],
                [float(xmax + pad), float(ymax + pad)],
                [float(xmin - pad), float(ymax + pad)],
            ]
        else:
            try:
                hull = ConvexHull(cluster_pts)
                polygon = cluster_pts[hull.vertices].tolist()
                # Expand hull by a small margin (5% of frame width)
                centroid = cluster_pts.mean(axis=0)
                polygon = [
                    [centroid[0] + 1.05 * (p[0] - centroid[0]),
                     centroid[1] + 1.05 * (p[1] - centroid[1])]
                    for p in polygon
                ]
            except Exception:
                xmin, ymin = cluster_pts.min(axis=0)
                xmax, ymax = cluster_pts.max(axis=0)
                polygon = [[float(xmin), float(ymin)], [float(xmax), float(ymin)],
                           [float(xmax), float(ymax)], [float(xmin), float(ymax)]]
        zones[zone_name] = polygon

    # Persist and apply immediately
    set_room_zones(room_id, zones)
    if room_id in _contexts:
        _contexts[room_id].configure_zones(zones)

    print(f"[calibrate] Zones saved for {room_id}: {list(zones.keys())}")
    return {
        "room_id":       room_id,
        "zones":         zones,
        "samples":       len(centres),
        "duration_s":    duration_s,
        "status":        "calibrated",
        "zone_names":    list(zones.keys()),
    }


# Camera config endpoint — set source for a room at runtime
class CameraConfig(BaseModel):
    source: str   # "0" for webcam index 0, or file path
    suffix: str = ""
    patient_id: str = "P001"


@app.post("/api/rooms/{room_id}/camera")
async def configure_camera(room_id: str, cfg: CameraConfig):
    src = int(cfg.source) if cfg.source.isdigit() else cfg.source
    # Persist to DB so camera auto-starts on next server restart
    update_room_camera(room_id, cfg.source, cfg.suffix)
    _start_room_engine(room_id, source=src, suffix=cfg.suffix, patient_id=cfg.patient_id)
    return {"room_id": room_id, "source": cfg.source, "patient_id": cfg.patient_id, "status": "started"}


# ── Caregiver endpoints ───────────────────────────────────────────────────────

@app.get("/api/caregivers")
async def list_caregivers():
    return await asyncio.to_thread(get_caregivers)


class CaregiverBody(BaseModel):
    id:    str
    name:  str
    role:  str = "Nurse"
    phone: str = None
    email: str = None


@app.post("/api/caregivers")
async def add_caregiver(body: CaregiverBody):
    # Caregivers are owned by PULSE — read only from caregiver_profiles
    return {"error": "Caregivers are managed by PULSE component"}


@app.patch("/api/rooms/{room_id}/caregiver")
async def assign_caregiver(room_id: str, caregiver_id: str):
    await asyncio.to_thread(assign_caregiver_to_room, room_id, caregiver_id)
    return {"room_id": room_id, "caregiver_id": caregiver_id, "status": "assigned"}


# ── Patient management endpoints ──────────────────────────────────────────────

class PatientBody(BaseModel):
    patient_code: str
    gender:       str = None   # 'M' | 'F' | 'Other'
    room_id:      str = None


@app.post("/api/patients")
async def add_patient(body: PatientBody):
    await asyncio.to_thread(upsert_patient, body.patient_code, body.gender, body.room_id)
    return {"patient_code": body.patient_code, "status": "ok"}


class RoomBody(BaseModel):
    room_code:  str
    ward:       str = None
    camera_src: str = None


@app.post("/api/rooms")
async def add_room(body: RoomBody):
    await asyncio.to_thread(upsert_room, body.room_code, body.ward, body.camera_src)
    return {"room_code": body.room_code, "status": "ok"}


# ── Offline video analysis ───────────────────────────────────────────────────

@app.post("/api/analyse")
async def analyse_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    suffix: str = "_webcam",
):
    """
    Upload a video → extract skeleton → analyse risk → delete original.
    Returns analysis JSON immediately (runs synchronously for simplicity).
    Original video is deleted after skeleton extraction (privacy).
    """
    import tempfile, shutil
    from offline_analyse import main as run_analysis

    # Save uploaded file to a temp location
    suffix_ext = os.path.splitext(file.filename)[-1] or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix_ext)
    try:
        shutil.copyfileobj(file.file, tmp)
        tmp.close()
        out_json = tmp.name.replace(suffix_ext, "_analysis.json")
        run_analysis(tmp.name, suffix=suffix, out_path=out_json)
        if os.path.exists(out_json):
            with open(out_json) as f:
                result = json.load(f)
            os.remove(out_json)
            return result
        return {"error": "Analysis failed — no output produced"}
    except Exception as e:
        return {"error": str(e)}
    finally:
        if os.path.exists(tmp.name):
            try: os.remove(tmp.name)
            except: pass


# ── MJPEG video stream ───────────────────────────────────────────────────────

async def _mjpeg_generator(room_id: str):
    """Yield MJPEG frames from the running inference engine for a room."""
    boundary = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
    # Placeholder black frame when engine not running
    placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(placeholder, "No camera active for " + room_id,
                (60, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (100,100,120), 2)
    _, placeholder_buf = cv2.imencode(".jpg", placeholder)
    placeholder_bytes = placeholder_buf.tobytes()

    while True:
        eng = _engines.get(room_id)
        frame_bytes = eng._latest_frame_bytes if eng else None
        yield boundary + (frame_bytes or placeholder_bytes) + b"\r\n"
        await asyncio.sleep(0.033)   # ~30 fps cap


@app.get("/video/{room_id}")
async def video_stream(room_id: str, token: str = ""):
    """MJPEG stream — browsers cannot send headers in <img> so auth uses ?token=<key>.
    Example: <img src='http://localhost:8000/video/ROOM_01?token=sentry-demo-2026'>
    If SENTRY_API_KEY is not set, stream is open (local-network-only deployments).
    """
    if _API_KEY and token != _API_KEY:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    return StreamingResponse(
        _mjpeg_generator(room_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── System status endpoint ────────────────────────────────────────────────────

@app.get("/api/system/status")
async def system_status():
    """Returns engine status for each configured room."""
    status = {}
    for room_id, eng in _engines.items():
        status[room_id] = {
            "running":   eng._running,
            "level":     eng._disp_level,
            "score":     round(eng._disp_score * 100),
            "posture":   eng._disp_posture,
            "buffering": eng._disp_buffering,
            "device":    str(eng.device),
        }
    return {
        "engines": status,
        "active_rooms": len(_engines),
        "ws_clients": sum(len(v) for v in _ws_clients.values()),
        "mobile_clients": len(_ws_alert_clients),
    }


# ── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws/live/{room_id}")
async def ws_live(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in _ws_clients:
        _ws_clients[room_id] = set()
    _ws_clients[room_id].add(websocket)
    print(f"[ws] Client connected to {room_id}. "
          f"Total: {len(_ws_clients[room_id])}")
    try:
        while True:
            # Keep connection alive — data is pushed from _broadcast_loop / _skel_frame_loop.
            # Use a long timeout (10 min) so the connection doesn't drop during demos.
            await asyncio.wait_for(websocket.receive_text(), timeout=600)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        _ws_clients.get(room_id, set()).discard(websocket)
        print(f"[ws] Client disconnected from {room_id}")


@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    """
    Flutter mobile app connects here once.
    Receives alert-only messages from ALL rooms whenever MODERATE or HIGH fires.
    Works over local WiFi — no internet required.
    """
    await websocket.accept()
    _ws_alert_clients.add(websocket)
    print(f"[ws/alerts] Mobile client connected. Total: {len(_ws_alert_clients)}")
    try:
        while True:
            await asyncio.wait_for(websocket.receive_text(), timeout=30)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        _ws_alert_clients.discard(websocket)
        print(f"[ws/alerts] Mobile client disconnected.")
