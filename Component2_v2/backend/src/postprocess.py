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
)


@dataclass
class RiskState:
    level: str          # "NORMAL" | "MODERATE" | "HIGH"
    score: float        # EMA-smoothed score 0..1
    raw_score: float    # un-smoothed model output
    alert: bool         # True when a new HIGH alert should fire
    timestamp: float    # wall-clock seconds


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
        self._initialised: bool     = False

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

        new_level = self._transition(self._ema, now)
        if new_level != self._level:
            self._level = new_level
            self._level_entry_t = now

        alert = self._should_alert(now)
        if alert:
            self._last_alert_t = now

        return RiskState(
            level     = self._level,
            score     = round(self._ema, 4),
            raw_score = round(score, 4),
            alert     = alert,
            timestamp = now,
        )

    # ------------------------------------------------------------------
    def reset(self):
        self._ema           = 0.0
        self._level         = "NORMAL"
        self._level_entry_t = time.time()
        self._last_alert_t  = 0.0
        self._initialised   = False

    # ------------------------------------------------------------------
    def _dwell_elapsed(self, now: float) -> float:
        return now - self._level_entry_t

    def _transition(self, ema: float, now: float) -> str:
        elapsed = self._dwell_elapsed(now)
        current = self._level

        if current == "NORMAL":
            if ema >= self.tau_low and elapsed >= self.dwell["to_moderate"]:
                return "MODERATE"

        elif current == "MODERATE":
            if ema >= self.tau_high and elapsed >= self.dwell["to_high"]:
                return "HIGH"
            # Descend back to NORMAL with hysteresis
            if ema < self.tau_low and elapsed >= self.dwell["to_normal"]:
                return "NORMAL"

        elif current == "HIGH":
            if ema < self.tau_high and elapsed >= self.dwell["to_moderate_from_high"]:
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
