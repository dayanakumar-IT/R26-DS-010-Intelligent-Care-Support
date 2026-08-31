# Requirements check: this service depends on the pinned versions in
# requirements.txt (notably fastapi, supabase, python-dotenv). Install
# with `pip install -r requirements.txt` inside this service's venv
# before running.

import io
import math
import os
from datetime import datetime, timedelta, timezone

import httpx
import joblib
import numpy as np
import pandas as pd
import shap
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from supabase import AuthError, Client, ClientOptions, PostgrestAPIError, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "Missing required environment variables: SUPABASE_URL and "
        "SUPABASE_SERVICE_ROLE_KEY must both be set (see .env)."
    )

# Service-role client: this service runs server-side only and is allowed to
# read the locked participants/daily_features/centrality_daily tables.
# Never expose this key to any frontend.
#
# --- Connection resilience --------------------------------------------
# Long-idle dev/prod sessions were hitting httpx.RemoteProtocolError:
# Server disconnected — Supabase silently closes idle pooled connections
# server-side, and httpx doesn't discover this until it tries to reuse
# that exact connection for a new request. Two layers of defense:
#
# 1. Proactively recycle idle connections client-side (30s) before
#    Supabase's own server-side idle timeout can close them out from
#    under us — should make layer 2 below rare in practice, not just a
#    safety net for it.
_httpx_client = httpx.Client(limits=httpx.Limits(keepalive_expiry=30))

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    options=ClientOptions(httpx_client=_httpx_client),
)

# 2. Retry once, transparently, for the rare case #1 wasn't enough — the
# connection died in the gap between "still open" and "we tried to reuse
# it." Patched onto SyncQueryRequestBuilder.execute — confirmed directly
# against the installed postgrest-py's own class hierarchy that this one
# method is the single common ancestor every .table(...).select/insert/
# update/upsert/delete(...).execute() call in this file already goes
# through (select/insert/update/upsert all inherit it from this one
# base class) — rather than wrapping each of this file's 36 individual
# .execute() call sites by hand. One real, named, testable helper
# function (_execute_with_retry), applied at its actual common source so
# it covers every existing call site and any added later automatically,
# instead of repeating the same retry boilerplate 36 times or risking
# missing one.
#
# Scoped to httpx.RemoteProtocolError specifically — not sibling
# connection errors like ConnectError/ReadError/WriteError, which are
# different failure points with different write-safety implications.
# RemoteProtocolError here specifically means "the connection was found
# dead while httpx tried to reuse it," which happens *before* the
# request semantically reaches the server — that's what makes it safe to
# retry unconditionally, including for inserts/updates/upserts: the
# original attempt never actually happened server-side, unlike (say) a
# timeout partway through an in-flight request Supabase might have
# already received.
#
# Reaches into postgrest-py's private (_sync) module since there's no
# public hook for this — guarded so a future postgrest-py upgrade that
# restructures this internal module degrades to "no retry" (falls back
# to layer 1 alone) instead of crashing the whole service on startup.
try:
    from postgrest._sync.request_builder import SyncQueryRequestBuilder

    _original_query_execute = SyncQueryRequestBuilder.execute

    def _execute_with_retry(self):
        try:
            return _original_query_execute(self)
        except httpx.RemoteProtocolError:
            return _original_query_execute(self)

    SyncQueryRequestBuilder.execute = _execute_with_retry
except ImportError:
    pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Two-stage stress risk pipeline (loaded once at startup) -------------
#
# Stage 1 (baseline_regressor): predicts a participant's expected HR for a
# given day from their own short-term trend, so Stage 2 can use how far the
# actual HR deviates from that *predicted* personal baseline
# (hr_mean_deviation_model) rather than a fixed historical average.
# Stage 2 (stage2_model): the real stress-risk classifier, trained on 16
# features including Stage 1's output. Supersedes the old lgbm_a_sleep model.

BASELINE_REGRESSOR_PATH = "models/baseline_regressor.joblib"
STAGE2_MODEL_PATH = "models/lgbm_model_baseline.joblib"
STAGE2_IMPUTER_PATH = "models/lgbm_model_baseline_imputer.joblib"

try:
    baseline_regressor = joblib.load(BASELINE_REGRESSOR_PATH)
except FileNotFoundError as exc:
    raise RuntimeError(
        f"Missing model artifact: could not load {BASELINE_REGRESSOR_PATH!r}. "
        "Place the trained model file in models/ before starting this service."
    ) from exc

try:
    stage2_model = joblib.load(STAGE2_MODEL_PATH)
    stage2_imputer = joblib.load(STAGE2_IMPUTER_PATH)
except FileNotFoundError as exc:
    raise RuntimeError(
        f"Missing model artifact(s): could not load {STAGE2_MODEL_PATH!r} "
        f"and/or {STAGE2_IMPUTER_PATH!r}. Place the trained model files in "
        "models/ before starting this service."
    ) from exc

stage2_explainer = shap.TreeExplainer(stage2_model)

if 1 not in list(stage2_model.classes_):
    raise RuntimeError(
        f"Unexpected stage2 model classes_ {stage2_model.classes_!r}; "
        "expected a binary classifier with a '1' (elevated stress) class."
    )
STAGE2_POSITIVE_CLASS_INDEX = list(stage2_model.classes_).index(1)

# Confirmed against the actual loaded artifact's feature_names_in_.
BASELINE_FEATURE_ORDER = ["hr_dev_roll3", "hr_dev_roll7", "day_of_week"]

# NOTE: stage2_imputer's fitted feature_names_in_ do NOT match
# FEATURE_ORDER's names (training-time artifact, e.g. "NumberSteps" vs
# "number_steps"), but they ARE positionally aligned with it 1:1 —
# confirmed against the actual loaded artifact. So the feature vector is
# imputed positionally (a plain array, not a named DataFrame) rather than
# by matching column names.
FEATURE_ORDER = [
    "hr_mean",
    "hr_std",
    "hr_min",
    "hr_max",
    "hr_mean_deviation_model",
    "hr_dev_roll3",
    "hr_dev_roll7",
    "number_steps",
    "cardio_minutes",
    "fat_burn_minutes",
    "peak_minutes",
    "out_of_range_minutes",
    "resting_heart_rate",
    "steps_deviation",
    "sleep1efficiency",
    "lag1_stress",
]

FEATURE_LABELS = {
    "hr_mean": "Average heart rate",
    "hr_std": "Heart rate variability",
    "hr_min": "Lowest heart rate",
    "hr_max": "Highest heart rate",
    "hr_mean_deviation_model": (
        "Heart rate deviation from the model's predicted personal baseline "
        "(Stage 1 output)"
    ),
    "hr_dev_roll3": "Heart rate deviation trend (3-day average)",
    "hr_dev_roll7": "Heart rate deviation trend (7-day average)",
    "number_steps": "Step count",
    "cardio_minutes": "Minutes in cardio heart rate zone",
    "fat_burn_minutes": "Minutes in fat-burn heart rate zone",
    "peak_minutes": "Minutes in peak heart rate zone",
    "out_of_range_minutes": "Minutes outside target heart rate zones",
    "resting_heart_rate": "Resting heart rate",
    "steps_deviation": "Step count deviation from personal baseline",
    "sleep1efficiency": "Sleep efficiency",
    "lag1_stress": "Elevated stress on the previous recorded day",
}


def _extract_positive_class_shap_row(shap_output, positive_class_index: int):
    """Normalizes shap.TreeExplainer(...).shap_values(X) for a single-row
    binary-classification input into a flat (n_features,) array of SHAP
    values for the positive class.

    Handled defensively because this shape has genuinely changed across
    shap versions for LightGBM binary classifiers (shap itself warns about
    this) — a plain (n_samples, n_features) array, a list of one array per
    class, or a (n_samples, n_features, n_classes) array have all been seen
    in the wild for this model type.
    """
    if isinstance(shap_output, list):
        values = np.asarray(shap_output[positive_class_index])
    else:
        values = np.asarray(shap_output)
        if values.ndim == 3:
            values = values[:, :, positive_class_index]
    return values[0]


def _as_model_float(value):
    """Normalize a raw DB value to a genuine float or np.nan before it
    reaches a model input.

    Supabase returns SQL NULL as Python None. Handed straight to pandas in
    a single-row DataFrame, a None-valued column with no other row to infer
    a numeric dtype from comes out as dtype=object rather than float64 —
    and LightGBM's predict() rejects object-dtype columns outright with
    "pandas dtypes must be int, float or bool", regardless of which
    specific field was the one that happened to be missing. Coercing every
    value through this function first guarantees a real float or a real
    np.nan reaches the model — never a bare None — so imputation/LightGBM's
    own native NaN handling can do its job.
    """
    if value is None:
        return np.nan
    return float(value)


def _safe_float(value) -> float | None:
    """The opposite direction from _as_model_float: normalize a raw
    pandas/numpy value (from an uploaded CSV, possibly numpy.float64,
    possibly NaN) into a genuine Python float or None, safe to send to
    PostgREST as JSON. A bare NaN serializes to invalid JSON; a numpy
    scalar type can trip strict JSON encoders — this guarantees neither
    reaches the request body.
    """
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(result) else result


def _safe_int(value) -> int | None:
    """Same normalization as _safe_float, then rounds to int — for
    daily_features columns declared `integer` (number_steps, lag1_stress,
    stress_binary), which reject a JSON value with a decimal point (e.g.
    3.0) even though it's numerically a whole number.
    """
    safe = _safe_float(value)
    return None if safe is None else round(safe)


def _predict_stage1_baseline_hr(feature_date: str, hr_dev_roll3, hr_dev_roll7) -> float:
    """Stage 1: predict a participant's expected HR for one day from their
    own short-term rolling trend. Extracted out of /simulate so
    /caregivers/{id}/baseline-history can reuse the exact same logic
    instead of a second copy.

    ASSUMPTION: Python's datetime.weekday() (Monday=0..Sunday=6) is used
    here on the assumption that it matches pandas' .dt.dayofweek
    convention, which is what we assume the original notebook used to
    encode day_of_week during training. This has NOT been directly
    confirmed against the notebook itself — if predictions look
    systematically off, this encoding is the first thing to check.
    """
    day_of_week = datetime.strptime(feature_date, "%Y-%m-%d").weekday()
    # Normalized via _as_model_float: when hr_dev_roll3/hr_dev_roll7 is NULL
    # in the DB (e.g. insufficient trailing data for the rolling window), a
    # bare None here made this single-row DataFrame's column infer as
    # dtype=object instead of float64 — the original crash site for the
    # "pandas dtypes must be int, float or bool" error.
    stage1_inputs = {
        "hr_dev_roll3": _as_model_float(hr_dev_roll3),
        "hr_dev_roll7": _as_model_float(hr_dev_roll7),
        "day_of_week": day_of_week,
    }
    stage1_input_df = pd.DataFrame([stage1_inputs], columns=BASELINE_FEATURE_ORDER)
    return float(baseline_regressor.predict(stage1_input_df)[0])


def _run_stage2_inference(raw_features: dict) -> tuple[float, int, list]:
    """Stage 2 + SHAP: extracted out of /simulate so reveal_next_day can
    run the exact same scoring pipeline once a revealed day has 7+ prior
    revealed days, instead of a second copy.

    Returns (risk_probability, risk_prediction, shap_row) — shap_row is
    one SHAP value per FEATURE_ORDER entry, in that same order. Each
    caller builds whatever factor detail it actually needs from it (a
    full sorted list with labels for /simulate's response; just the
    single top feature name for reveal_next_day's stored
    top_shap_factor).
    """
    raw_array = np.array(
        [[_as_model_float(raw_features[name]) for name in FEATURE_ORDER]], dtype=float
    )
    imputed_array = np.asarray(stage2_imputer.transform(raw_array), dtype=float)
    imputed_df = pd.DataFrame(imputed_array, columns=FEATURE_ORDER)

    proba = stage2_model.predict_proba(imputed_df)
    risk_probability = float(proba[0][STAGE2_POSITIVE_CLASS_INDEX])
    risk_prediction = int(stage2_model.predict(imputed_df)[0])

    shap_output = stage2_explainer.shap_values(imputed_df)
    shap_row = _extract_positive_class_shap_row(shap_output, STAGE2_POSITIVE_CLASS_INDEX)

    return risk_probability, risk_prediction, shap_row


def _get_authorized_caregiver(caregiver_id: str, current_user: dict) -> dict:
    """Fetch a caregiver_profiles row and enforce the authorization rule
    shared by /caregivers/{id}/history and /caregivers/{id}/simulate:
    admins may view any caregiver, supervisors only their own assignees.
    """
    try:
        caregiver_response = (
            supabase.table("caregiver_profiles")
            .select("id, display_name, ward, data_mode, participant_id, supervisor_id")
            .eq("id", caregiver_id)
            .maybe_single()
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query caregiver_profiles: {exc}"
        ) from exc

    caregiver = caregiver_response.data if caregiver_response else None
    if not caregiver:
        raise HTTPException(status_code=404, detail="Caregiver not found")

    role = current_user["role"]
    is_owning_supervisor = (
        role == "supervisor" and caregiver["supervisor_id"] == current_user["id"]
    )
    if role != "admin" and not is_owning_supervisor:
        raise HTTPException(
            status_code=403, detail="Not authorized to view this caregiver"
        )

    return caregiver


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header.")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=401, detail="Missing or malformed Authorization header."
        )

    try:
        user_response = supabase.auth.get_user(token)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc

    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    caller_id = user_response.user.id

    profile_response = (
        supabase.table("profiles")
        .select("*")
        .eq("id", caller_id)
        .maybe_single()
        .execute()
    )

    profile = profile_response.data if profile_response else None
    if not profile:
        raise HTTPException(status_code=403, detail="No profile found for this account.")

    return profile


@app.get("/me")
def me(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


@app.get("/caregivers")
def caregivers(current_user: dict = Depends(get_current_user)) -> list[dict]:
    role = current_user["role"]

    query = supabase.table("caregiver_profiles").select(
        "id, display_name, ward, institution, data_mode, participant_id, "
        "supervisor_id, created_at"
    )

    if role == "admin":
        pass
    elif role == "supervisor":
        # Filtered explicitly here, not left to RLS — this client uses the
        # service-role key, which bypasses RLS entirely.
        query = query.eq("supervisor_id", current_user["id"])
    else:
        raise HTTPException(
            status_code=403, detail="Admin or supervisor role required."
        )

    try:
        response = query.execute()
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query caregiver_profiles: {exc}"
        ) from exc

    return response.data


@app.get("/caregivers/{caregiver_id}/history")
def caregiver_history(
    caregiver_id: str, current_user: dict = Depends(get_current_user)
) -> dict:
    caregiver = _get_authorized_caregiver(caregiver_id, current_user)
    participant_id = caregiver["participant_id"]

    try:
        daily_features_response = (
            supabase.table("daily_features")
            .select(
                "feature_date, hr_mean, hr_std, hr_min, hr_max, hr_mean_deviation, "
                "hr_dev_roll3, hr_dev_roll7, number_steps, cardio_minutes, "
                "fat_burn_minutes, peak_minutes, out_of_range_minutes, "
                "resting_heart_rate, steps_deviation, sleep1efficiency"
            )
            .eq("participant_id", participant_id)
            .order("feature_date", desc=False)
            .execute()
        )

        centrality_response = (
            supabase.table("centrality_daily")
            .select("centrality_date, degree_centrality, weighted_centrality")
            .eq("participant_id", participant_id)
            .order("centrality_date", desc=False)
            .execute()
        )

        # participant_baselines allows up to two rows per participant (one
        # per baseline_type), but this app only ever uses
        # 'fixed_historical' — 'running' is reserved for a future live
        # scenario and is never populated. Filtering by both columns is
        # safe with .maybe_single() because of the table's
        # unique(participant_id, baseline_type) constraint: at most one row
        # can match.
        baseline_response = (
            supabase.table("participant_baselines")
            .select("*")
            .eq("participant_id", participant_id)
            .eq("baseline_type", "fixed_historical")
            .maybe_single()
            .execute()
        )

        # device_registrations has no unique constraint on caregiver_profile_id
        # alone (only device_id is globally unique), so in principle a
        # caregiver could have more than one row — .limit(1) picks a single
        # one deterministically (registered_at ascending) rather than
        # erroring, since this is display-only, not authoritative device
        # management.
        device_response = (
            supabase.table("device_registrations")
            .select("device_id, device_type")
            .eq("caregiver_profile_id", caregiver_id)
            .order("registered_at", desc=False)
            .limit(1)
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query participant history: {exc}"
        ) from exc

    baseline = baseline_response.data if baseline_response else None
    device = device_response.data[0] if device_response.data else None

    return {
        "caregiver": {
            "id": caregiver["id"],
            "display_name": caregiver["display_name"],
            "ward": caregiver["ward"],
            "data_mode": caregiver["data_mode"],
            "participant_id": caregiver["participant_id"],
            "device_id": device["device_id"] if device else None,
            "device_type": device["device_type"] if device else None,
        },
        "daily_features": daily_features_response.data,
        "centrality": centrality_response.data,
        "baseline": baseline,
    }


@app.get("/caregivers/{caregiver_id}/risk-history")
def caregiver_risk_history(
    caregiver_id: str, current_user: dict = Depends(get_current_user)
) -> dict:
    # Read-only: pulls the already-populated risk_probability /
    # risk_prediction / top_shap_factor columns straight from
    # daily_features. No model inference, no SHAP computation here.
    caregiver = _get_authorized_caregiver(caregiver_id, current_user)
    participant_id = caregiver["participant_id"]

    try:
        response = (
            supabase.table("daily_features")
            .select("feature_date, risk_probability, risk_prediction, top_shap_factor")
            .eq("participant_id", participant_id)
            .order("feature_date", desc=False)
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query daily_features: {exc}"
        ) from exc

    return {
        "caregiver": {
            "id": caregiver["id"],
            "display_name": caregiver["display_name"],
        },
        # Rows with risk_probability = null (not yet scored) are kept, not
        # filtered out, so the frontend can render the gap.
        "history": response.data,
    }


@app.get("/caregivers/{caregiver_id}/baseline-history")
def caregiver_baseline_history(
    caregiver_id: str, current_user: dict = Depends(get_current_user)
) -> dict:
    # Read-only in the sense that it makes no writes, but NOT cheap like
    # the other GET endpoints here: this re-runs Stage 1 inference
    # (_predict_stage1_baseline_hr) once per scored row, since
    # stage1_predicted_baseline_hr was never persisted anywhere — /simulate
    # only ever computes and returns it for a single day. Acceptable since
    # this endpoint isn't called often (one Caregiver Profiles sub-tab
    # visit, not a list/dashboard view) and a caregiver has at most ~70
    # scored rows.
    caregiver = _get_authorized_caregiver(caregiver_id, current_user)
    participant_id = caregiver["participant_id"]

    try:
        response = (
            supabase.table("daily_features")
            .select("feature_date, hr_mean, hr_dev_roll3, hr_dev_roll7")
            .eq("participant_id", participant_id)
            .not_.is_("risk_probability", "null")
            .order("feature_date", desc=False)
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query daily_features: {exc}"
        ) from exc

    history = []
    for row in response.data:
        try:
            expected_hr = _predict_stage1_baseline_hr(
                row["feature_date"], row.get("hr_dev_roll3"), row.get("hr_dev_roll7")
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to run Stage 1 inference for {row['feature_date']}: {exc}",
            ) from exc

        history.append({
            "feature_date": row["feature_date"],
            "actual_hr": row.get("hr_mean"),
            "expected_hr": expected_hr,
        })

    return {"history": history}


@app.post("/caregivers/{caregiver_id}/simulate")
def simulate_stress_risk(
    caregiver_id: str,
    date: str | None = Query(default=None, description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
) -> dict:
    # Step 1 — same authorization as before.
    caregiver = _get_authorized_caregiver(caregiver_id, current_user)
    participant_id = caregiver["participant_id"]

    # Step 2 — fetch the target daily_features row. Note hr_mean_deviation
    # is deliberately NOT selected here — hr_mean_deviation_model (Step 4)
    # replaces it as a computed feature, not a fetched one.
    try:
        features_query = (
            supabase.table("daily_features")
            .select(
                "feature_date, hr_mean, hr_std, hr_min, hr_max, hr_dev_roll3, "
                "hr_dev_roll7, number_steps, cardio_minutes, fat_burn_minutes, "
                "peak_minutes, out_of_range_minutes, resting_heart_rate, "
                "steps_deviation, sleep1efficiency, lag1_stress"
            )
            .eq("participant_id", participant_id)
        )
        if date:
            features_query = features_query.eq("feature_date", date)
        else:
            features_query = features_query.order("feature_date", desc=True).limit(1)

        features_response = features_query.execute()
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query daily_features: {exc}"
        ) from exc

    rows = features_response.data
    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No feature data available for this caregiver on this date",
        )
    feature_row = rows[0]
    feature_date = feature_row["feature_date"]

    try:
        # Step 3 — run Stage 1: predict this participant's expected HR for
        # this day from their own short-term trend.
        stage1_predicted_baseline_hr = _predict_stage1_baseline_hr(
            feature_date,
            feature_row.get("hr_dev_roll3"),
            feature_row.get("hr_dev_roll7"),
        )

        # Step 4 — a real, computed feature: how far actual HR deviates
        # from Stage 1's predicted personal baseline. Not fetched from
        # the database. Stays None (not NaN) when hr_mean itself is
        # missing, matching every other not-yet-known value in
        # raw_features below — the JSON response must never contain a
        # bare NaN (invalid JSON), only null. Model-input normalization to
        # np.nan happens separately, in the raw_array below.
        raw_hr_mean = feature_row.get("hr_mean")
        hr_mean_deviation_model = (
            raw_hr_mean - stage1_predicted_baseline_hr if raw_hr_mean is not None else None
        )

        # Step 5 — build the full 16-value feature vector and impute.
        # Imputed positionally (see the NOTE by FEATURE_ORDER above)
        # rather than via a named DataFrame, since stage2_imputer's
        # fitted column names don't match FEATURE_ORDER even though
        # their order does.
        raw_features = {
            "hr_mean": feature_row.get("hr_mean"),
            "hr_std": feature_row.get("hr_std"),
            "hr_min": feature_row.get("hr_min"),
            "hr_max": feature_row.get("hr_max"),
            "hr_mean_deviation_model": hr_mean_deviation_model,
            "hr_dev_roll3": feature_row.get("hr_dev_roll3"),
            "hr_dev_roll7": feature_row.get("hr_dev_roll7"),
            "number_steps": feature_row.get("number_steps"),
            "cardio_minutes": feature_row.get("cardio_minutes"),
            "fat_burn_minutes": feature_row.get("fat_burn_minutes"),
            "peak_minutes": feature_row.get("peak_minutes"),
            "out_of_range_minutes": feature_row.get("out_of_range_minutes"),
            "resting_heart_rate": feature_row.get("resting_heart_rate"),
            "steps_deviation": feature_row.get("steps_deviation"),
            "sleep1efficiency": feature_row.get("sleep1efficiency"),
            "lag1_stress": feature_row.get("lag1_stress"),
        }
        # raw_features keeps its original None values (not normalized)
        # because it's also returned verbatim in the response body below,
        # where a bare NaN would serialize to invalid JSON —
        # _run_stage2_inference does its own normalization internally via
        # _as_model_float before this ever reaches the model.
        #
        # Steps 6-7 — Stage 2 inference + SHAP.
        risk_probability, risk_prediction, shap_row = _run_stage2_inference(raw_features)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to run stress risk inference: {exc}"
        ) from exc

    factors = [
        {
            "feature": name,
            "label": FEATURE_LABELS[name],
            "shap_value": float(shap_value),
            "direction": "increases_risk" if shap_value > 0 else "decreases_risk",
        }
        for name, shap_value in zip(FEATURE_ORDER, shap_row)
    ]
    factors.sort(key=lambda factor: abs(factor["shap_value"]), reverse=True)

    # Step 8.
    return {
        "caregiver_id": caregiver["id"],
        "feature_date": feature_date,
        "risk_probability": risk_probability,
        "risk_prediction": risk_prediction,
        "top_factor": factors[0],
        "all_factors": factors,
        "raw_features": raw_features,
        "stage1_predicted_baseline_hr": stage1_predicted_baseline_hr,
        "hr_mean_deviation_model": hr_mean_deviation_model,
    }


# Thresholds checked against the real distribution of the 1000 currently-
# scored daily_features rows (min=0.263, mean=0.356, p90=0.489, max=0.602):
# >=0.5 captures the genuine top tail (4.5% of rows), 0.35-0.5 the next
# ~37%, and <0.35 the majority (~58%) — a sensible high/moderate/low split
# for this data, not an arbitrary guess.
HIGH_RISK_THRESHOLD = 0.5
MODERATE_RISK_THRESHOLD = 0.35


@app.get("/analytics/risk-summary")
def risk_summary(current_user: dict = Depends(get_current_user)) -> dict:
    # Read-only: pulls each in-scope caregiver's most recent scored
    # daily_features row. No model inference, no SHAP computation here.
    role = current_user["role"]

    query = supabase.table("caregiver_profiles").select("id, display_name, ward, participant_id")

    if role == "admin":
        pass
    elif role == "supervisor":
        # Same scoping as GET /caregivers — filtered explicitly here, not
        # left to RLS, since this client uses the service-role key.
        query = query.eq("supervisor_id", current_user["id"])
    else:
        raise HTTPException(
            status_code=403, detail="Admin or supervisor role required."
        )

    try:
        caregivers_response = query.execute()
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query caregiver_profiles: {exc}"
        ) from exc

    caregiver_rows = caregivers_response.data

    results = []
    high_risk_count = 0
    moderate_risk_count = 0
    low_risk_count = 0

    for caregiver in caregiver_rows:
        try:
            # limit(2), not limit(1): the second row (if present) is the
            # previous scored day, used for previous_risk_probability below.
            latest_response = (
                supabase.table("daily_features")
                .select("feature_date, risk_probability, risk_prediction, top_shap_factor")
                .eq("participant_id", caregiver["participant_id"])
                .not_.is_("risk_probability", "null")
                .order("feature_date", desc=True)
                .limit(2)
                .execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to query daily_features: {exc}"
            ) from exc

        latest_rows = latest_response.data
        # A caregiver with no scored rows yet (e.g. an unscored demo-pool
        # caregiver) is included with null risk fields, not omitted — the
        # frontend needs to know they exist even without data.
        latest = latest_rows[0] if latest_rows else None
        # None when fewer than 2 scored rows exist — never fabricated.
        previous = latest_rows[1] if len(latest_rows) > 1 else None
        risk_probability = latest["risk_probability"] if latest else None

        if risk_probability is not None:
            if risk_probability >= HIGH_RISK_THRESHOLD:
                high_risk_count += 1
            elif risk_probability >= MODERATE_RISK_THRESHOLD:
                moderate_risk_count += 1
            else:
                low_risk_count += 1

        results.append({
            "caregiver_id": caregiver["id"],
            "display_name": caregiver["display_name"],
            "ward": caregiver["ward"],
            "latest_risk_probability": risk_probability,
            "latest_risk_prediction": latest["risk_prediction"] if latest else None,
            "latest_feature_date": latest["feature_date"] if latest else None,
            "top_shap_factor": latest["top_shap_factor"] if latest else None,
            "previous_risk_probability": previous["risk_probability"] if previous else None,
        })

    return {
        "caregivers": results,
        "summary": {
            "total": len(caregiver_rows),
            "high_risk_count": high_risk_count,
            "moderate_risk_count": moderate_risk_count,
            "low_risk_count": low_risk_count,
        },
    }


@app.get("/analytics/risk-heatmap")
def risk_heatmap(
    days: int = Query(default=14),
    current_user: dict = Depends(get_current_user),
) -> dict:
    # Read-only: pulls each in-scope caregiver's last N scored
    # daily_features rows (N = days, default 14). No model inference, no
    # SHAP computation here.
    if days not in (7, 14, 30):
        raise HTTPException(
            status_code=400, detail="days must be one of 7, 14, or 30."
        )

    role = current_user["role"]

    query = supabase.table("caregiver_profiles").select("id, display_name, ward, participant_id")

    if role == "admin":
        pass
    elif role == "supervisor":
        # Same scoping as GET /caregivers — filtered explicitly here, not
        # left to RLS, since this client uses the service-role key.
        query = query.eq("supervisor_id", current_user["id"])
    else:
        raise HTTPException(
            status_code=403, detail="Admin or supervisor role required."
        )

    try:
        caregivers_response = query.execute()
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query caregiver_profiles: {exc}"
        ) from exc

    caregiver_rows = caregivers_response.data

    results = []
    for caregiver in caregiver_rows:
        try:
            # Last `days` scored rows, newest first for the LIMIT to take
            # the right slice, then reversed below to ascending (oldest ->
            # most recent) for output.
            days_response = (
                supabase.table("daily_features")
                .select("feature_date, risk_probability")
                .eq("participant_id", caregiver["participant_id"])
                .not_.is_("risk_probability", "null")
                .order("feature_date", desc=True)
                .limit(days)
                .execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to query daily_features: {exc}"
            ) from exc

        # A caregiver with zero scored rows is included with an empty days
        # list, not omitted — same reasoning as risk_summary above.
        #
        # Named day_rows (not days) deliberately — reusing `days` here would
        # shadow the `days` query-param for every caregiver after the first
        # in this loop, silently turning .limit(days) into .limit(<list>)
        # on the next iteration. (Confirmed live: this exact shadowing bug
        # existed while adding the days param and was caught by testing
        # each range end-to-end before shipping.)
        day_rows = list(reversed(days_response.data))

        results.append({
            "caregiver_id": caregiver["id"],
            "display_name": caregiver["display_name"],
            "ward": caregiver["ward"],
            "days": day_rows,
        })

    return {"caregivers": results}


@app.get("/analytics/team-trends")
def team_trends(current_user: dict = Depends(get_current_user)) -> dict:
    # Read-only: pulls every in-scope caregiver's full scored history and
    # aggregates it two ways — by ISO week (Monday-start), and by each
    # caregiver's single most recent scored day's top_shap_factor. No model
    # inference, no SHAP computation here — top_shap_factor is already
    # stored on daily_features from when it was originally scored.
    role = current_user["role"]

    query = supabase.table("caregiver_profiles").select("id, display_name, ward, participant_id")

    if role == "admin":
        pass
    elif role == "supervisor":
        # Same scoping as GET /caregivers — filtered explicitly here, not
        # left to RLS, since this client uses the service-role key.
        query = query.eq("supervisor_id", current_user["id"])
    else:
        raise HTTPException(
            status_code=403, detail="Admin or supervisor role required."
        )

    try:
        caregivers_response = query.execute()
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query caregiver_profiles: {exc}"
        ) from exc

    caregiver_rows = caregivers_response.data

    # week_start (ISO date string, the Monday of that week) -> running
    # aggregate. factor_counts mirrors Overview's "Team Contributing
    # Factors" card, which counts each caregiver's most-recent-scored-day
    # top_shap_factor — computed here server-side instead of client-side,
    # but the same definition.
    weekly_accum: dict[str, dict] = {}
    factor_counts: dict[str, int] = {}
    # ward -> running aggregate, built from each caregiver's single latest
    # scored row (same "latest" definition as latest_factor below) — not
    # every historical row, so caregiver_count/high_count/moderate_count/
    # low_count describe "how many caregivers in this ward are currently at
    # each risk level" rather than a historical tally.
    ward_accum: dict[str, dict] = {}
    # week_start -> {factor -> count}, built from every scored row (not
    # just each caregiver's latest) — same per-row loop as weekly_accum.
    week_factor_accum: dict[str, dict[str, int]] = {}

    for caregiver in caregiver_rows:
        try:
            rows_response = (
                supabase.table("daily_features")
                .select("feature_date, risk_probability, top_shap_factor")
                .eq("participant_id", caregiver["participant_id"])
                .not_.is_("risk_probability", "null")
                .order("feature_date", desc=False)
                .execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to query daily_features: {exc}"
            ) from exc

        rows = rows_response.data
        if not rows:
            continue

        for row in rows:
            feature_date = datetime.strptime(row["feature_date"], "%Y-%m-%d").date()
            week_start = (feature_date - timedelta(days=feature_date.weekday())).isoformat()
            probability = row["risk_probability"]

            bucket = weekly_accum.setdefault(
                week_start, {"sum": 0.0, "count": 0, "high": 0, "moderate": 0, "low": 0}
            )
            bucket["sum"] += probability
            bucket["count"] += 1
            if probability >= HIGH_RISK_THRESHOLD:
                bucket["high"] += 1
            elif probability >= MODERATE_RISK_THRESHOLD:
                bucket["moderate"] += 1
            else:
                bucket["low"] += 1

            row_factor = row["top_shap_factor"]
            if row_factor:
                week_factors = week_factor_accum.setdefault(week_start, {})
                week_factors[row_factor] = week_factors.get(row_factor, 0) + 1

        # rows is ordered ascending by feature_date, so the last element is
        # this caregiver's most recent scored day — same "most recent
        # scored day per caregiver" definition risk_summary above uses.
        latest_factor = rows[-1]["top_shap_factor"]
        if latest_factor:
            factor_counts[latest_factor] = factor_counts.get(latest_factor, 0) + 1

        # by_ward: only caregivers with both a ward and a non-null latest
        # risk_probability contribute — "rows" is guaranteed non-empty
        # here (the `if not rows: continue` above already skipped
        # caregivers with zero scored rows), so rows[-1]["risk_probability"]
        # is a real value, never None (this table's rows are only ever
        # fetched with risk_probability not null in the first place).
        ward = caregiver["ward"]
        if ward:
            latest_probability = rows[-1]["risk_probability"]
            ward_bucket = ward_accum.setdefault(
                ward, {"sum": 0.0, "count": 0, "high": 0, "moderate": 0, "low": 0}
            )
            ward_bucket["sum"] += latest_probability
            ward_bucket["count"] += 1
            if latest_probability >= HIGH_RISK_THRESHOLD:
                ward_bucket["high"] += 1
            elif latest_probability >= MODERATE_RISK_THRESHOLD:
                ward_bucket["moderate"] += 1
            else:
                ward_bucket["low"] += 1

    weekly = [
        {
            "week_start": week_start,
            "avg_risk_probability": bucket["sum"] / bucket["count"],
            "high_count": bucket["high"],
            "moderate_count": bucket["moderate"],
            "low_count": bucket["low"],
        }
        for week_start, bucket in sorted(weekly_accum.items())
    ]

    factor_counts_list = [
        {"factor": factor, "count": count}
        for factor, count in sorted(factor_counts.items(), key=lambda item: item[1], reverse=True)
    ]

    by_ward = [
        {
            "ward": ward,
            "caregiver_count": bucket["count"],
            "high_count": bucket["high"],
            "moderate_count": bucket["moderate"],
            "low_count": bucket["low"],
            "avg_risk_probability": bucket["sum"] / bucket["count"],
        }
        for ward, bucket in sorted(ward_accum.items())
    ]

    factor_trends_by_week = [
        {
            "week_start": week_start,
            "factors": [
                {"factor": factor, "count": count}
                for factor, count in sorted(factors.items(), key=lambda item: item[1], reverse=True)
            ],
        }
        for week_start, factors in sorted(week_factor_accum.items())
    ]

    return {
        "weekly": weekly,
        "factor_counts": factor_counts_list,
        "by_ward": by_ward,
        "factor_trends_by_week": factor_trends_by_week,
    }


@app.get("/analytics/model-performance")
def model_performance(current_user: dict = Depends(get_current_user)) -> dict:
    # Depends on get_current_user purely to require authentication — any
    # authenticated role may view this, it's aggregate model info, not
    # caregiver-specific data. current_user itself is unused.
    try:
        response = (
            supabase.table("model_registry")
            .select("model_name, version, trained_at, metrics")
            .eq("component", "stress_risk")
            .eq("is_active", True)
            .order("trained_at", desc=True)
            .limit(1)
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query model_registry: {exc}"
        ) from exc

    rows = response.data
    if not rows:
        raise HTTPException(
            status_code=404, detail="No active model found for this component"
        )

    return rows[0]


# Same split used elsewhere for classifying a single risk_probability
# (HIGH_RISK_THRESHOLD / MODERATE_RISK_THRESHOLD, defined above) — a
# candidate here must be "low" by that same definition: < MODERATE_RISK_THRESHOLD.
WORKLOAD_FIELDS_FOR_MATCHING = ("cardio_minutes", "peak_minutes", "fat_burn_minutes")


def _workload_sum(row: dict) -> float:
    return sum(row.get(field) or 0 for field in WORKLOAD_FIELDS_FOR_MATCHING)


def _join_facts(facts: list[str]) -> str:
    if len(facts) == 1:
        return facts[0]
    if len(facts) == 2:
        return f"{facts[0]} and {facts[1]}"
    return ", ".join(facts[:-1]) + f", and {facts[-1]}"


@app.post("/analytics/generate-redistribution-recommendations")
def generate_redistribution_recommendations(current_user: dict = Depends(get_current_user)) -> dict:
    # Admin and supervisor, scoped like most other analytics endpoints here
    # — but only for *which caregivers get evaluated/flagged*: a
    # supervisor's run only considers their own caregivers as candidates
    # for flagging. The candidate *search* below stays unscoped for every
    # role (queries all historical caregivers regardless of who supervises
    # them) — redistribution recommendations are meant to cross
    # supervisor boundaries; restricting matches to one supervisor's own
    # small team would defeat the point of the feature.
    role = current_user["role"]
    if role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="Admin or supervisor role required.")

    try:
        caregivers_response = (
            supabase.table("caregiver_profiles")
            .select("id, display_name, participant_id, real_shift, real_unit, supervisor_id")
            .eq("data_mode", "historical")
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query caregiver_profiles: {exc}"
        ) from exc

    caregiver_rows = caregivers_response.data

    if role == "admin":
        evaluable_caregivers = caregiver_rows
    else:
        evaluable_caregivers = [
            c for c in caregiver_rows if c.get("supervisor_id") == current_user["id"]
        ]

    # Every historical caregiver's last 5 scored rows, fetched once and
    # reused both for flagging (needs all 5) and candidate-matching (needs
    # only the most recent one, last5[0], for caregivers who don't
    # necessarily have 5) — one query per caregiver, same pattern as
    # team_trends/risk_summary above. Computed for *all* historical
    # caregivers (not just evaluable_caregivers) since a supervisor's
    # flagged caregiver can still be matched against a candidate outside
    # their team.
    last5_by_caregiver: dict[str, list[dict]] = {}
    for caregiver in caregiver_rows:
        try:
            rows_response = (
                supabase.table("daily_features")
                .select(
                    "feature_date, risk_probability, risk_prediction, "
                    "cardio_minutes, peak_minutes, fat_burn_minutes"
                )
                .eq("participant_id", caregiver["participant_id"])
                .not_.is_("risk_probability", "null")
                .order("feature_date", desc=True)
                .limit(5)
                .execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to query daily_features for caregiver {caregiver['id']}: {exc}",
            ) from exc
        last5_by_caregiver[caregiver["id"]] = rows_response.data

    # Step 1-2: flag caregivers with >=3 of their last 5 scored rows
    # predicted elevated. Caregivers with fewer than 5 scored rows are
    # skipped entirely — not enough history to judge "sustained". Only
    # evaluable_caregivers are considered here — the role-based scoping
    # point.
    flagged: list[dict] = []
    for caregiver in evaluable_caregivers:
        last5 = last5_by_caregiver[caregiver["id"]]
        if len(last5) < 5:
            continue
        elevated_count = sum(1 for row in last5 if row["risk_prediction"] == 1)
        if elevated_count >= 3:
            flagged.append({"caregiver": caregiver, "last5": last5, "elevated_count": elevated_count})

    # Step 3-5: for each flagged caregiver, search for a same-unit,
    # currently-low-risk candidate among every OTHER historical caregiver.
    for entry in flagged:
        caregiver = entry["caregiver"]
        flagged_latest = entry["last5"][0]  # last5 is ordered desc, so [0] is most recent
        flagged_workload = _workload_sum(flagged_latest)
        real_shift = caregiver.get("real_shift")
        real_unit = caregiver.get("real_unit")

        candidate_entry = None
        if real_unit is not None:
            # REQUIRE: same unit, and candidate's latest scored
            # risk_probability < MODERATE_RISK_THRESHOLD ("low").
            candidates = []
            for other in caregiver_rows:
                if other["id"] == caregiver["id"]:
                    continue
                if other.get("real_unit") != real_unit:
                    continue
                other_last5 = last5_by_caregiver.get(other["id"], [])
                if not other_last5:
                    continue
                other_latest = other_last5[0]
                other_risk = other_latest["risk_probability"]
                if other_risk >= MODERATE_RISK_THRESHOLD:
                    continue
                candidates.append({"caregiver": other, "latest": other_latest, "risk_probability": other_risk})

            # "If multiple candidates qualify, pick the one with the
            # lowest risk_probability" — the Day-shift/lighter-workload
            # traits below are preferences noted in the reasoning text for
            # whichever candidate wins on risk, not additional ranking
            # criteria that could override the lowest-risk pick.
            if candidates:
                candidate_entry = min(candidates, key=lambda c: c["risk_probability"])

        entry["real_shift"] = real_shift
        entry["real_unit"] = real_unit
        entry["flagged_latest"] = flagged_latest
        entry["flagged_workload"] = flagged_workload
        entry["candidate_entry"] = candidate_entry

        # Step 5: reasoning string built only from factors that actually
        # applied — no claimed unit/shift match beyond what was checked.
        sentences = [f"Sustained elevated risk ({entry['elevated_count']} of last 5 assessments)."]
        if real_unit is None:
            sentences.append("Unit not recorded for this caregiver, so no same-unit match could be identified.")
        else:
            if real_shift:
                sentences.append(f"Currently on {real_shift}.")
            if candidate_entry is None:
                sentences.append("No caregiver in the same unit currently has low enough risk to recommend as a match.")
            else:
                candidate = candidate_entry["caregiver"]
                candidate_risk = candidate_entry["risk_probability"]
                facts = ["shares the same unit", f"has low current risk ({candidate_risk * 100:.1f}%)"]
                if candidate.get("real_shift") == "Day shift":
                    facts.append("is on Day shift")
                if _workload_sum(candidate_entry["latest"]) < flagged_workload:
                    facts.append("has a lighter recent activity load")
                sentences.append(f"{candidate['display_name']} {_join_facts(facts)}.")

        entry["reasoning"] = " ".join(sentences)

    # Dedup: a caregiver who already has a *pending* recommendation
    # doesn't get a second one inserted on a repeat Generate click — only
    # checks status='pending', so a caregiver whose earlier recommendation
    # was already reviewed (or dismissed) is eligible for a fresh one if
    # they're still flagged, which is correct: that's a new episode, not a
    # duplicate of a resolved one.
    try:
        existing_pending_response = (
            supabase.table("redistribution_recommendations")
            .select("flagged_caregiver_id")
            .eq("status", "pending")
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to query existing redistribution_recommendations: {exc}",
        ) from exc

    already_pending_ids = {row["flagged_caregiver_id"] for row in existing_pending_response.data}
    newly_flagged = [entry for entry in flagged if entry["caregiver"]["id"] not in already_pending_ids]

    # Step 6: insert one row per newly-flagged caregiver (i.e. flagged this
    # run AND not already pending).
    insert_rows = [
        {
            "flagged_caregiver_id": entry["caregiver"]["id"],
            "suggested_caregiver_id": (
                entry["candidate_entry"]["caregiver"]["id"] if entry["candidate_entry"] else None
            ),
            "flagged_risk_probability": entry["flagged_latest"]["risk_probability"],
            "flagged_shift": entry["real_shift"],
            "flagged_unit": entry["real_unit"],
            "suggested_shift": (
                entry["candidate_entry"]["caregiver"].get("real_shift") if entry["candidate_entry"] else None
            ),
            "suggested_unit": (
                entry["candidate_entry"]["caregiver"].get("real_unit") if entry["candidate_entry"] else None
            ),
            "reasoning": entry["reasoning"],
        }
        for entry in newly_flagged
    ]

    inserted_rows = []
    if insert_rows:
        try:
            insert_response = (
                supabase.table("redistribution_recommendations").insert(insert_rows).execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to insert redistribution_recommendations: {exc}",
            ) from exc
        inserted_rows = insert_response.data

    # Step 7: full details of each *newly inserted* row (with its
    # generated id/generated_at/status) plus the caregiver names for
    # readability, since the table itself only stores ids. Caregivers
    # skipped by dedup above don't get a new row, so they're not repeated
    # here either — their existing pending row is already visible via
    # GET /analytics/redistribution-recommendations.
    recommendations = [
        {
            **db_row,
            "flagged_caregiver_name": entry["caregiver"]["display_name"],
            "suggested_caregiver_name": (
                entry["candidate_entry"]["caregiver"]["display_name"] if entry["candidate_entry"] else None
            ),
            # Already computed during matching above — no extra query
            # needed here (unlike the GET endpoint below, which doesn't
            # have this in memory and has to look it up fresh).
            "suggested_risk_probability": (
                entry["candidate_entry"]["risk_probability"] if entry["candidate_entry"] else None
            ),
        }
        for db_row, entry in zip(inserted_rows, newly_flagged)
    ]

    # flagged_count/matched_count/unmatched_count describe the full
    # evaluation this run found (unaffected by dedup) — dedup only changes
    # whether a *new row* gets written for an already-pending caregiver.
    matched_count = sum(1 for entry in flagged if entry["candidate_entry"] is not None)

    return {
        "flagged_count": len(flagged),
        "matched_count": matched_count,
        "unmatched_count": len(flagged) - matched_count,
        "recommendations": recommendations,
    }


@app.get("/analytics/redistribution-recommendations")
def list_redistribution_recommendations(current_user: dict = Depends(get_current_user)) -> dict:
    # Same role gate as the generate endpoint. Scoping: admin sees every
    # row; a supervisor sees only rows whose *flagged* caregiver is their
    # own — a suggested candidate belonging to a different supervisor is
    # still shown (that's the whole point of the redistribution feature),
    # just not used as a scoping filter itself.
    role = current_user["role"]
    if role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="Admin or supervisor role required.")

    try:
        recommendations_response = (
            supabase.table("redistribution_recommendations")
            .select("*")
            .order("generated_at", desc=True)
            .execute()
        )
        caregivers_response = (
            supabase.table("caregiver_profiles")
            .select("id, display_name, supervisor_id, participant_id")
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query redistribution data: {exc}"
        ) from exc

    caregiver_by_id = {c["id"]: c for c in caregivers_response.data}
    rows = recommendations_response.data

    if role == "supervisor":
        rows = [
            row
            for row in rows
            if caregiver_by_id.get(row["flagged_caregiver_id"], {}).get("supervisor_id")
            == current_user["id"]
        ]

    # The table only persists flagged_risk_probability, not a suggested
    # one — it was never stored anywhere (only ever embedded as text
    # inside the reasoning string at generation time). Fetched fresh here
    # per distinct suggested caregiver so the UI can show a real, current
    # risk % rather than parsing it back out of prose or fabricating it.
    # This reflects *now*, not the value at generation time — the more
    # honest choice given the alternative is persisting a second column
    # nothing else asked for.
    suggested_ids = {row["suggested_caregiver_id"] for row in rows if row["suggested_caregiver_id"]}
    suggested_risk_by_id: dict[str, float] = {}
    for suggested_id in suggested_ids:
        suggested_caregiver = caregiver_by_id.get(suggested_id)
        if not suggested_caregiver:
            continue
        try:
            latest_response = (
                supabase.table("daily_features")
                .select("risk_probability")
                .eq("participant_id", suggested_caregiver["participant_id"])
                .not_.is_("risk_probability", "null")
                .order("feature_date", desc=True)
                .limit(1)
                .execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to query daily_features: {exc}"
            ) from exc
        if latest_response.data:
            suggested_risk_by_id[suggested_id] = latest_response.data[0]["risk_probability"]

    # Only display_name is joined in here — flagged_unit/suggested_unit
    # (the real TILES-sourced unit, not the fabricated `ward` column) are
    # already present on each row itself, captured at generation time, so
    # there's no ward/unit join to get wrong here.
    results = []
    for row in rows:
        flagged_caregiver = caregiver_by_id.get(row["flagged_caregiver_id"])
        suggested_caregiver = (
            caregiver_by_id.get(row["suggested_caregiver_id"]) if row["suggested_caregiver_id"] else None
        )
        results.append({
            **row,
            "flagged_caregiver_name": flagged_caregiver["display_name"] if flagged_caregiver else None,
            "suggested_caregiver_name": suggested_caregiver["display_name"] if suggested_caregiver else None,
            "suggested_risk_probability": (
                suggested_risk_by_id.get(row["suggested_caregiver_id"]) if row["suggested_caregiver_id"] else None
            ),
        })

    return {"recommendations": results}


@app.post("/analytics/redistribution-recommendations/{recommendation_id}/mark-reviewed")
def mark_redistribution_recommendation_reviewed(
    recommendation_id: str, current_user: dict = Depends(get_current_user)
) -> dict:
    role = current_user["role"]
    if role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="Admin or supervisor role required.")

    try:
        rec_response = (
            supabase.table("redistribution_recommendations")
            .select("id, flagged_caregiver_id")
            .eq("id", recommendation_id)
            .maybe_single()
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to query redistribution_recommendations: {exc}"
        ) from exc

    rec = rec_response.data if rec_response else None
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found.")

    # A supervisor may only review recommendations flagging their own
    # caregiver — same ownership rule used to scope the list above.
    if role == "supervisor":
        try:
            caregiver_response = (
                supabase.table("caregiver_profiles")
                .select("supervisor_id")
                .eq("id", rec["flagged_caregiver_id"])
                .maybe_single()
                .execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to query caregiver_profiles: {exc}"
            ) from exc
        caregiver = caregiver_response.data if caregiver_response else None
        if not caregiver or caregiver.get("supervisor_id") != current_user["id"]:
            raise HTTPException(
                status_code=403, detail="You can only review recommendations for your own caregivers."
            )

    try:
        update_response = (
            supabase.table("redistribution_recommendations")
            .update({
                "status": "reviewed",
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "reviewed_by": current_user["id"],
            })
            .eq("id", recommendation_id)
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to update redistribution_recommendations: {exc}"
        ) from exc

    updated_rows = update_response.data
    if not updated_rows:
        raise HTTPException(status_code=404, detail="Recommendation not found.")

    return updated_rows[0]


# Distinct from the real historical batch's 'model_ready_with_sleep_v1'
# (confirmed live: every existing daily_features row uses that one value,
# and nothing in this file filters or branches on it) — rows inserted by
# the live demo-reveal pipeline get their own label so they stay clearly
# identifiable/separable from the real TILES-derived batch later.
FEATURE_PIPELINE_VERSION_DEMO_REVEAL = "demo_reveal_v1"

DS_FILE_REQUIRED_COLUMNS = (
    "Timestamp",
    "NumberSteps",
    "Cardio_minutes",
    "Fat Burn_minutes",
    "Peak_minutes",
    "Out of Range_minutes",
    "RestingHeartRate",
    "Sleep1Efficiency",
)


@app.post("/admin/upload-raw-data/{caregiver_id}")
async def upload_raw_data(
    caregiver_id: str,
    hr_file: UploadFile = File(...),
    ds_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required.")

    # pandas' compression="gzip" handles the decompression itself — no
    # separate gzip.decompress() needed, just a file-like object.
    try:
        hr_df = pd.read_csv(io.BytesIO(await hr_file.read()), compression="gzip")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse hr_file: {exc}") from exc
    try:
        ds_df = pd.read_csv(io.BytesIO(await ds_file.read()), compression="gzip")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse ds_file: {exc}") from exc

    for column in ("Timestamp", "HeartRatePPG"):
        if column not in hr_df.columns:
            raise HTTPException(status_code=400, detail=f"hr_file is missing required column: {column}")
    for column in DS_FILE_REQUIRED_COLUMNS:
        if column not in ds_df.columns:
            raise HTTPException(status_code=400, detail=f"ds_file is missing required column: {column}")

    try:
        hr_df["_date"] = pd.to_datetime(hr_df["Timestamp"]).dt.date
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse hr_file Timestamp column: {exc}") from exc
    try:
        ds_df["_date"] = pd.to_datetime(ds_df["Timestamp"]).dt.date
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse ds_file Timestamp column: {exc}") from exc

    # hr_file is per-reading — grouped by date into daily mean/std/min/max.
    # ds_file is already one row per day, per the spec — no aggregation.
    hr_daily = hr_df.groupby("_date")["HeartRatePPG"].agg(["mean", "std", "min", "max"])

    records: dict = {}
    for feature_date, row in hr_daily.iterrows():
        records.setdefault(feature_date, {})
        records[feature_date]["hr_mean_full"] = _safe_float(row["mean"])
        records[feature_date]["hr_std"] = _safe_float(row["std"])
        records[feature_date]["hr_min"] = _safe_float(row["min"])
        records[feature_date]["hr_max"] = _safe_float(row["max"])

    # If a date somehow appears more than once in ds_file, the last row
    # wins — simple, predictable, matches plain dict-assignment semantics.
    for _, row in ds_df.iterrows():
        feature_date = row["_date"]
        records.setdefault(feature_date, {})
        records[feature_date]["number_steps"] = _safe_float(row.get("NumberSteps"))
        records[feature_date]["cardio_minutes"] = _safe_float(row.get("Cardio_minutes"))
        records[feature_date]["fat_burn_minutes"] = _safe_float(row.get("Fat Burn_minutes"))
        records[feature_date]["peak_minutes"] = _safe_float(row.get("Peak_minutes"))
        records[feature_date]["out_of_range_minutes"] = _safe_float(row.get("Out of Range_minutes"))
        records[feature_date]["resting_heart_rate"] = _safe_float(row.get("RestingHeartRate"))
        records[feature_date]["sleep1efficiency"] = _safe_float(row.get("Sleep1Efficiency"))

    if not records:
        raise HTTPException(status_code=400, detail="No parseable dates found in either file.")

    # raw_upload_staging.number_steps is a float column (unlike
    # daily_features.number_steps, which is integer) — no int cast needed
    # here, only at the point it's later copied into daily_features in
    # reveal_next_day below.
    upsert_rows = [
        {
            "caregiver_id": caregiver_id,
            "feature_date": feature_date.isoformat(),
            "hr_mean_full": fields.get("hr_mean_full"),
            "hr_std": fields.get("hr_std"),
            "hr_min": fields.get("hr_min"),
            "hr_max": fields.get("hr_max"),
            "number_steps": fields.get("number_steps"),
            "cardio_minutes": fields.get("cardio_minutes"),
            "fat_burn_minutes": fields.get("fat_burn_minutes"),
            "peak_minutes": fields.get("peak_minutes"),
            "out_of_range_minutes": fields.get("out_of_range_minutes"),
            "resting_heart_rate": fields.get("resting_heart_rate"),
            "sleep1efficiency": fields.get("sleep1efficiency"),
            "revealed": False,
        }
        for feature_date, fields in sorted(records.items())
    ]

    # on_conflict targets the table's unique(caregiver_id, feature_date).
    # Confirmed against the installed postgrest-py's own upsert()
    # docstring: default_to_null only affects brand-new rows' missing
    # columns, not merged (existing-row) updates — real_stress/revealed_at
    # are never in this payload, so a re-upload can't silently wipe
    # either of them on an already-staged day.
    try:
        supabase.table("raw_upload_staging").upsert(
            upsert_rows, on_conflict="caregiver_id,feature_date"
        ).execute()
    except PostgrestAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upsert raw_upload_staging: {exc}") from exc

    sorted_dates = sorted(records.keys())
    return {
        "days_staged": len(upsert_rows),
        "date_range": {"first": sorted_dates[0].isoformat(), "last": sorted_dates[-1].isoformat()},
    }


@app.post("/admin/upload-survey-responses/{caregiver_id}")
async def upload_survey_responses(
    caregiver_id: str,
    ema_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> dict:
    # Replaces the old single-date POST /admin/insert-survey-response —
    # real EMA exports have multiple responses per day (a participant
    # could answer more than once), so this needs to pick one, not accept
    # a single pre-picked value.
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required.")

    # ema_file is a plain .csv (not gzip-compressed, unlike hr_file/ds_file
    # in upload_raw_data above) — matches the frontend's plain file picker.
    try:
        ema_df = pd.read_csv(io.BytesIO(await ema_file.read()))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse ema_file: {exc}") from exc

    for column in ("date", "sent_ts_parsed", "stress"):
        if column not in ema_df.columns:
            raise HTTPException(status_code=400, detail=f"ema_file is missing required column: {column}")

    try:
        ema_df["_date"] = pd.to_datetime(ema_df["date"]).dt.date
        ema_df["_sent_ts"] = pd.to_datetime(ema_df["sent_ts_parsed"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse ema_file date columns: {exc}") from exc

    # Sort ascending by sent_ts_parsed, then take the last row per date —
    # that's the response with the latest timestamp for that day (the
    # "last real response of the day"), not just the last row in file order.
    ema_df = ema_df.sort_values("_sent_ts")
    latest_per_date = ema_df.groupby("_date").last()

    try:
        staged_response = (
            supabase.table("raw_upload_staging")
            .select("feature_date")
            .eq("caregiver_id", caregiver_id)
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to query raw_upload_staging: {exc}") from exc

    staged_dates = {row["feature_date"] for row in staged_response.data}

    dates_matched = 0
    dates_in_file_with_no_staged_row = 0

    for feature_date, row in latest_per_date.iterrows():
        date_str = feature_date.isoformat()
        if date_str not in staged_dates:
            # Only HR/summary uploads create staging rows — a date with no
            # staged row is skipped here, never inserted as a new row.
            dates_in_file_with_no_staged_row += 1
            continue
        try:
            supabase.table("raw_upload_staging").update(
                {"real_stress": _safe_float(row["stress"])}
            ).eq("caregiver_id", caregiver_id).eq("feature_date", date_str).execute()
        except PostgrestAPIError as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to update raw_upload_staging: {exc}"
            ) from exc
        dates_matched += 1

    return {
        "dates_matched": dates_matched,
        "dates_in_file_with_no_staged_row": dates_in_file_with_no_staged_row,
    }


@app.post("/admin/reveal-next-day/{caregiver_id}")
def reveal_next_day(caregiver_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required.")

    try:
        next_response = (
            supabase.table("raw_upload_staging")
            .select("*")
            .eq("caregiver_id", caregiver_id)
            .eq("revealed", False)
            .order("feature_date", desc=False)
            .limit(1)
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to query raw_upload_staging: {exc}") from exc

    next_rows = next_response.data
    if not next_rows:
        raise HTTPException(status_code=404, detail="No more days to reveal.")
    next_day = next_rows[0]

    try:
        caregiver_response = (
            supabase.table("caregiver_profiles")
            .select("participant_id")
            .eq("id", caregiver_id)
            .maybe_single()
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to query caregiver_profiles: {exc}") from exc

    caregiver = caregiver_response.data if caregiver_response else None
    if not caregiver:
        raise HTTPException(status_code=404, detail="Caregiver not found.")
    participant_id = caregiver["participant_id"]

    try:
        revealed_response = (
            supabase.table("raw_upload_staging")
            .select("*")
            .eq("caregiver_id", caregiver_id)
            .eq("revealed", True)
            .lt("feature_date", next_day["feature_date"])
            .order("feature_date", desc=False)
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to query raw_upload_staging: {exc}") from exc

    already_revealed = revealed_response.data  # ascending by feature_date

    # hr_dev_roll3/roll7: a running personal baseline = mean hr_mean_full
    # across every already-revealed day strictly before this one, then the
    # average deviation from that SAME baseline over the last 3 (or 7) of
    # those days — both windows share one baseline value, per spec ("same
    # but last 7"). Rows missing hr_mean_full are skipped from both the
    # baseline and the rolling average rather than breaking the calculation.
    # Fewer than 3 (or 7) available days is fine — the average just runs
    # over however many exist, never blocking an early reveal.
    hr_days = [row for row in already_revealed if row["hr_mean_full"] is not None]
    if hr_days:
        baseline_hr = sum(row["hr_mean_full"] for row in hr_days) / len(hr_days)
        last3 = hr_days[-3:]
        last7 = hr_days[-7:]
        hr_dev_roll3 = sum(row["hr_mean_full"] - baseline_hr for row in last3) / len(last3)
        hr_dev_roll7 = sum(row["hr_mean_full"] - baseline_hr for row in last7) / len(last7)
    else:
        hr_dev_roll3 = None
        hr_dev_roll7 = None

    # lag1_stress: the immediately preceding revealed day's real_stress
    # value, literally — null when there is no preceding revealed day, or
    # when that day has no real_stress attached yet. NOTE: this stores the
    # raw real_stress value (not a binarized 0/1), per the spec's exact
    # wording ("the real_stress value of the immediately preceding
    # revealed day") — the historical daily_features.lag1_stress column
    # was originally the *lagged stress_binary* (see migration 0011's
    # comment), so if real_stress isn't already a 0/1 scale in your EMA
    # data, this demo-reveal pipeline's lag1_stress won't mean quite the
    # same thing as the historical rows'. Flagging this rather than
    # silently binarizing it myself, since the spec was explicit. Rounded
    # to int only for the column's actual type (integer) — not a semantic
    # change if real_stress is already a whole-number scale.
    lag1_stress = already_revealed[-1]["real_stress"] if already_revealed else None

    # steps_deviation: this day's number_steps minus the mean number_steps
    # across all already-revealed days INCLUDING this one (per spec — the
    # one place this differs from the hr baseline above, which explicitly
    # excludes the current day).
    steps_pool = [row["number_steps"] for row in already_revealed if row["number_steps"] is not None]
    if next_day["number_steps"] is not None:
        steps_pool.append(next_day["number_steps"])
    if steps_pool and next_day["number_steps"] is not None:
        steps_deviation = next_day["number_steps"] - (sum(steps_pool) / len(steps_pool))
    else:
        steps_deviation = None

    real_stress = next_day["real_stress"]
    stress_binary = None if real_stress is None else (1 if real_stress >= 3 else 0)

    # Once this day has 7+ *prior* already-revealed days (i.e. this is the
    # 8th or later reveal), run the exact same Stage 1 + Stage 2 + SHAP
    # pipeline /simulate uses and store the result directly on this row —
    # so GET /analytics/risk-summary (and everything built on it) reflects
    # real scored data the moment day 8+ is revealed, with no special-case
    # "run /simulate afterward" step needed anywhere else in the app.
    # Deliberately a stricter/different threshold than
    # enough_history_for_prediction below (day_number >= 7, i.e. this day
    # itself is the 7th) — that flag is about "do we have a decent trend
    # to show yet", this one is about "do we have a full prior week to
    # score against", which needs one more day.
    risk_probability = None
    risk_prediction = None
    top_shap_factor = None

    if len(already_revealed) >= 7:
        try:
            stage1_baseline_hr = _predict_stage1_baseline_hr(
                next_day["feature_date"], hr_dev_roll3, hr_dev_roll7
            )
            hr_mean_full = next_day["hr_mean_full"]
            hr_mean_deviation_model = (
                hr_mean_full - stage1_baseline_hr if hr_mean_full is not None else None
            )
            raw_features_for_scoring = {
                "hr_mean": next_day["hr_mean_full"],
                "hr_std": next_day["hr_std"],
                "hr_min": next_day["hr_min"],
                "hr_max": next_day["hr_max"],
                "hr_mean_deviation_model": hr_mean_deviation_model,
                "hr_dev_roll3": hr_dev_roll3,
                "hr_dev_roll7": hr_dev_roll7,
                "number_steps": next_day["number_steps"],
                "cardio_minutes": next_day["cardio_minutes"],
                "fat_burn_minutes": next_day["fat_burn_minutes"],
                "peak_minutes": next_day["peak_minutes"],
                "out_of_range_minutes": next_day["out_of_range_minutes"],
                "resting_heart_rate": next_day["resting_heart_rate"],
                "steps_deviation": steps_deviation,
                "sleep1efficiency": next_day["sleep1efficiency"],
                "lag1_stress": lag1_stress,
            }
            risk_probability, risk_prediction, shap_row = _run_stage2_inference(
                raw_features_for_scoring
            )
            top_index = max(range(len(FEATURE_ORDER)), key=lambda i: abs(shap_row[i]))
            top_shap_factor = FEATURE_ORDER[top_index]
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to run stress risk inference: {exc}"
            ) from exc

    daily_features_row = {
        "participant_id": participant_id,
        "feature_date": next_day["feature_date"],
        "hr_mean": next_day["hr_mean_full"],
        "hr_std": next_day["hr_std"],
        "hr_min": next_day["hr_min"],
        "hr_max": next_day["hr_max"],
        "hr_dev_roll3": hr_dev_roll3,
        "hr_dev_roll7": hr_dev_roll7,
        # daily_features.number_steps is `integer` (unlike
        # raw_upload_staging.number_steps, a float column) — cast here,
        # at the point it crosses into that column, not earlier.
        "number_steps": _safe_int(next_day["number_steps"]),
        "cardio_minutes": next_day["cardio_minutes"],
        "fat_burn_minutes": next_day["fat_burn_minutes"],
        "peak_minutes": next_day["peak_minutes"],
        "out_of_range_minutes": next_day["out_of_range_minutes"],
        "resting_heart_rate": next_day["resting_heart_rate"],
        "steps_deviation": steps_deviation,
        "sleep1efficiency": next_day["sleep1efficiency"],
        "lag1_stress": _safe_int(lag1_stress),
        "stress_binary": stress_binary,
        "feature_pipeline_version": FEATURE_PIPELINE_VERSION_DEMO_REVEAL,
        "risk_probability": risk_probability,
        "risk_prediction": risk_prediction,
        "top_shap_factor": top_shap_factor,
    }

    try:
        supabase.table("daily_features").insert(daily_features_row).execute()
    except PostgrestAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to insert daily_features: {exc}") from exc

    try:
        supabase.table("raw_upload_staging").update({
            "revealed": True,
            "revealed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", next_day["id"]).execute()
    except PostgrestAPIError as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to update raw_upload_staging: {exc}"
        ) from exc

    day_number = len(already_revealed) + 1

    return {
        "revealed_date": next_day["feature_date"],
        "day_number": day_number,
        "enough_history_for_prediction": day_number >= 7,
        # Same values just written to daily_features above — returned
        # directly so the frontend can render the chart/status line
        # immediately after this call, without a second round-trip.
        # Null on days 1-7, real once len(already_revealed) >= 7 above.
        "risk_probability": risk_probability,
        "risk_prediction": risk_prediction,
        "top_shap_factor": top_shap_factor,
    }


@app.get("/admin/staging-status/{caregiver_id}")
def staging_status(caregiver_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required.")

    try:
        response = (
            supabase.table("raw_upload_staging")
            .select("feature_date, revealed, hr_mean_full, number_steps, sleep1efficiency, real_stress")
            .eq("caregiver_id", caregiver_id)
            .order("feature_date", desc=False)
            .execute()
        )
    except PostgrestAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to query raw_upload_staging: {exc}") from exc

    days = response.data
    revealed_count = sum(1 for day in days if day["revealed"])

    return {
        "total_staged": len(days),
        "revealed_count": revealed_count,
        "days": days,
    }
