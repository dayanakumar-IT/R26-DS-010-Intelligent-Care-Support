"""
pdedu_quiz_service.py
Parkinson's-Disease EDUcation (pdedu_) — the gamified Symptom Trainer
quiz: fixed-length sessions, XP, streaks, per-symptom progress, and an
end-of-session summary with review of incorrect answers.

This is caregiver EDUCATION — symptom-recognition training through
text and video multiple-choice questions. It is NOT a diagnostic tool
and it does NOT diagnose Parkinson's disease. Scores are "Quiz Score"
/ "Recognition Accuracy in Training", never diagnostic accuracy.

Correctness is ALWAYS decided here on the server from
pdedu_questions.symptom_id — never trusted from the client, never sent
to the client before an answer is submitted.

Runs alongside the older infinite adaptive quiz (pdedu_responses,
select_next_question) without disturbing it — record_answer() also
writes a pdedu_responses row so pdedu_confusion_pairs keeps working.

Independent of any HTTP endpoint — plain functions, callable directly.
"""

import logging
import random
from datetime import datetime, timezone

from pdedu_mastery_engine import update_mastery as pdedu_update_mastery
from pdedu_video import usable_video_symptom_ids

logger = logging.getLogger("sign_vitals")

QUIZ_LENGTH = 10
TARGET_VIDEO_QUESTIONS = 5
XP_TEXT_CORRECT = 10
XP_VIDEO_CORRECT = 15


class QuizError(Exception):
    """Caller-facing quiz problem. status_code maps straight to an
    HTTPException in main.py."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


# ------------------------------------------------------------
# helpers
# ------------------------------------------------------------
def _shuffled_choices(choices: list[dict]) -> list[dict]:
    out = [{"symptom_id": c["symptom_id"], "label": c["label"]} for c in choices]
    random.shuffle(out)
    return out


def _public_question(row: dict) -> dict:
    """The client-safe shape of a question — no correct answer, no
    answer flag, and for video questions no symptom_id (the clip is
    fetched by question id so the symptom is never revealed)."""
    return {
        "question_id": row["id"],
        "format": row["format"],
        "question_type": row["question_type"],
        "prompt": row["prompt"],
        "choices": _shuffled_choices(row["choices"]),
        "has_video": row["format"] == "video",
    }


def _streaks(flags: list[bool]) -> tuple[int, int]:
    """(current trailing streak, best streak) over an ordered list of
    is_correct flags."""
    best = run = current = 0
    for ok in flags:
        if ok:
            run += 1
            best = max(best, run)
        else:
            run = 0
    # current trailing streak
    for ok in reversed(flags):
        if ok:
            current += 1
        else:
            break
    return current, best


def _recompute_session(supabase_client, session_id: str) -> dict:
    attempts = (
        supabase_client.table("pdedu_quiz_attempts")
        .select("is_correct, xp_awarded, answered_at")
        .eq("session_id", session_id)
        .order("answered_at")
        .execute()
    )
    rows = attempts.data or []
    flags = [bool(r["is_correct"]) for r in rows]
    current_streak, best_streak = _streaks(flags)
    totals = {
        "answered": len(rows),
        "correct_answers": sum(flags),
        "xp_earned": sum(int(r["xp_awarded"]) for r in rows),
        "current_streak": current_streak,
        "best_streak": best_streak,
    }
    supabase_client.table("pdedu_quiz_sessions").update(
        {
            "correct_answers": totals["correct_answers"],
            "xp_earned": totals["xp_earned"],
            "best_streak": totals["best_streak"],
        }
    ).eq("id", session_id).execute()
    return totals


def _load_owned_session(supabase_client, caregiver_profile_id: str, session_id: str) -> dict:
    result = (
        supabase_client.table("pdedu_quiz_sessions")
        .select("*")
        .eq("id", session_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise QuizError(404, f"Unknown session_id: {session_id!r}")
    session = result.data[0]
    if session["caregiver_profile_id"] != caregiver_profile_id:
        raise QuizError(403, "This quiz session belongs to another caregiver")
    return session


# ------------------------------------------------------------
# start
# ------------------------------------------------------------
def start_session(supabase_client, caregiver_profile_id: str) -> dict:
    """Creates a session and returns ~10 questions in random order,
    mixing video and text. Aims for 5 video / 5 text but adapts down
    to however many symptoms actually have a usable video — never
    serves a video question for a missing clip."""
    session_insert = (
        supabase_client.table("pdedu_quiz_sessions")
        .insert({"caregiver_profile_id": caregiver_profile_id})
        .execute()
    )
    session_id = session_insert.data[0]["id"]

    all_questions = (
        supabase_client.table("pdedu_questions")
        .select("id, symptom_id, question_type, format, prompt, choices")
        .eq("is_active", True)
        .execute()
    ).data or []

    text_pool = [q for q in all_questions if q.get("format", "text") == "text"]
    video_pool = [q for q in all_questions if q.get("format") == "video"]

    video_symptoms = usable_video_symptom_ids(supabase_client)
    eligible_video = [q for q in video_pool if q["symptom_id"] in video_symptoms]

    n_video = min(TARGET_VIDEO_QUESTIONS, len(eligible_video), QUIZ_LENGTH)
    chosen_video = random.sample(eligible_video, n_video) if n_video else []

    remaining = QUIZ_LENGTH - len(chosen_video)
    chosen_text = random.sample(text_pool, min(remaining, len(text_pool))) if remaining else []

    # If the text bank is small, top up with any leftover video questions.
    if len(chosen_video) + len(chosen_text) < QUIZ_LENGTH:
        leftover_video = [q for q in eligible_video if q not in chosen_video]
        need = QUIZ_LENGTH - len(chosen_video) - len(chosen_text)
        chosen_video += random.sample(leftover_video, min(need, len(leftover_video)))

    questions = chosen_video + chosen_text
    random.shuffle(questions)

    supabase_client.table("pdedu_quiz_sessions").update(
        {"total_questions": len(questions)}
    ).eq("id", session_id).execute()

    logger.info(
        "[PDEDU][QUIZ] quiz started | caregiver=%s | session=%s | video=%d | text=%d",
        str(caregiver_profile_id)[:8], str(session_id)[:8], len(chosen_video), len(chosen_text),
    )

    return {
        "session_id": session_id,
        "total_questions": len(questions),
        "questions": [_public_question(q) for q in questions],
    }


# ------------------------------------------------------------
# answer
# ------------------------------------------------------------
def record_answer(
    supabase_client,
    caregiver_profile_id: str,
    session_id: str,
    question_id: str,
    selected_symptom_id: str,
) -> dict:
    session = _load_owned_session(supabase_client, caregiver_profile_id, session_id)
    if session.get("completed_at"):
        raise QuizError(409, "This quiz session is already complete")

    already = (
        supabase_client.table("pdedu_quiz_attempts")
        .select("id")
        .eq("session_id", session_id)
        .eq("question_id", question_id)
        .limit(1)
        .execute()
    )
    if already.data:
        raise QuizError(409, "This question has already been answered in this session")

    question_result = (
        supabase_client.table("pdedu_questions")
        .select("id, symptom_id, choices, extra_fact, tip, format")
        .eq("id", question_id)
        .limit(1)
        .execute()
    )
    if not question_result.data:
        raise QuizError(400, f"Unknown question_id: {question_id!r}")
    question = question_result.data[0]

    choice_symptom_ids = {c["symptom_id"] for c in question["choices"]}
    if selected_symptom_id not in choice_symptom_ids:
        raise QuizError(400, "selected_symptom_id is not one of this question's choices")

    correct_symptom_id = question["symptom_id"]
    is_correct = selected_symptom_id == correct_symptom_id
    xp_awarded = 0
    if is_correct:
        xp_awarded = XP_VIDEO_CORRECT if question["format"] == "video" else XP_TEXT_CORRECT

    supabase_client.table("pdedu_quiz_attempts").insert(
        {
            "session_id": session_id,
            "caregiver_profile_id": caregiver_profile_id,
            "question_id": question_id,
            "symptom_id": correct_symptom_id,
            "selected_symptom_id": selected_symptom_id,
            "correct_symptom_id": correct_symptom_id,
            "is_correct": is_correct,
            "xp_awarded": xp_awarded,
        }
    ).execute()

    # Keep the older adaptive quiz's data current (pdedu_confusion_pairs
    # reads pdedu_responses) — same write the legacy endpoint does.
    supabase_client.table("pdedu_responses").insert(
        {
            "caregiver_profile_id": caregiver_profile_id,
            "question_id": question_id,
            "selected_symptom_id": selected_symptom_id,
            "is_correct": is_correct,
        }
    ).execute()

    mastery_row = pdedu_update_mastery(
        supabase_client, caregiver_profile_id, correct_symptom_id, is_correct
    )

    totals = _recompute_session(supabase_client, session_id)

    # Opportunistically keep pdedu_caregiver_mastery.best_streak fresh
    # for the symptom just tested, using this session's run on it.
    _update_symptom_best_streak(supabase_client, caregiver_profile_id, session_id, correct_symptom_id)

    symptom = (
        supabase_client.table("pdedu_symptoms")
        .select("display_name, learning_tip, memory_trick")
        .eq("id", correct_symptom_id)
        .limit(1)
        .execute()
    ).data[0]

    logger.info(
        "[PDEDU][QUIZ] answer evaluated | session=%s | question=%s | is_correct=%s | xp=%d | streak=%d",
        str(session_id)[:8], str(question_id)[:8], is_correct, xp_awarded, totals["current_streak"],
    )

    return {
        "is_correct": is_correct,
        "correct_symptom_id": correct_symptom_id,
        "correct_answer": symptom["display_name"],
        "explanation": question["extra_fact"],
        "tip": question.get("tip") or symptom.get("learning_tip"),
        "memory_trick": symptom.get("memory_trick"),
        "xp_awarded": xp_awarded,
        "current_streak": totals["current_streak"],
        "best_streak": totals["best_streak"],
        "answered": totals["answered"],
        "correct_answers": totals["correct_answers"],
        "xp_earned": totals["xp_earned"],
        "mastery_score": mastery_row["mastery_score"],
    }


def _update_symptom_best_streak(supabase_client, caregiver_profile_id, session_id, symptom_id) -> None:
    attempts = (
        supabase_client.table("pdedu_quiz_attempts")
        .select("is_correct, answered_at")
        .eq("session_id", session_id)
        .eq("symptom_id", symptom_id)
        .order("answered_at")
        .execute()
    ).data or []
    _, best_this_session = _streaks([bool(a["is_correct"]) for a in attempts])

    existing = (
        supabase_client.table("pdedu_caregiver_mastery")
        .select("id, best_streak")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .eq("symptom_id", symptom_id)
        .limit(1)
        .execute()
    ).data
    if existing and best_this_session > (existing[0].get("best_streak") or 0):
        supabase_client.table("pdedu_caregiver_mastery").update(
            {"best_streak": best_this_session}
        ).eq("id", existing[0]["id"]).execute()


# ------------------------------------------------------------
# complete
# ------------------------------------------------------------
def complete_session(supabase_client, caregiver_profile_id: str, session_id: str) -> dict:
    session = _load_owned_session(supabase_client, caregiver_profile_id, session_id)

    totals = _recompute_session(supabase_client, session_id)

    if not session.get("completed_at"):
        supabase_client.table("pdedu_quiz_sessions").update(
            {"completed_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", session_id).execute()

    # First completed session for this caregiver? (badge)
    completed_count = (
        supabase_client.table("pdedu_quiz_sessions")
        .select("id", count="exact")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .not_.is_("completed_at", "null")
        .execute()
    ).count or 0

    attempts = (
        supabase_client.table("pdedu_quiz_attempts")
        .select("question_id, symptom_id, selected_symptom_id, correct_symptom_id, is_correct, xp_awarded, answered_at")
        .eq("session_id", session_id)
        .order("answered_at")
        .execute()
    ).data or []

    symptoms = {
        row["id"]: row
        for row in (
            supabase_client.table("pdedu_symptoms")
            .select("id, display_name, learning_tip, memory_trick")
            .execute()
        ).data
        or []
    }
    question_ids = list({a["question_id"] for a in attempts})
    questions = {}
    if question_ids:
        questions = {
            row["id"]: row
            for row in (
                supabase_client.table("pdedu_questions")
                .select("id, prompt, choices, extra_fact, tip, format")
                .in_("id", question_ids)
                .execute()
            ).data
            or []
        }

    # per-symptom recognition accuracy in training
    per_symptom: dict[str, dict] = {}
    for a in attempts:
        sid = a["symptom_id"]
        bucket = per_symptom.setdefault(sid, {"total": 0, "correct": 0})
        bucket["total"] += 1
        bucket["correct"] += 1 if a["is_correct"] else 0

    symptom_breakdown = []
    for sid, b in per_symptom.items():
        pct = round(100 * b["correct"] / b["total"]) if b["total"] else 0
        symptom_breakdown.append(
            {
                "symptom_id": sid,
                "display_name": symptoms.get(sid, {}).get("display_name", sid),
                "total": b["total"],
                "correct": b["correct"],
                "accuracy_pct": pct,
            }
        )
    symptom_breakdown.sort(key=lambda s: (-s["accuracy_pct"], s["display_name"]))

    strongest = [s for s in symptom_breakdown if s["accuracy_pct"] >= 80]
    needs_review = [s for s in symptom_breakdown if s["accuracy_pct"] < 60]

    review = []
    for a in attempts:
        if a["is_correct"]:
            continue
        q = questions.get(a["question_id"], {})
        label_by_id = {c["symptom_id"]: c["label"] for c in q.get("choices", [])}
        review.append(
            {
                "question_id": a["question_id"],
                "format": q.get("format", "text"),
                "prompt": q.get("prompt", ""),
                "your_answer": label_by_id.get(a["selected_symptom_id"], a["selected_symptom_id"]),
                "correct_answer": symptoms.get(a["correct_symptom_id"], {}).get(
                    "display_name", a["correct_symptom_id"]
                ),
                "correct_symptom_id": a["correct_symptom_id"],
                "explanation": q.get("extra_fact", ""),
                "tip": q.get("tip") or symptoms.get(a["correct_symptom_id"], {}).get("learning_tip"),
                "memory_trick": symptoms.get(a["correct_symptom_id"], {}).get("memory_trick"),
            }
        )

    answered = totals["answered"]
    accuracy_pct = round(100 * totals["correct_answers"] / answered) if answered else 0

    badges = []
    if completed_count <= 1:
        badges.append({"id": "first_quiz", "label": "First Quiz"})
    if answered > 0 and totals["correct_answers"] == answered:
        badges.append({"id": "perfect_round", "label": "Perfect Round"})
    if totals["best_streak"] >= 3:
        badges.append({"id": "streak_3", "label": "3 Correct in a Row"})
    if len(per_symptom) >= 4:
        badges.append({"id": "symptom_explorer", "label": "Symptom Explorer"})
    video_correct = sum(
        1 for a in attempts if a["is_correct"] and questions.get(a["question_id"], {}).get("format") == "video"
    )
    if video_correct >= 3:
        badges.append({"id": "video_detective", "label": "Video Detective"})

    logger.info(
        "[PDEDU][QUIZ] quiz completed | session=%s | score=%d/%d | xp=%d | best_streak=%d",
        str(session_id)[:8], totals["correct_answers"], answered, totals["xp_earned"], totals["best_streak"],
    )

    return {
        "session_id": session_id,
        "total_questions": session["total_questions"] or answered,
        "answered": answered,
        "correct_answers": totals["correct_answers"],
        "accuracy_pct": accuracy_pct,
        "xp_earned": totals["xp_earned"],
        "best_streak": totals["best_streak"],
        "symptom_breakdown": symptom_breakdown,
        "strongest": strongest,
        "needs_review": needs_review,
        "badges": badges,
        "review": review,
    }
