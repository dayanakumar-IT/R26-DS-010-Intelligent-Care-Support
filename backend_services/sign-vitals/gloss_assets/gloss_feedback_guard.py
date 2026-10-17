"""GLOSS app: guard for the Gemini rewording step (drop-in, closes the faithfulness loopholes found in A5b).

Use:  text = safe_feedback_text(result, base, call_gemini)
  result      = dict from grade_learner_attempt()  (predicted_class, tcn_confidence, quality_tier, ...)
  base        = dict from generate_feedback(result) (full_text, cited_landmarks, ...)
  call_gemini = your existing function that sends a prompt string and returns the reply text

Rules:
  1. Very low confidence (< 0.35): never call Gemini. Show the rule-based text exactly.
  2. Gemini only sees what the rule-based message already says (no hidden sign name, no extra body parts).
  3. Every reply is checked; if any check fails, the learner sees the rule-based text instead.

v2 (after the manual read of the A6b run): the reply must also keep every left/right side and body part that the
rule-based text names, so actionable detail ("left wrist") is never dropped or blurred ("wrist").
"""
import re

LOW_CONFIDENCE_CUTOFF = 0.35
HEDGE = ["might", "not fully certain", "wasn't fully", "not quite sure", "wasn't quite sure", "could be",
         "looks like", "looked like", "looked close", "looked a lot like", "not sure", "uncertain"]
PRAISE = ["wonderful", "excellent", "perfect", "amazing", "great job", "well done", "clearly recognized",
          "easily recognized", "successfully"]
BODY = ["wrist", "elbow", "shoulder", "finger", "thumb", "pinky", "index", "ring", "middle", "joint",
        "tip", "base", "hand", "head", "arm"]


def build_prompt(rule_text, quality_tier):
    hedge_rule = ("The original says the system was NOT fully certain. Keep that uncertainty clearly.\n"
                  if "wasn't fully certain" in rule_text else "")
    return f"""Rephrase this sign-language practice feedback in a warm, encouraging tone, in 2-3 short sentences.
Use ONLY the information in the original text. Do not add any sign names, body parts or advice that it does not
contain. Do not quote numbers.
{hedge_rule}Quality: {quality_tier}. If quality is "weak" or "moderate", be supportive but not congratulatory
(no "wonderful", "great", "excellent"). The word in quotes is the NAME of a sign, not a judgement of the learner.

Original feedback: {rule_text}

Rewritten feedback:"""


def missing_details(rule_text, llm_text):
    """Sides and body parts named in the rule-based text that the reply dropped (v2)."""
    rule, llm = rule_text.lower(), llm_text.lower()
    missing = [side for side in ("left", "right")
               if re.search(rf"\b{side}\b", rule) and not re.search(rf"\b{side}\b", llm) and "both" not in llm]
    missing += [w for w in BODY if re.search(rf"\b{w}", rule) and not re.search(rf"\b{w}", llm)]
    return missing


def is_faithful(rule_text, llm_text, quality_tier):
    rule, llm = rule_text.lower(), llm_text.lower()
    problems = []
    dropped = missing_details(rule_text, llm_text)
    if dropped:
        problems.append(f"drops detail {dropped}")
    added_body = [w for w in BODY if re.search(rf"\b{w}", llm) and not re.search(rf"\b{w}", rule)]
    if added_body:
        problems.append(f"adds body parts {added_body}")
    quoted = r"['\"‘’“”]([a-z]+(?: [a-z]+)?)[,.!?]?['\"‘’“”]"
    new_names = set(re.findall(quoted, llm)) - set(re.findall(quoted, rule))
    if new_names:
        problems.append(f"names a sign not in the original {sorted(new_names)}")
    if "wasn't fully certain" in rule and not any(h in llm for h in HEDGE):
        problems.append("drops the uncertainty")
    if quality_tier in ("weak", "moderate") and any(p in llm for p in PRAISE):
        problems.append("praise on a weak/moderate attempt")
    if "couldn't confidently identify" in rule and any(p in llm for p in PRAISE):
        problems.append("praises a failed recognition")
    return not problems, problems


def safe_feedback_text(result, base, call_gemini):
    rule_text = base["full_text"]
    if result["tcn_confidence"] < LOW_CONFIDENCE_CUTOFF:
        return rule_text                                   # rule 1
    try:
        llm_text = call_gemini(build_prompt(rule_text, result["quality_tier"])).strip()   # rule 2
    except Exception:
        return rule_text
    ok, _ = is_faithful(rule_text, llm_text, result["quality_tier"])                       # rule 3
    return llm_text if ok and llm_text else rule_text
