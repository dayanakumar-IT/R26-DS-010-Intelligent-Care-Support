"""
Context engine — posture classification, room-zone mapping, and
zone-aware risk modifier.

Posture states: STANDING | SITTING | LYING | WALKING | TRANSITION | UNKNOWN
Room zones:     supervisor-drawn polygons in normalised [0,1] image coordinates.

Zone-aware risk modifier
------------------------
Each zone has a different fall pattern. The modifier is added to the raw
fusion score before post-processing so the system is more sensitive in
the right places:

  BED zone    — rolling off, falling from edge (SITTING/LYING → drop)
  CHAIR zone  — tipping sideways, sliding forward (SITTING → lateral/forward lean)
  WALKING zone— slip/trip (model already handles; no modifier needed)
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from config.settings import JOINT


_VIS_THRESH  = 0.3    # minimum visibility to trust a joint
_WALK_SPEED  = 0.15   # torso-lengths/s ankle speed → walking
_TRANS_TTL   = 0.25   # seconds a TRANSITION label persists — long enough to gate HIGH during real falls

# Lateral lean threshold (degrees shoulder tilt) to flag sideways instability
_LATERAL_LEAN_THRESH = 12.0
# Forward lean threshold (torso angle deg from vertical) to flag forward instability
_FORWARD_LEAN_THRESH = 35.0


@dataclass
class ContextResult:
    posture:       str    # STANDING | SITTING | LYING | WALKING | TRANSITION | UNKNOWN
    zone:          str    # BED | CHAIR | WALKING | UNKNOWN
    zone_modifier: float  # additive risk boost based on zone+posture context
    timestamp:     float


def _vis(frame: np.ndarray, j: int) -> bool:
    return float(frame[j, 3]) >= _VIS_THRESH

def _xyz(frame: np.ndarray, j: int) -> np.ndarray:
    return frame[j, :3]

def _torso_angle_deg(frame: np.ndarray) -> Optional[float]:
    neck  = JOINT["neck"]
    l_hip = JOINT["l_hip"]; r_hip = JOINT["r_hip"]
    if not (_vis(frame, neck) and _vis(frame, l_hip) and _vis(frame, r_hip)):
        return None
    hip_mid = (_xyz(frame, l_hip) + _xyz(frame, r_hip)) / 2.0
    torso   = _xyz(frame, neck) - hip_mid
    norm    = np.linalg.norm(torso)
    if norm < 1e-4:
        return None
    # Negate y: image coords have y increasing downward,
    # so for standing person torso_y is negative — flip to get correct angle from vertical
    cos_a = float(np.clip(-(torso / norm)[1], -1.0, 1.0))
    return float(np.degrees(np.arccos(cos_a)))

def _lateral_lean_deg(frame: np.ndarray) -> Optional[float]:
    """Shoulder tilt angle from horizontal — detects sideways lean."""
    ls = JOINT["l_shoulder"]; rs = JOINT["r_shoulder"]
    if not (_vis(frame, ls) and _vis(frame, rs)):
        return None
    delta = _xyz(frame, ls) - _xyz(frame, rs)
    return float(abs(np.degrees(np.arctan2(abs(delta[1]), abs(delta[0]) + 1e-6))))


def _hip_to_knee_y(frame: np.ndarray) -> Optional[float]:
    """Return hip_y - knee_y in normalised image coords (Y increases downward).
    SITTING: hips and knees at similar heights → value close to 0 (slightly negative).
    STANDING: hips well above knees → large negative (e.g. −0.15 to −0.25).
    """
    jts = [JOINT["l_hip"], JOINT["r_hip"], JOINT["l_knee"], JOINT["r_knee"]]
    if not all(_vis(frame, j) for j in jts):
        return None
    hip_y  = (_xyz(frame, JOINT["l_hip"])[1]  + _xyz(frame, JOINT["r_hip"])[1])  / 2.0
    knee_y = (_xyz(frame, JOINT["l_knee"])[1] + _xyz(frame, JOINT["r_knee"])[1]) / 2.0
    return float(hip_y - knee_y)

def _point_in_polygon(pt: Tuple[float, float],
                      poly: List[Tuple[float, float]]) -> bool:
    x, y   = pt
    inside = False
    n = len(poly); j = n - 1
    for i in range(n):
        xi, yi = poly[i]; xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


class ContextEngine:
    def __init__(self):
        self._zones: Dict[str, List[Tuple[float, float]]] = {}
        self._prev_posture: str = "UNKNOWN"
        self._prev_ank:  Optional[np.ndarray] = None
        self._prev_t:    float = 0.0
        self._trans_until: float = 0.0

    def configure_zones(self, zones: Dict[str, List[Tuple[float, float]]]):
        """Set room zones as polygons in normalised [0,1] image coordinates."""
        self._zones = zones

    def update(self, frame: np.ndarray,
               timestamp: Optional[float] = None) -> ContextResult:
        """
        frame: (14, 4) single skeleton frame after clip normalisation.
        Returns ContextResult with posture, zone, and zone_modifier.
        """
        now      = timestamp if timestamp is not None else time.time()
        posture  = self._classify_posture(frame, now)
        zone     = self._classify_zone(frame)
        modifier = self._zone_risk_modifier(frame, zone, posture)
        self._prev_posture = posture
        self._prev_t       = now
        return ContextResult(posture=posture, zone=zone,
                             zone_modifier=modifier, timestamp=now)

    # ------------------------------------------------------------------ #
    def _classify_posture(self, frame: np.ndarray, now: float) -> str:
        angle = _torso_angle_deg(frame)
        h2k   = _hip_to_knee_y(frame)

        if angle is None:
            return "UNKNOWN"

        if angle > 75.0:
            posture = "LYING"
        elif h2k is not None and h2k > -0.06 and angle < 50.0:
            # SITTING: hips roughly level with knees (h2k near 0, slightly negative at most).
            # STANDING has hips well above knees → h2k ≈ −0.15 to −0.25 → excluded here.
            # Threshold −0.06 gives a 6 cm normalised margin for slouched-sit noise.
            posture = "SITTING"
        else:
            # Determine walking via ankle velocity
            l_ank = JOINT["l_ankle"]; r_ank = JOINT["r_ankle"]
            ank = None
            if _vis(frame, l_ank) and _vis(frame, r_ank):
                ank = (_xyz(frame, l_ank) + _xyz(frame, r_ank)) / 2.0
            walking = False
            if ank is not None and self._prev_ank is not None and self._prev_t > 0:
                dt = now - self._prev_t
                if dt > 1e-4:
                    walking = np.linalg.norm(ank - self._prev_ank) / dt > _WALK_SPEED
            self._prev_ank = ank
            posture = "WALKING" if walking else "STANDING"

        if posture != self._prev_posture and self._prev_posture != "UNKNOWN":
            self._trans_until = now + _TRANS_TTL
        if now < self._trans_until:
            return "TRANSITION"
        return posture

    def _classify_zone(self, frame: np.ndarray) -> str:
        if not self._zones:
            return "UNKNOWN"
        l_hip = JOINT["l_hip"]; r_hip = JOINT["r_hip"]
        if not (_vis(frame, l_hip) and _vis(frame, r_hip)):
            return "UNKNOWN"
        hip  = (_xyz(frame, l_hip) + _xyz(frame, r_hip)) / 2.0
        pt   = (float(hip[0]), float(hip[1]))
        for name, poly in self._zones.items():
            if _point_in_polygon(pt, poly):
                return name
        return "UNKNOWN"

    def _zone_risk_modifier(self, frame: np.ndarray,
                            zone: str, posture: str) -> float:
        """
        Returns an additive score modifier (0.0–0.25) based on zone+posture.
        Added to the fusion model score before post-processing.

        BED zone scenarios
        ------------------
        - Rolling off bed:     LYING + lateral shoulder tilt  → +0.20
        - Falling from edge:   SITTING + lateral lean          → +0.20
        - Collapse getting up: TRANSITION from bed             → +0.15

        CHAIR zone scenarios
        --------------------
        - Tipping sideways:    SITTING + lateral lean > thresh → +0.20
        - Sliding forward:     SITTING + forward lean > thresh → +0.15
        - Standing and falling:TRANSITION in chair zone        → +0.12

        WALKING zone
        ------------
        Model already trained on slip/trip patterns — no modifier needed.
        """
        if zone == "UNKNOWN":
            return 0.0

        lateral = _lateral_lean_deg(frame)
        torso   = _torso_angle_deg(frame)
        lateral_instability = (lateral is not None and
                               lateral > _LATERAL_LEAN_THRESH)
        forward_instability = (torso is not None and
                               torso > _FORWARD_LEAN_THRESH)

        if zone == "BED":
            if posture == "LYING" and lateral_instability:
                return 0.20   # rolling off bed
            if posture == "SITTING" and lateral_instability:
                return 0.20   # falling from bed edge
            if posture == "TRANSITION":
                return 0.15   # getting up from bed — highest-risk moment
            if posture == "SITTING":
                return 0.08   # sitting on bed edge — lower baseline boost

        if zone == "CHAIR":
            if posture == "SITTING" and lateral_instability:
                return 0.20   # tipping sideways off chair
            if posture == "SITTING" and forward_instability:
                return 0.15   # sliding/leaning forward off chair
            if posture == "TRANSITION":
                return 0.12   # standing up from chair
            if posture == "SITTING":
                return 0.05   # sitting in chair — small baseline boost

        # WALKING zone — model handles slip/trip well, no modifier
        return 0.0
