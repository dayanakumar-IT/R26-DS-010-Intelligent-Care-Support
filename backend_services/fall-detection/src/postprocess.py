"""
Risk post-processor — converts raw per-window fusion scores into stable
Normal / Moderate / High risk states.

Pipeline
--------
raw_score (float 0..1)
    → EMA smoothing
    → dwell-time state machine
    → hysteresis on descent
    → Normal / Moderate / High
    → High-alert cooldown

Usage
-----
    proc = RiskPostProcessor()
    state = proc.update(score=0.72, timestamp=time.time())
    print(state.level)   # "HIGH"
    print(state.score)   # smoothed score
"""
from __future__ import annotations
import time
from dataclasses import dataclass, field
from typing import Optional

from config.settings import (
    RISK_TAU_LOW, RISK_TAU_HIGH, RISK_EMA_ALPHA,
    DWELL_S, ALERT_COOLDOWN_S, ALERT_HIGH_DWELL_S,
    ALERT_MODERATE_COOLDOWN_S, ALERT_MODERATE_DWELL_S,
)


@dataclass
class RiskState:
    level: str            # "NORMAL" | "MODERATE" | "HIGH"
    score: float          # EMA-smoothed score 0..1
    raw_score: float      # un-smoothed model output
    alert: bool            # True when a new HIGH alert should fire (repeats — drives the continuous/repeated beep)
    moderate_alert: bool   # True when a new MODERATE alert should be logged (one-shot per cooldown window — single beep)
    timestamp: float      # wall-clock seconds


class RiskPostProcessor:
    """
    Stateful per-patient risk processor.

    Parameters
    ----------
    ema_alpha       : EMA smoothing factor (0=no smoothing, 1=no memory)
    tau_low         : score threshold for NORMAL→MODERATE transition
    tau_high        : score threshold for MODERATE→HIGH transition
    dwell_s         : dict with dwell seconds for each transition
    alert_cooldown_s: minimum seconds between consecutive HIGH alerts
    """

    def __init__(
        self,
        ema_alpha: float        = RISK_EMA_ALPHA,
        tau_low: float          = RISK_TAU_LOW,
        tau_high: float         = RISK_TAU_HIGH,
        dwell_s: dict           = None,
        alert_cooldown_s: float = ALERT_COOLDOWN_S,
    ):
        self.alpha     = ema_alpha
        self.tau_low   = tau_low
        self.tau_high  = tau_high
        self.dwell     = dwell_s or dict(DWELL_S)
        self.cooldown  = alert_cooldown_s

        # State
        self._ema: float            = 0.0
        self._level: str            = "NORMAL"
        self._level_entry_t: float  = time.time()
        self._last_alert_t: float   = 0.0
        self._last_moderate_alert_t: float = 0.0
        self._initialised: bool     = False
        # Sustained-HIGH counter: counts consecutive inference windows where EMA >= tau_high
        # while in MODERATE state.  HIGH transition only fires when this exceeds the threshold.
        self._sustained_high_count: int = 0
        # At INFER_EVERY_N=3 frames, 25fps → ~8 inferences/sec.
        # Require 25 consecutive above-threshold readings ≈ 3 seconds sustained.
        # Real fall: person on floor 5+ seconds → easily hits 25.
        # Standing spike: decays in <1s, counter resets before reaching 25.
        self._SUSTAINED_HIGH_REQUIRED = 25
        self._last_raw_score: float = 0.0   # track raw score for dual-gate check

    # ------------------------------------------------------------------
    def update(self, score: float, timestamp: Optional[float] = None) -> RiskState:
        """
        Feed one inference score, get back the current risk state.

        Parameters
        ----------
        score     : fusion model fall probability 0..1
        timestamp : wall-clock time (defaults to now)
        """
        now = timestamp if timestamp is not None else time.time()

        # EMA initialisation on first call
        if not self._initialised:
            self._ema = score
            self._level_entry_t = now
            self._initialised = True
        else:
            self._ema = self.alpha * score + (1.0 - self.alpha) * self._ema
        self._last_raw_score = score

        new_level = self._transition(self._ema, now)
        if new_level != self._level:
            self._level = new_level
            self._level_entry_t = now

        alert = self._should_alert(now)
        if alert:
            self._last_alert_t = now

        moderate_alert = self._should_moderate_alert(now)
        if moderate_alert:
            self._last_moderate_alert_t = now

        return RiskState(
            level          = self._level,
            score          = round(self._ema, 4),
            raw_score      = round(score, 4),
            alert          = alert,
            moderate_alert = moderate_alert,
            timestamp      = now,
        )

    # ------------------------------------------------------------------
    def reset(self):
        self._ema                   = 0.0
        self._level                 = "NORMAL"
        self._level_entry_t         = time.time()
        self._last_alert_t          = 0.0
        self._last_moderate_alert_t = 0.0
        self._initialised           = False
        self._sustained_high_count  = 0

    # ------------------------------------------------------------------
    def _dwell_elapsed(self, now: float) -> float:
        return now - self._level_entry_t

    def _transition(self, ema: float, now: float) -> str:
        elapsed = self._dwell_elapsed(now)
        current = self._level

        if current == "NORMAL":
            if ema >= self.tau_low and elapsed >= self.dwell["to_moderate"]:
                self._sustained_high_count = 0   # reset counter entering MODERATE
                return "MODERATE"

        elif current == "MODERATE":
            # Dual gate: BOTH EMA AND raw score must be above tau_high to increment counter.
            # EMA alone can stay high from old accumulated history while raw score has dropped.
            # Raw score alone can spike briefly without accumulating.
            # Both high together = genuine sustained fall signal.
            both_high = (ema >= self.tau_high and self._last_raw_score >= self.tau_high)
            if both_high:
                self._sustained_high_count += 1
            else:
                # Decay counter when either gate fails — brief spikes don't accumulate
                self._sustained_high_count = max(0, self._sustained_high_count - 2)
            if self._sustained_high_count >= self._SUSTAINED_HIGH_REQUIRED:
                return "HIGH"
            # Descend back to NORMAL with hysteresis
            if ema < self.tau_low and elapsed >= self.dwell["to_normal"]:
                self._sustained_high_count = 0
                return "NORMAL"

        elif current == "HIGH":
            # Fast path: score drops well below NORMAL threshold → skip MODERATE, go straight to NORMAL
            fast_to_normal = self.dwell.get("high_to_normal", 1.5)
            if ema < self.tau_low * 0.8 and elapsed >= fast_to_normal:
                self._sustained_high_count = 0
                return "NORMAL"
            # Normal path: score just below HIGH threshold → MODERATE first
            if ema < self.tau_high and elapsed >= self.dwell["to_moderate_from_high"]:
                self._sustained_high_count = 0
                return "MODERATE"

        return current

    def _should_alert(self, now: float) -> bool:
        if self._level != "HIGH":
            return False
        if now - self._last_alert_t < self.cooldown:
            return False
        if self._dwell_elapsed(now) < ALERT_HIGH_DWELL_S:
            return False
        return True

    def _should_moderate_alert(self, now: float) -> bool:
        """
        MODERATE alerts are logged (not just pushed live) so a caregiver who
        was away from their phone can still see them later. Uses a much
        longer cooldown than HIGH — one log entry per sustained episode,
        not a repeating one — matching a single-beep (vs HIGH's repeating
        beep) notification on the caregiver's phone.
        """
        if self._level != "MODERATE":
            return False
        if now - self._last_moderate_alert_t < ALERT_MODERATE_COOLDOWN_S:
            return False
        if self._dwell_elapsed(now) < ALERT_MODERATE_DWELL_S:
            return False
        return True
