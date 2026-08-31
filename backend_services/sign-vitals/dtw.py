"""
dtw.py
GLOSS component — Dynamic Time Warping distance.

The original "Layer 3" DTW notebook could not be located. This formula
was instead reverse-engineered by testing candidate implementations
against real calibration evidence (dtw_calibration_distances.csv,
reference_exemplars.npz/.csv) and confirming the result reproduces the
stored calibration numbers. Confirmed:

  - DTW operates on the ORIGINAL VARIABLE-LENGTH normalized sequence
    (147-dim: 49 landmarks x x,y,z) — i.e. preprocessing.py's
    dtw_sequence output, NOT the 60-frame resampled `positional` array
    and NOT the 441-dim kinematic/standardized TCN tensor. Confirmed
    both by the training notebook (cell 23: "for DTW in Layer 3, which
    needs the *unresampled* normalized sequences too") and by
    dtw_calibration_distances.csv's seq_len/ref_len columns, which
    vary row to row (i.e. never resampled to a fixed length).
  - class_thresholds.json's strong_max/moderate_max are on this raw,
    unnormalized distance scale (hundreds-thousands) — not any
    length-normalized variant.
  - The formula below (symmetric-step DP, full 147-dim Euclidean
    per-frame cost, no windowing) reproduced 4 independently-tested
    classes' stored inter_class calibration distances to within
    0.4%-3% (one outlier at 15%, still correctly identifying the true
    comparison class as closest match by a clear margin every time).
    This rules out alternative formulas (mean-per-frame, XY-only,
    weighted subsets), which would have missed by a large structural
    margin rather than a few percent.

The exact statistical method used to derive strong_max/moderate_max
from calibration distances was NOT reverse-engineered (percentiles,
mean +/- k*std — none matched cleanly). This doesn't block usage here:
class_thresholds.json's cutoffs are fixed, already-computed values: a
new attempt's distance (via dtw_distance() below) is compared against
them, not used to regenerate them.
"""

import numpy as np


def _compute_cost_matrix(seq_a, seq_b):
    """
    Shared computation for dtw_distance() and dtw_distance_with_path():
    the per-frame Euclidean cost matrix and the cumulative DP cost
    matrix, symmetric-step, no windowing/banding constraint, with the
    standard first-row/first-column cumulative-sum boundary
    conditions.

    seq_a, seq_b: (Ta, F) and (Tb, F) arrays — variable length, same F.

    Returns: (D,) — the (Ta, Tb) cumulative cost matrix. D[Ta-1, Tb-1]
      is the total DTW distance; backtracking from there through D
      (see dtw_distance_with_path()) gives the alignment path.
    """
    seq_a = np.asarray(seq_a, dtype=np.float64)
    seq_b = np.asarray(seq_b, dtype=np.float64)
    Ta, Tb = seq_a.shape[0], seq_b.shape[0]

    if Ta == 0 or Tb == 0:
        raise ValueError(f"DTW requires non-empty sequences, got Ta={Ta} Tb={Tb}")

    # Pairwise per-frame Euclidean cost matrix (Ta, Tb).
    diff = seq_a[:, None, :] - seq_b[None, :, :]
    cost = np.sqrt(np.sum(diff ** 2, axis=-1))

    D = np.zeros((Ta, Tb), dtype=np.float64)
    D[0, 0] = cost[0, 0]
    for i in range(1, Ta):
        D[i, 0] = D[i - 1, 0] + cost[i, 0]
    for j in range(1, Tb):
        D[0, j] = D[0, j - 1] + cost[0, j]
    for i in range(1, Ta):
        for j in range(1, Tb):
            D[i, j] = cost[i, j] + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])

    return D


def _backtrack_path(D):
    """
    Standard DTW backtracking: starting at (Ta-1, Tb-1), repeatedly
    step to whichever of (i-1,j), (i,j-1), (i-1,j-1) produced the
    minimum cumulative cost, until reaching (0,0).

    Returns: list of (i, j) tuples, ordered from (0,0) to (Ta-1, Tb-1).
    """
    Ta, Tb = D.shape
    i, j = Ta - 1, Tb - 1
    path = [(i, j)]
    while i > 0 or j > 0:
        if i == 0:
            j -= 1
        elif j == 0:
            i -= 1
        else:
            candidates = (D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
            step = int(np.argmin(candidates))
            if step == 0:
                i -= 1
            elif step == 1:
                j -= 1
            else:
                i -= 1
                j -= 1
        path.append((i, j))
    path.reverse()
    return path


def dtw_distance(seq_a, seq_b) -> float:
    """
    Standard DTW: symmetric-step dynamic programming over cumulative
    path cost, per-frame cost = full Euclidean distance across all
    dimensions, no windowing/banding constraint.

    seq_a, seq_b: (Ta, F) and (Tb, F) arrays — variable length, same F
      (147 for GLOSS DTW sequences). Order doesn't matter (DTW is
      symmetric under this formulation).

    Returns: the raw cumulative path cost D[Ta-1, Tb-1] (unnormalized
      float) — directly comparable to class_thresholds.json's
      strong_max/moderate_max.
    """
    D = _compute_cost_matrix(seq_a, seq_b)
    Ta, Tb = D.shape
    return float(D[Ta - 1, Tb - 1])


def dtw_distance_with_path(seq_a, seq_b):
    """
    Same DTW computation as dtw_distance(), but also returns the
    alignment path (via backtracking through the same cost matrix —
    the cost matrix computation is not duplicated, see
    _compute_cost_matrix()).

    Returns: (distance, path) — distance is identical to what
      dtw_distance(seq_a, seq_b) would return; path is a list of
      (i, j) tuples from (0, 0) to (Ta-1, Tb-1).
    """
    D = _compute_cost_matrix(seq_a, seq_b)
    Ta, Tb = D.shape
    distance = float(D[Ta - 1, Tb - 1])
    path = _backtrack_path(D)
    return distance, path
