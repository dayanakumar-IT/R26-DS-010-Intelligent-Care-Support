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
import sys
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

import torch
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import (
    init_db,
    get_patients, get_patient, upsert_patient, get_rooms, get_rooms_with_camera,
    get_alerts, acknowledge_alert, get_replay,
    get_patient_history, get_dashboard_summary,
    insert_event, insert_alert, save_replay_frames,
    get_room_zones, set_room_zones, update_room_camera, assign_caregiver_to_room,
    get_caregivers, get_caregiver,
)
from src.inference import InferenceEngine
from src.postprocess import RiskPostProcessor
from src.context_engine import ContextEngine

import numpy as np

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
    allow_headers=["*"],
)

# ── Global state ─────────────────────────────────────────────────────────────
_engines:     Dict[str, InferenceEngine]   = {}   # room_id → engine
_processors:  Dict[str, RiskPostProcessor] = {}   # room_id → postprocessor
_contexts:    Dict[str, ContextEngine]     = {}   # room_id → context engine
_ws_clients:  Dict[str, Set[WebSocket]]    = {}   # room_id → connected sockets
_ws_alert_clients: Set[WebSocket]          = set() # /ws/alerts subscribers (Flutter app)
_replay_buf:  Dict[str, list]              = {}   # room_id → rolling 5-sec buffer


# ── Startup / shutdown ───────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_db()
    # seed_demo_data() — disabled, real data added via frontend
    # Auto-start engines for every room that already has a camera configured in DB
    rooms_with_cam = get_rooms_with_camera()
    for room in rooms_with_cam:
        src = room["camera_src"]
        suffix = room.get("camera_suffix") or ""
        # Convert to int if it's a digit string (webcam index)
        source = int(src) if str(src).isdigit() else src
        _start_room_engine(room["id"], source=source, suffix=suffix)
        print(f"[server] Auto-started engine for {room['id']} (source={src})")
    if not rooms_with_cam:
        print("[server] No cameras configured yet — supervisor must configure via portal.")
    print(f"[server] Started. DB initialised.")


@app.on_event("shutdown")
async def shutdown():
    for eng in _engines.values():
        eng.stop()


# ── Internal helpers ─────────────────────────────────────────────────────────
def _start_room_engine(room_id: str, source=None, suffix: str = ""):
    if room_id in _engines:
        _engines[room_id].stop()

    if source is None:
        return   # no camera configured yet

    eng = InferenceEngine(source=source, suffix=suffix,
                          room_id=room_id, patient_id="P001")
    try:
        eng.load_models()
    except Exception as e:
        print(f"[server] Cannot load models for {room_id}: {e}")
        return

    _engines[room_id]    = eng
    _processors[room_id] = RiskPostProcessor()
    ctx = ContextEngine()
    zones = get_room_zones(room_id)   # load from DB — empty dict if not configured
    if zones:
        ctx.configure_zones(zones)
    _contexts[room_id]   = ctx
    _ws_clients[room_id] = set()
    _replay_buf[room_id] = []

    eng.start()
    asyncio.get_event_loop().create_task(_broadcast_loop(room_id))


async def _broadcast_loop(room_id: str):
    eng  = _engines[room_id]
    proc = _processors[room_id]
    ctx  = _contexts[room_id]

    for result in eng.results():
        if room_id not in _ws_clients:
            break

        # Context — posture, zone, and zone-aware risk modifier
        last_frame = np.array(result.skeleton, dtype=np.float32)
        ctx_result = ctx.update(last_frame, result.timestamp)

        # Apply zone modifier to fusion score before post-processing
        adjusted_score = float(np.clip(
            result.risk_score + ctx_result.zone_modifier, 0.0, 1.0))

        # Risk state
        state = proc.update(adjusted_score, result.timestamp)

        # 5-second replay buffer (~150 frames at 30fps → keep last 150)
        buf = _replay_buf.setdefault(room_id, [])
        buf.append((len(buf), result.timestamp, result.skeleton))
        if len(buf) > 150:
            buf.pop(0)

        # Alert handling
        alert_id = None
        if state.alert:
            alert_id = insert_alert(
                patient_id  = eng.patient_id,
                room_id     = room_id,
                timestamp   = result.timestamp,
                risk_score  = state.score,
                risk_level  = state.level,
                posture     = ctx_result.posture,
                key_factors = result.key_factors,
            )
            # Save replay
            save_replay_frames(alert_id, buf[-90:])

        # Persist event every window
        insert_event(
            patient_id  = eng.patient_id,
            room_id     = room_id,
            timestamp   = result.timestamp,
            risk_score  = state.score,
            risk_level  = state.level,
            posture     = ctx_result.posture,
            zone        = ctx_result.zone,
            pose_quality= result.pose_quality,
            confidence  = result.risk_score,
            key_factors = result.key_factors,
            alert_id    = alert_id,
        )

        # Build WebSocket message
        msg = {
            "patient_id":  eng.patient_id,
            "room_id":     room_id,
            "timestamp":   datetime.fromtimestamp(
                result.timestamp, tz=timezone.utc).isoformat(),
            "skeleton":    result.skeleton,
            "risk_score":  round(state.score * 100),   # 0–100 for UI
            "risk_level":  state.level,
            "posture":     ctx_result.posture,
            "zone":          ctx_result.zone,
            "zone_modifier": round(ctx_result.zone_modifier, 2),
            "pose_quality":  result.pose_quality,
            "confidence":  round(result.risk_score, 2),
            "key_factors": result.key_factors,
            "stgcn_score": result.stgcn_score,
            "feat_score":  result.feat_score,
            "alert":       state.alert,
            "alert_id":    alert_id,
        }

        # Push to room live clients (dashboard)
        dead = set()
        for ws in list(_ws_clients.get(room_id, set())):
            try:
                await ws.send_json(msg)
            except Exception:
                dead.add(ws)
        _ws_clients[room_id] -= dead

        # Push alerts to Flutter mobile app clients (/ws/alerts)
        if state.alert or (state.level == "MODERATE" and
                           getattr(proc, "_prev_ws_level", "NORMAL") == "NORMAL"):
            pt = get_patient(eng.patient_id)
            alert_msg = {
                "type":         "ALERT",
                "risk_level":   state.level,
                "risk_score":   round(state.score * 100),
                "patient_id":   eng.patient_id,
                "patient_name": pt.get("name") if pt else eng.patient_id,
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
            _ws_alert_clients -= dead_alert
        proc._prev_ws_level = state.level

        await asyncio.sleep(0)   # yield to event loop


# ── REST endpoints ───────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/dashboard/summary")
async def dashboard_summary():
    return get_dashboard_summary()


@app.get("/api/rooms")
async def rooms():
    return get_rooms()


@app.get("/api/patients")
async def patients():
    return get_patients()


@app.get("/api/patients/{patient_id}")
async def patient(patient_id: str):
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    return p


@app.get("/api/patients/{patient_id}/history")
async def patient_history(patient_id: str, limit: int = 100):
    return get_patient_history(patient_id, limit=limit)


@app.get("/api/alerts")
async def alerts(unacked_only: bool = False, limit: int = 100):
    return get_alerts(unacked_only=unacked_only, limit=limit)


class AckBody(BaseModel):
    ack_by: str = "caregiver"


@app.patch("/api/alerts/{alert_id}/acknowledge")
async def ack_alert(alert_id: int, body: AckBody = AckBody()):
    ok = acknowledge_alert(alert_id, ack_by=body.ack_by)
    if not ok:
        raise HTTPException(404, "Alert not found or already acknowledged")
    return {"acknowledged": True, "alert_id": alert_id}


@app.get("/api/events")
async def events(patient_id: str = None, limit: int = 100):
    if patient_id:
        return get_patient_history(patient_id, limit=limit)
    return []


@app.get("/api/events/{alert_id}/replay")
async def replay(alert_id: int):
    frames = get_replay(alert_id)
    if not frames:
        raise HTTPException(404, "No replay data for this alert")
    return {"alert_id": alert_id, "frames": frames}


@app.get("/api/analytics/summary")
async def analytics():
    return get_dashboard_summary()


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
    zones = get_room_zones(room_id)
    return {"room_id": room_id, "zones": zones, "configured": bool(zones)}


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
    _start_room_engine(room_id, source=src, suffix=cfg.suffix)
    return {"room_id": room_id, "source": cfg.source, "status": "started"}


# ── Caregiver endpoints ───────────────────────────────────────────────────────

@app.get("/api/caregivers")
async def list_caregivers():
    return get_caregivers()


class CaregiverBody(BaseModel):
    id:    str
    name:  str
    role:  str = "Nurse"
    phone: str = None
    email: str = None


@app.post("/api/caregivers")
async def add_caregiver(body: CaregiverBody):
    upsert_caregiver(body.id, body.name, body.role, body.phone, body.email)
    return get_caregiver(body.id)


@app.patch("/api/rooms/{room_id}/caregiver")
async def assign_caregiver(room_id: str, caregiver_id: str):
    assign_caregiver_to_room(room_id, caregiver_id)
    return {"room_id": room_id, "caregiver_id": caregiver_id, "status": "assigned"}


# ── Patient management endpoints ──────────────────────────────────────────────

class PatientBody(BaseModel):
    id:      str
    name:    str
    age:     int = None
    gender:  str = None
    room_id: str = None
    bed:     str = None
    notes:   str = None


@app.post("/api/patients")
async def add_patient(body: PatientBody):
    upsert_patient(body.id, body.name, body.age, body.gender,
                   body.room_id, body.bed, body.notes)
    return get_patient(body.id)


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
            # Keep connection alive; data is pushed from _broadcast_loop
            await asyncio.wait_for(websocket.receive_text(), timeout=30)
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
