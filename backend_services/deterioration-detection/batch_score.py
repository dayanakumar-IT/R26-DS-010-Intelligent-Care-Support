"""
Batch-scores the 25 historical caregivers against the already-working
deterioration-detection FastAPI service (backend_services/deterioration-detection),
instead of trying to reconstruct the pipeline in Colab.

For each caregiver:
  1. GET /caregivers/{id}/history  -> real feature_date values for that caregiver
  2. POST /caregivers/{id}/simulate?date=X  -> real risk_probability, risk_prediction,
     and top_factor.feature (SHAP-derived) for that date

Requires:
  - The backend running locally on port 8000 (BASE_URL below).
  - An admin JWT, either:
      * set as the ADMIN_JWT environment variable before running, or
      * pasted in when this script prompts for it (input is hidden).

Output: batch_risk_scores.csv in this same folder, plus a printed summary.
"""

import csv
import getpass
import os
import statistics
from collections import Counter

import httpx

BASE_URL = "http://localhost:8000"
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "batch_risk_scores.csv")

# NOTE: these are caregiver_profiles.participant_id values (confirmed against
# the live DB — all 25 match a data_mode='historical' row), NOT
# caregiver_profiles.id. The /history and /simulate endpoints are keyed on
# the latter, so main() resolves participant_id -> caregiver id via
# GET /caregivers before scoring anything.
PARTICIPANT_IDS = [
    "0271c478-a56a-4c09-ab91-9743184dd71b", "0adb7679-9d26-46e7-a134-11da293910f3",
    "13c66354-c2ce-4471-974d-0fd776a8a1bb", "14121de2-f38e-4906-9fbe-b613549623fd",
    "16812063-e5df-4657-b86c-5b55a0c9ffe6", "1d356286-db62-4eaa-a4ef-3ba004e06843",
    "2b0a7c5a-98f9-4512-a297-3ae27e805b71", "3cc3da4a-9b07-4215-ad8c-7ef222571856",
    "5bb7f10e-ea7d-4af3-adae-c0d92e8a700d", "658adbe4-781c-45f9-92a7-14912fcd0701",
    "687c2d53-012d-4082-a5f0-edade97481a5", "77dfe9b8-5f40-49a6-ba09-706198bb8a48",
    "7bb5eee8-70d6-4b16-990a-a62cf827170a", "85c88df0-b503-4329-a29f-353199f7fe5b",
    "8f1c82eb-5e71-4187-a0a3-f2b58d8d99bd", "9548d1c4-bd4a-4841-9146-c0678135069d",
    "95f9f3a8-128c-4382-aa4b-6ea319b497ae", "a9dfbe4d-4076-48c7-a72b-342fe4c12514",
    "ab23fe51-7249-4c81-bec3-451b6ab1d140", "aea11c01-40d9-479e-aa27-0b8bf464de52",
    "d046a3ef-1402-4530-855c-481798c41ccd", "deb03e25-16f1-403a-8152-891f50b50ae4",
    "df3a6b7a-7e27-4003-beea-2cb5cf08da83", "e89b1ea7-a2ea-4f2f-ae5a-9a9d29af8639",
    "f610ffea-f6cb-4182-bbe7-19ff8fbe66ee",
]


def get_admin_jwt() -> str:
    env_token = os.getenv("ADMIN_JWT")
    if env_token:
        return env_token.strip()
    token = getpass.getpass("Paste your admin JWT (input hidden, from DevTools -> Application "
                             "-> Local Storage -> sb-...-auth-token -> access_token): ")
    return token.strip()


def check_backend_reachable(client: httpx.Client) -> None:
    try:
        response = client.get(f"{BASE_URL}/health", timeout=5)
        response.raise_for_status()
    except Exception as exc:
        raise SystemExit(
            f"Cannot reach the backend at {BASE_URL}/health ({exc}). "
            "Start it first: uvicorn main:app --reload --port 8000"
        )


def fetch_participant_to_caregiver_map(client: httpx.Client) -> dict[str, str]:
    response = client.get(f"{BASE_URL}/caregivers")
    if response.status_code != 200:
        raise SystemExit(
            f"GET /caregivers failed: {response.status_code} {_error_detail(response)} "
            "— cannot resolve participant IDs to caregiver IDs without this."
        )
    return {row["participant_id"]: row["id"] for row in response.json()}


def fetch_dates_for_caregiver(client: httpx.Client, caregiver_id: str) -> list[str]:
    response = client.get(f"{BASE_URL}/caregivers/{caregiver_id}/history")
    if response.status_code != 200:
        print(f"  [SKIP caregiver {caregiver_id}] /history failed: "
              f"{response.status_code} {_error_detail(response)}")
        return []

    body = response.json()
    return [row["feature_date"] for row in body.get("daily_features", []) if "feature_date" in row]


def simulate(client: httpx.Client, caregiver_id: str, date: str) -> dict | None:
    try:
        response = client.post(f"{BASE_URL}/caregivers/{caregiver_id}/simulate", params={"date": date})
    except httpx.RequestError as exc:
        print(f"  [SKIP {caregiver_id} / {date}] network error: {exc}")
        return None
    if response.status_code != 200:
        print(f"  [SKIP {caregiver_id} / {date}] /simulate failed: "
              f"{response.status_code} {_error_detail(response)}")
        return None
    return response.json()


def _error_detail(response: httpx.Response) -> str:
    try:
        body = response.json()
        if isinstance(body, dict) and isinstance(body.get("detail"), str):
            return body["detail"]
    except Exception:
        pass
    return response.text[:200]


def main() -> None:
    token = get_admin_jwt()
    if not token:
        raise SystemExit("No JWT provided — nothing to do.")

    headers = {"Authorization": f"Bearer {token}"}

    with httpx.Client(headers=headers, timeout=30.0) as client:
        check_backend_reachable(client)

        participant_to_caregiver = fetch_participant_to_caregiver_map(client)

        rows: list[dict] = []

        for participant_id in PARTICIPANT_IDS:
            caregiver_id = participant_to_caregiver.get(participant_id)
            if not caregiver_id:
                print(f"  [SKIP participant {participant_id}] no matching caregiver_profiles row")
                continue

            dates = fetch_dates_for_caregiver(client, caregiver_id)
            if not dates:
                continue

            for date in dates:
                result = simulate(client, caregiver_id, date)
                if result is None:
                    continue

                risk_probability = result.get("risk_probability")
                risk_prediction = result.get("risk_prediction")
                top_shap_factor = (result.get("top_factor") or {}).get("feature")

                rows.append({
                    "caregiver_id": caregiver_id,
                    "participant_id": participant_id,
                    "feature_date": date,
                    "risk_probability": risk_probability,
                    "risk_prediction": risk_prediction,
                    "top_shap_factor": top_shap_factor,
                })

                print(f"  {caregiver_id} | {date} | risk_probability={risk_probability}")

    if not rows:
        print("\nNo rows were scored — nothing written.")
        return

    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["caregiver_id", "participant_id", "feature_date",
                        "risk_probability", "risk_prediction", "top_shap_factor"],
        )
        writer.writeheader()
        writer.writerows(rows)

    probabilities = [r["risk_probability"] for r in rows if isinstance(r["risk_probability"], (int, float))]
    factor_counts = Counter(r["top_shap_factor"] for r in rows if r["top_shap_factor"])

    print("\n=== Summary ===")
    print(f"Total rows written: {len(rows)}  -> {OUTPUT_PATH}")
    if probabilities:
        print(f"risk_probability: min={min(probabilities):.4f}  max={max(probabilities):.4f}  "
              f"mean={statistics.mean(probabilities):.4f}  "
              f"std={statistics.stdev(probabilities) if len(probabilities) > 1 else 0.0:.4f}")
    else:
        print("risk_probability: no numeric values found.")

    print("\ntop_shap_factor value_counts:")
    for feature, count in factor_counts.most_common():
        print(f"  {feature}: {count}")


if __name__ == "__main__":
    main()
