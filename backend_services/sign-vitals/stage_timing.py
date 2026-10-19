"""
stage_timing.py
GLOSS component — timing instrumentation for POST /gloss/attempts
(speed brief, Step 1: measuring only). Changes no result.

  - TimedDb: wraps the Supabase client for one request and records how
    long each .execute() / auth.get_user() round trip took, labelled
    "<table>.<operation>".
  - instrument_grading(): when GLOSS_TIMING_DETAIL=1, splits the
    recognition + DTW stage into feature building, model inference,
    repetition isolation and DTW grading, and times the Gemini call.
    It wraps functions from the outside; grading.py and the gloss_assets
    files are not edited. Off by default.
"""

import os
import threading
import time
from functools import wraps

_OPS = ("select", "insert", "upsert", "update", "delete")
_local = threading.local()


def _ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 1)


class _TimedQuery:
    """Forwards everything to a query builder; times execute()."""

    def __init__(self, inner, label: str, calls: list):
        self._inner, self._label, self._calls = inner, label, calls

    def __getattr__(self, name):
        attr = getattr(self._inner, name)
        if name == "execute":
            @wraps(attr)
            def run(*args, **kwargs):
                start = time.perf_counter()
                try:
                    return attr(*args, **kwargs)
                finally:
                    self._calls.append({"call": self._label, "ms": _ms(start)})
            return run
        if not callable(attr):
            return attr

        @wraps(attr)
        def chain(*args, **kwargs):
            out = attr(*args, **kwargs)
            if hasattr(out, "execute"):
                label = f"{self._label}.{name}" if name in _OPS else self._label
                return _TimedQuery(out, label, self._calls)
            return out
        return chain


class _TimedAuth:
    def __init__(self, inner, calls: list):
        self._inner, self._calls = inner, calls

    def get_user(self, *args, **kwargs):
        start = time.perf_counter()
        try:
            return self._inner.get_user(*args, **kwargs)
        finally:
            self._calls.append({"call": "auth.get_user", "ms": _ms(start)})

    def __getattr__(self, name):
        return getattr(self._inner, name)


class TimedDb:
    """One request's Supabase client; `calls` lists every round trip."""

    def __init__(self, client, calls: list | None = None):
        self._client = client
        self.calls = [] if calls is None else calls

    def table(self, name):
        return _TimedQuery(self._client.table(name), name, self.calls)

    @property
    def auth(self):
        return _TimedAuth(self._client.auth, self.calls)

    def __getattr__(self, name):
        return getattr(self._client, name)


def db_summary(calls: list) -> dict:
    """{"supabase_total_ms", "supabase_calls": [{"call", "ms"}, ...]}"""
    return {"supabase_total_ms": round(sum(c["ms"] for c in calls), 1), "supabase_calls": list(calls)}


# ---------- optional detail inside recognition + DTW ----------

def detail_enabled() -> bool:
    return os.environ.get("GLOSS_TIMING_DETAIL") == "1"


def start_detail() -> None:
    _local.detail = {}


def take_detail() -> dict:
    out = getattr(_local, "detail", None) or {}
    _local.detail = None
    return out


def _timed(fn, key: str):
    @wraps(fn)
    def inner(*args, **kwargs):
        start = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            detail = getattr(_local, "detail", None)
            if detail is not None:
                detail[key] = round(detail.get(key, 0.0) + (time.perf_counter() - start) * 1000, 1)
    return inner


_instrumented = False


def instrument_grading() -> None:
    """Wrap the grading steps with timers (only if GLOSS_TIMING_DETAIL=1).
    Same functions, same arguments, same return values."""
    global _instrumented
    if _instrumented or not detail_enabled():
        return
    import execution_evaluator
    import gemini_feedback
    import grading

    grading.features_from_normalized = _timed(grading.features_from_normalized, "features_ms")
    grading.predict_probs = _timed(grading.predict_probs, "inference_ms")
    grading.isolate_best_attempt = _timed(grading.isolate_best_attempt, "isolate_repetition_dtw_ms")
    grading.evaluate_attempt = _timed(grading.evaluate_attempt, "dtw_grading_ms")
    execution_evaluator.generate_feedback = _timed(execution_evaluator.generate_feedback, "rule_feedback_ms")
    gemini_feedback.call_gemini = _timed(gemini_feedback.call_gemini, "gemini_call_ms")
    _instrumented = True
