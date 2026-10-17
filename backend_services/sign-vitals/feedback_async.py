"""
feedback_async.py
GLOSS component — the guarded Gemini rewording, off the attempt's critical
path.

The attempt response is sent with the rule-based feedback text straight
away; the rewording (gemini_feedback.feedback_text, same guard, same
fallback) runs in the background. When it produces a different, accepted
text it is saved on the attempt row and kept here for a few minutes, and the
app swaps it in (GET /gloss/attempts/{id}/feedback). If Gemini is not
configured, fails, times out or is rejected by the guard, the rule text
simply stays.
"""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger("sign_vitals")

KEEP_SECONDS = 600
_jobs: dict[str, dict] = {}
_lock = threading.Lock()
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="gloss-gemini")


def gemini_available() -> bool:
    try:
        from gemini_feedback import _get_client
        return _get_client() is not None
    except Exception:
        return False


def start(db, attempt_id: str, caregiver_profile_id: str, grading_result: dict, base: dict,
          corrective_feedback: dict) -> bool:
    """Queue the rewording for one stored attempt. Returns True if queued."""
    if not gemini_available():
        return False
    with _lock:
        now = time.monotonic()
        for k in [k for k, v in _jobs.items() if now - v["at"] > KEEP_SECONDS]:
            _jobs.pop(k, None)
        _jobs[str(attempt_id)] = {"caregiver": caregiver_profile_id, "status": "pending", "summary": None, "at": now}
    _pool.submit(_run, db, str(attempt_id), grading_result, base, dict(corrective_feedback))
    return True


def _run(db, attempt_id, grading_result, base, corrective_feedback):
    from gemini_feedback import feedback_text
    rule_text = base["full_text"]
    status, text = "unchanged", rule_text
    try:
        text = feedback_text(grading_result, base)
        if text and text != rule_text:
            db.table("gloss_attempts").update({"corrective_feedback": {**corrective_feedback, "summary": text}}) \
                .eq("id", attempt_id).execute()
            status = "ready"
    except Exception:
        logger.exception("[GLOSS][FEEDBACK] background rewording failed — rule text kept")
    with _lock:
        if attempt_id in _jobs:
            _jobs[attempt_id].update(status=status, summary=text if status == "ready" else None)


def get(attempt_id: str, caregiver_profile_id: str) -> dict:
    """{"status": "pending" | "ready" | "unchanged", "summary": str | None}; only the owner sees it."""
    with _lock:
        job = _jobs.get(str(attempt_id))
        if not job or job["caregiver"] != caregiver_profile_id:
            return {"status": "unchanged", "summary": None}
        return {"status": job["status"], "summary": job["summary"]}
