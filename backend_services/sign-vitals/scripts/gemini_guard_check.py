"""
gemini_guard_check.py
GLOSS component — one real, end-to-end check of the guarded Gemini
rewording. Manual check, not part of the automated tests (it calls the
real Gemini API, so it needs GEMINI_API_KEY and network access).

Runs 3 graded attempts — one per quality tier — through the app's real
attempt flow, attempt_submission.submit_attempt(): normalization ->
recognition -> DTW grading -> rule-based feedback -> guarded Gemini
rewording -> the row the app would persist. For each it prints:

  - the rule-based text;
  - Gemini's raw reply;
  - the guard's verdict (gloss_feedback_guard.is_faithful);
  - the text saved to corrective_feedback.summary.

Two things are stubbed so the check touches nothing but Gemini:
  - landmark extraction: the landmarks come from
    gloss_assets/pipeline_parity.npz (raw MediaPipe landmarks) instead
    of a video. The pipeline-parity set has no "strong" attempt, so the
    strong case uses that sign's own reference exemplar as the attempt.
  - Supabase: an in-memory stand-in. Nothing is read from or written to
    the real database.

The API key is read from the environment by gemini_feedback.py and is
never printed or logged here.

Usage (from backend_services/sign-vitals, with .venv's python):
    python scripts/gemini_guard_check.py
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import attempt_submission  # noqa: E402
import gemini_feedback  # noqa: E402
import grading  # noqa: E402
from gloss_feedback_guard import LOW_CONFIDENCE_CUTOFF, is_faithful  # noqa: E402
from recogniser import ASSETS_DIR, load_ensemble  # noqa: E402


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, db, table):
        self.db, self.table, self.op, self.payload = db, table, "select", None

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def upsert(self, payload, **_kwargs):
        self.op, self.payload = "upsert", payload
        return self

    def __getattr__(self, _name):          # select / eq / limit / order / ... are no-ops
        return lambda *_args, **_kwargs: self

    def execute(self):
        if self.op == "insert":
            self.db.inserted.setdefault(self.table, []).append(self.payload)
            return _Result([{"id": f"local-{self.table}", **self.payload}])
        if self.op == "upsert":
            return _Result([self.payload])
        if self.table == "gloss_signs":
            return _Result([{"id": sign} for sign in self.db.signs])
        return _Result([])                 # no sessions / mastery rows yet


class InMemorySupabase:
    """Just enough of the supabase client for submit_attempt()."""

    def __init__(self, signs):
        self.signs, self.inserted = signs, {}

    def table(self, name):
        return _Query(self, name)


def _pick_cases(model):
    """One attempt per tier where possible: (label, target_sign, landmarks)."""
    z = np.load(os.path.join(ASSETS_DIR, "pipeline_parity.npz"))
    expected = json.loads(str(z["expected_json"]))
    cases = {}
    for exp in expected:
        usable = (exp["has_raw"] and exp["predicted_class"] == exp["true_sign"]
                  and exp["confidence"] >= LOW_CONFIDENCE_CUTOFF)
        if usable and exp["quality_tier"] not in cases:
            cases[exp["quality_tier"]] = (
                f"pipeline_parity attempt {exp['index']} (raw landmarks)", exp["true_sign"], z[f"raw_{exp['index']}"]
            )
    if "strong" not in cases:
        for sign, ref in grading.references.items():
            attempt = ref["sequence"].reshape(-1, grading.N_LANDMARKS, 3)
            result = grading.grade(attempt, model)
            if (result["predicted_class"] == sign and result["quality_tier"] == "strong"
                    and result["tcn_confidence"] >= LOW_CONFIDENCE_CUTOFF):
                cases["strong"] = (f"reference exemplar of '{sign}' used as the attempt", sign, attempt)
                break
    return [(tier, *cases[tier]) for tier in ("strong", "moderate", "weak") if tier in cases]


def main():
    if not os.environ.get("GEMINI_API_KEY"):
        print("GEMINI_API_KEY is not set in this shell - nothing was sent to Gemini.")
        sys.exit(1)

    grading.load_assets()
    model = load_ensemble()
    print(f"Gemini model: {gemini_feedback.GEMINI_MODEL} | temperature={gemini_feedback.GEMINI_TEMPERATURE} "
          f"| max_output_tokens={gemini_feedback.GEMINI_MAX_OUTPUT_TOKENS}")

    # Record what goes to / comes back from Gemini, without changing it.
    exchanges = []
    real_call = gemini_feedback.call_gemini

    def recording_call(prompt):
        exchange = {"prompt": prompt, "reply": None, "error": None}
        exchanges.append(exchange)
        try:
            exchange["reply"] = real_call(prompt)
        except Exception as e:
            # Never let the key reach the console, even if an error message echoes it.
            exchange["error"] = f"{type(e).__name__}: {e}".replace(os.environ["GEMINI_API_KEY"], "***")
            raise
        return exchange["reply"]

    gemini_feedback.call_gemini = recording_call

    for tier, label, target, landmarks in _pick_cases(model):
        exchanges.clear()
        attempt_submission.extract_landmarks_via_subprocess = lambda _path, lm=landmarks: lm
        supabase = InMemorySupabase(grading.class_names)

        response = attempt_submission.submit_attempt(
            supabase, "local-caregiver", target_sign_id=target, attempt_type="webcam",
            video_path="(landmarks supplied directly)", model=model,
            class_names=grading.class_names, class_thresholds=grading.threshold_table,
        )
        saved = supabase.inserted["gloss_attempts"][0]
        rule_text = None
        print("\n" + "=" * 78)
        print(f"{tier.upper()} | {label} | target='{target}'")
        print(f"recognised='{saved['recognized_sign_id']}' confidence={saved['recognition_confidence']:.4f} "
              f"tier={saved['quality_tier']} execution_score={saved['execution_score']:.4f} "
              f"mastery_status={response['mastery']['mastery_status']}")
        if exchanges:
            rule_text = exchanges[0]["prompt"].split("Original feedback: ", 1)[1].split("\n\nRewritten feedback:")[0]
            reply = exchanges[0]["reply"]
            print(f"\nRULE TEXT:\n  {rule_text}")
            if exchanges[0]["error"]:
                print(f"\nGEMINI CALL FAILED:\n  {exchanges[0]['error']}")
                print("\nGUARD VERDICT:\n  not reached - rule-based text used")
            else:
                print(f"\nGEMINI REPLY:\n  {reply!r}")
                ok, problems = is_faithful(rule_text, (reply or "").strip(), saved["quality_tier"])
                print(f"\nGUARD VERDICT:\n  {'ACCEPTED' if ok and (reply or '').strip() else 'REJECTED'}"
                      f"{'' if ok else ' - ' + '; '.join(problems)}")
        else:
            print("\nGemini was not called for this attempt (guard rule 1, or no key).")
        summary = saved["corrective_feedback"]["summary"]
        print(f"\nSAVED corrective_feedback.summary:\n  {summary}")
        if rule_text is not None:
            print(f"  (= {'rule-based text' if summary == rule_text else 'Gemini rewording'})")


if __name__ == "__main__":
    main()
