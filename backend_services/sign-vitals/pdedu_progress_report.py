"""
pdedu_progress_report.py
Parkinson's-Disease EDUcation (pdedu_) — read-only learning-progress
and history aggregation for the Symptom Trainer.

Wording is deliberately educational: "Quiz Score", "Learning
Progress", "Recognition Accuracy in Training". These numbers describe
how a caregiver is doing in a training quiz — they are NOT diagnostic
accuracy and this feature does NOT diagnose Parkinson's disease.

Independent of any HTTP endpoint — plain functions, callable directly.
"""

import logging

logger = logging.getLogger("sign_vitals")


def _pct(correct: int, total: int) -> int:
    return round(100 * correct / total) if total else 0


def build_pdedu_progress(supabase_client, caregiver_profile_id: str) -> dict:
    sessions = (
        supabase_client.table("pdedu_quiz_sessions")
        .select("id, completed_at, total_questions, correct_answers, xp_earned, best_streak, started_at")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .execute()
    ).data or []
    completed = [s for s in sessions if s.get("completed_at")]

    attempts = (
        supabase_client.table("pdedu_quiz_attempts")
        .select("symptom_id, is_correct, xp_awarded, answered_at")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .execute()
    ).data or []

    symptoms = (
        supabase_client.table("pdedu_symptoms")
        .select("id, display_name, definition, learning_tip, memory_trick, display_order")
        .eq("is_active", True)
        .order("display_order")
        .execute()
    ).data or []

    logger.info(
        "[PDEDU][DB] progress data loaded | quiz sessions=%d | quiz attempts=%d | active symptoms=%d",
        len(sessions), len(attempts), len(symptoms),
    )

    total_answered = len(attempts)
    total_correct = sum(1 for a in attempts if a["is_correct"])
    total_xp = sum(int(a["xp_awarded"]) for a in attempts)
    best_streak = max((int(s.get("best_streak") or 0) for s in sessions), default=0)

    by_symptom: dict[str, dict] = {}
    for a in attempts:
        b = by_symptom.setdefault(a["symptom_id"], {"attempts": 0, "correct": 0, "last": None})
        b["attempts"] += 1
        b["correct"] += 1 if a["is_correct"] else 0
        if b["last"] is None or (a["answered_at"] or "") > b["last"]:
            b["last"] = a["answered_at"]

    symptom_progress = []
    for s in symptoms:
        b = by_symptom.get(s["id"], {"attempts": 0, "correct": 0, "last": None})
        symptom_progress.append(
            {
                "symptom_id": s["id"],
                "display_name": s["display_name"],
                "definition": s["definition"],
                "learning_tip": s.get("learning_tip"),
                "memory_trick": s.get("memory_trick"),
                "attempts": b["attempts"],
                "correct": b["correct"],
                "accuracy_pct": _pct(b["correct"], b["attempts"]),
                "last_practiced_at": b["last"],
            }
        )

    practised = [s for s in symptom_progress if s["attempts"] > 0]
    ranked = sorted(practised, key=lambda s: (s["accuracy_pct"], s["attempts"]))
    weakest = [s["display_name"] for s in ranked[:3] if s["accuracy_pct"] < 100]
    strongest = [s["display_name"] for s in reversed(ranked) if s["accuracy_pct"] >= 80][:3]

    logger.info(
        "[PDEDU][PROGRESS] summary generated | quizzes=%d | questions=%d | overall_accuracy=%d%% | total_xp=%d",
        len(completed), total_answered, _pct(total_correct, total_answered), total_xp,
    )

    return {
        "quizzes_completed": len(completed),
        "total_questions_answered": total_answered,
        "overall_accuracy_pct": _pct(total_correct, total_answered),
        "total_xp": total_xp,
        "best_streak": best_streak,
        "symptom_progress": symptom_progress,
        "strongest_symptoms": strongest,
        "weakest_symptoms": weakest,
        "has_activity": total_answered > 0,
    }


def build_pdedu_history(supabase_client, caregiver_profile_id: str, limit: int = 20) -> list[dict]:
    sessions = (
        supabase_client.table("pdedu_quiz_sessions")
        .select("id, started_at, completed_at, total_questions, correct_answers, xp_earned, best_streak")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .not_.is_("completed_at", "null")
        .order("completed_at", desc=True)
        .limit(limit)
        .execute()
    ).data or []
    logger.info("[PDEDU][DB] quiz history loaded | rows=%d | limit=%d", len(sessions), limit)

    history = []
    for s in sessions:
        total = s.get("total_questions") or 0
        correct = s.get("correct_answers") or 0
        history.append(
            {
                "session_id": s["id"],
                "date": s.get("completed_at") or s.get("started_at"),
                "correct_answers": correct,
                "total_questions": total,
                "accuracy_pct": _pct(correct, total),
                "xp_earned": s.get("xp_earned") or 0,
                "best_streak": s.get("best_streak") or 0,
            }
        )
    return history
