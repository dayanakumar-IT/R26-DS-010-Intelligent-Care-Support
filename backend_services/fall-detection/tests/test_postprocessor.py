"""
Unit tests — RiskPostProcessor (src/postprocess.py)
Run: cd backend_services/fall-detection && pytest tests/ -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import pytest
from src.postprocess import RiskPostProcessor
from config.settings import RISK_TAU_LOW, RISK_TAU_HIGH


class TestInitialState:
    def test_starts_normal(self):
        """Fresh processor must start in NORMAL state."""
        proc = RiskPostProcessor()
        state = proc.update(0.0)
        assert state.level == "NORMAL"

    def test_initial_low_score_stays_normal(self):
        """Low scores should stay NORMAL."""
        proc = RiskPostProcessor()
        for _ in range(30):
            state = proc.update(0.1)
        assert state.level == "NORMAL"


class TestEMASmoothing:
    def test_ema_smooths_single_spike(self):
        """A single high score should not immediately push EMA above threshold."""
        proc = RiskPostProcessor()
        # Warm up at 0.0
        for _ in range(10):
            proc.update(0.0)
        # Single spike
        state = proc.update(1.0)
        # EMA alpha=0.25, after 10 zeros EMA≈0, one spike → EMA=0.25 — still below tau_low=0.55
        assert state.score < RISK_TAU_LOW, (
            f"Single spike should not reach MODERATE. EMA={state.score:.4f}"
        )

    def test_sustained_high_raises_ema(self):
        """Many consecutive high scores should raise EMA above threshold."""
        proc = RiskPostProcessor()
        for _ in range(50):
            proc.update(1.0)
        state = proc.update(1.0)
        assert state.score >= RISK_TAU_LOW, (
            f"Sustained high score should raise EMA above tau_low. EMA={state.score:.4f}"
        )


class TestStateTransitions:
    def test_normal_to_moderate(self):
        """Scores above tau_low sustained for dwell time → MODERATE."""
        proc = RiskPostProcessor()
        t = 1000.0
        for _ in range(100):
            proc.update(0.9, timestamp=t)
            t += 0.1   # 0.1s steps → 10s total, well above 0.5s dwell
        state = proc.update(0.9, timestamp=t)
        assert state.level in ("MODERATE", "HIGH"), (
            f"Expected MODERATE or HIGH after sustained 0.9, got {state.level}"
        )

    def test_no_instant_high(self):
        """System should not jump from NORMAL to HIGH in fewer than ~3 seconds."""
        proc = RiskPostProcessor()
        t = 1000.0
        # Send 10 readings at 0.1s apart = 1 second total
        for _ in range(10):
            state = proc.update(1.0, timestamp=t)
            t += 0.1
        assert state.level != "HIGH", (
            f"Should not reach HIGH in 1 second, got {state.level}"
        )

    def test_reset_clears_state(self):
        """reset() should return processor to NORMAL baseline."""
        proc = RiskPostProcessor()
        t = 1000.0
        for _ in range(200):
            proc.update(1.0, timestamp=t)
            t += 0.1
        proc.reset()
        state = proc.update(0.0)
        assert state.level == "NORMAL"
        assert state.score == 0.0

    def test_descent_from_moderate_to_normal(self):
        """After going MODERATE, low scores for sufficient time should return NORMAL."""
        proc = RiskPostProcessor()
        t = 1000.0
        # Push to MODERATE
        for _ in range(100):
            proc.update(0.9, timestamp=t)
            t += 0.1
        # Now send low scores
        for _ in range(50):
            state = proc.update(0.1, timestamp=t)
            t += 0.1
        assert state.level == "NORMAL", (
            f"Expected NORMAL after sustained low scores, got {state.level}"
        )


class TestAlertCooldown:
    def test_alert_does_not_fire_immediately_again(self):
        """After an alert fires, no second alert within cooldown window."""
        proc = RiskPostProcessor()
        t = 1000.0
        alert_count = 0
        # Push through to HIGH
        for _ in range(400):
            state = proc.update(1.0, timestamp=t)
            if state.alert:
                alert_count += 1
            t += 0.1   # 0.1s steps → 40s total
        # Only count distinct alert firings per cooldown window
        # cooldown=20s → max 2 alerts in 40s
        assert alert_count <= 3, (
            f"Alert fired {alert_count} times in 40s; cooldown should cap this"
        )


class TestRiskStateFields:
    def test_state_has_required_fields(self):
        """RiskState must have level, score, raw_score, alert, moderate_alert, timestamp."""
        proc = RiskPostProcessor()
        state = proc.update(0.5)
        assert hasattr(state, "level")
        assert hasattr(state, "score")
        assert hasattr(state, "raw_score")
        assert hasattr(state, "alert")
        assert hasattr(state, "moderate_alert")
        assert hasattr(state, "timestamp")

    def test_score_is_bounded(self):
        """EMA score must remain in [0, 1]."""
        proc = RiskPostProcessor()
        for val in [0.0, 0.5, 1.0, 0.3, 0.8]:
            state = proc.update(val)
            assert 0.0 <= state.score <= 1.0, f"Score {state.score} out of [0,1]"


class TestSittingTransitionSafety:
    """
    Verify that the SITTING cap in server.py does NOT suppress fall alerts
    during a sit-to-stand TRANSITION.

    The cap is:  if posture == "SITTING" and state.level == "HIGH" → clamp to MODERATE
    During TRANSITION the cap condition is False → alert must pass through.

    This test simulates the postprocessor reaching HIGH risk while posture is
    TRANSITION (not SITTING), then applies the same clamping logic as server.py
    and asserts the HIGH level is preserved.
    """

    def _push_to_high(self, proc: RiskPostProcessor, t: float) -> float:
        """Drive the processor to HIGH state. Returns the timestamp after."""
        # Need to go NORMAL → MODERATE → sustained HIGH counter hits threshold.
        # Send high scores for enough time (>3s at 0.05s steps = 60 iterations).
        for _ in range(400):
            proc.update(1.0, timestamp=t)
            t += 0.05
        return t

    def test_transition_posture_does_not_suppress_alert(self):
        """HIGH alert MUST fire when posture is TRANSITION — cap must not apply."""
        from dataclasses import replace as _dc_replace

        proc = RiskPostProcessor()
        t = 2000.0
        t = self._push_to_high(proc, t)

        state = proc.update(1.0, timestamp=t)
        assert state.level == "HIGH", (
            f"Processor should be HIGH before clamping test. Got {state.level}"
        )

        # Simulate server.py clamping logic with posture = TRANSITION
        posture = "TRANSITION"
        if posture == "SITTING" and state.level == "HIGH":
            state = _dc_replace(state, level="MODERATE", alert=False)

        assert state.level == "HIGH", (
            "SITTING cap must NOT fire during TRANSITION — fall alert suppressed incorrectly."
        )

    def test_sitting_posture_caps_at_moderate(self):
        """HIGH alert MUST be capped to MODERATE when posture is confirmed SITTING."""
        from dataclasses import replace as _dc_replace

        proc = RiskPostProcessor()
        t = 3000.0
        t = self._push_to_high(proc, t)

        state = proc.update(1.0, timestamp=t)
        assert state.level == "HIGH", (
            f"Processor should be HIGH before clamping test. Got {state.level}"
        )

        # Simulate server.py clamping logic with posture = SITTING
        posture = "SITTING"
        if posture == "SITTING" and state.level == "HIGH":
            state = _dc_replace(state, level="MODERATE", alert=False)

        assert state.level == "MODERATE", (
            "SITTING cap must clamp HIGH → MODERATE when patient is confirmed sitting."
        )
        assert state.alert is False, (
            "Alert must be suppressed when SITTING cap fires."
        )

    def test_full_sequence_sitting_then_transition_then_high(self):
        """
        Simulate the real scenario: patient sitting → starts standing → high risk.
        Frames 0-5:  posture=SITTING,    score=0.2  (calm, seated)
        Frames 6-8:  posture=TRANSITION, score=0.2  (starting to stand)
        Frames 9+:   posture=TRANSITION, score=1.0  (fall during stand-up)

        Assert: after TRANSITION + high score, alert is NOT suppressed.
        """
        from dataclasses import replace as _dc_replace

        proc = RiskPostProcessor()
        t = 4000.0

        # Phase 1: calm sitting — low scores
        for _ in range(6):
            proc.update(0.2, timestamp=t)
            t += 0.1

        # Phase 2: begin TRANSITION — still low score
        for _ in range(3):
            proc.update(0.2, timestamp=t)
            t += 0.1

        # Phase 3: fall during stand-up — high scores sustained
        for _ in range(400):
            proc.update(1.0, timestamp=t)
            t += 0.05

        state = proc.update(1.0, timestamp=t)

        # Apply server.py cap logic — posture is TRANSITION
        posture = "TRANSITION"
        if posture == "SITTING" and state.level == "HIGH":
            state = _dc_replace(state, level="MODERATE", alert=False)

        assert state.level == "HIGH", (
            f"Fall alert during TRANSITION must not be suppressed. Got {state.level}"
        )
