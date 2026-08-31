"""
pdedu_lesson_selector.py
Parkinson's-Disease EDUcation (pdedu_) — adaptive question selection.

select_next_question(supabase_client, caregiver_profile_id) -> question id

Two steps, checked in this order:

STEP 1 — repeated confusion: if pdedu_confusion_pairs shows a
confusion_count >= 2 for this caregiver, look for an active
comparison-type question that tests the confused (correct) symptom
and offers the symptom they keep mistaking it for as one of its
choices. If one exists, prioritize it. The starter seed has no
comparison-type questions, so this step is expected to fall through
today — that's acceptable; this function must never generate a fake
comparison question to compensate.

STEP 2 — adaptive symptom selection: for each active symptom, use its
current mastery_score (or 50 if the caregiver has no mastery row yet
for that symptom). Lower mastery gets a higher selection weight via
simple weighted-random (not a hard "always pick weakest" rule, and
deliberately not any heavier ML/recommendation logic). Then pick one
active question from that symptom at random.

Independent of any HTTP endpoint — plain function, callable directly.
"""

import random

CONFUSION_COUNT_THRESHOLD = 2


def _find_confusion_comparison_question(supabase_client, caregiver_profile_id: str):
    confusion = (
        supabase_client.table("pdedu_confusion_pairs")
        .select("correct_symptom_id, selected_symptom_id, confusion_count")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .gte("confusion_count", CONFUSION_COUNT_THRESHOLD)
        .order("confusion_count", desc=True)
        .execute()
    )

    for pair in confusion.data or []:
        candidates = (
            supabase_client.table("pdedu_questions")
            .select("id, choices")
            .eq("symptom_id", pair["correct_symptom_id"])
            .eq("question_type", "comparison")
            .eq("is_active", True)
            .execute()
        )
        for question in candidates.data or []:
            choice_symptom_ids = {c["symptom_id"] for c in question["choices"]}
            if pair["selected_symptom_id"] in choice_symptom_ids:
                return question["id"]

    return None


def _select_adaptive_question(supabase_client, caregiver_profile_id: str) -> str:
    active_symptoms = supabase_client.table("pdedu_symptoms").select("id").eq("is_active", True).execute()
    symptom_ids = [row["id"] for row in active_symptoms.data]
    if not symptom_ids:
        raise ValueError("No active symptoms found in pdedu_symptoms — cannot select a question")

    mastery_rows = (
        supabase_client.table("pdedu_caregiver_mastery")
        .select("symptom_id, mastery_score")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .execute()
    )
    mastery_by_symptom = {row["symptom_id"]: row["mastery_score"] for row in mastery_rows.data}

    # Lower mastery -> higher weight. max(1, ...) is just a safety floor so a
    # caregiver who has maxed out every symptom's mastery doesn't produce an
    # all-zero weight list (which random.choices can't sample from) — it is
    # not additional selection logic beyond the simple inverse-mastery rule.
    weights = [max(1, 100 - mastery_by_symptom.get(sid, 50)) for sid in symptom_ids]

    chosen_symptom = random.choices(symptom_ids, weights=weights, k=1)[0]

    questions = (
        supabase_client.table("pdedu_questions")
        .select("id")
        .eq("symptom_id", chosen_symptom)
        .eq("is_active", True)
        .execute()
    )
    if not questions.data:
        raise ValueError(f"No active questions found for symptom_id={chosen_symptom!r}")

    return random.choice(questions.data)["id"]


def select_next_question(supabase_client, caregiver_profile_id: str) -> str:
    """Returns a single pdedu_questions.id — the next question to ask this caregiver."""
    comparison_question_id = _find_confusion_comparison_question(supabase_client, caregiver_profile_id)
    if comparison_question_id:
        return comparison_question_id

    return _select_adaptive_question(supabase_client, caregiver_profile_id)
