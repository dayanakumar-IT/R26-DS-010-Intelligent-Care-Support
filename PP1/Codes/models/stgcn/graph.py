"""
14-joint skeletal graph for ST-GCN.

================================================================
JOINT INDICES (must match map_common_joints.py)
================================================================
    0  head
    1  left_shoulder      2  right_shoulder
    3  left_elbow         4  right_elbow
    5  left_wrist         6  right_wrist
    7  left_hip           8  right_hip
    9  left_knee         10  right_knee
   11  left_ankle        12  right_ankle
   13  spine (centre — average of shoulders & hips)

================================================================
EDGES (kinematic tree)
================================================================
    spine <-> head, l_shoulder, r_shoulder, l_hip, r_hip
    l_shoulder <-> l_elbow <-> l_wrist
    r_shoulder <-> r_elbow <-> r_wrist
    l_hip <-> l_knee <-> l_ankle
    r_hip <-> r_knee <-> r_ankle

================================================================
PARTITIONING STRATEGY (Yan et al., 2018)
================================================================
For each node, neighbours are split into 3 partitions:
    K=0 : the node itself        (self-connection)
    K=1 : centripetal neighbours (closer to skeleton centre)
    K=2 : centrifugal neighbours (further from skeleton centre)

We measure "closer / further" by graph distance to the spine
(node 13). The result is a (3, 14, 14) adjacency tensor that the
ST-GCN block multiplies the per-node features against.
"""

import numpy as np

NUM_JOINTS = 14
SPINE = 13

# Undirected edges of the kinematic tree.
EDGES = [
    (13, 0),   # spine - head
    (13, 1),   # spine - left_shoulder
    (13, 2),   # spine - right_shoulder
    (13, 7),   # spine - left_hip
    (13, 8),   # spine - right_hip
    (1, 3),    # left_shoulder - left_elbow
    (3, 5),    # left_elbow    - left_wrist
    (2, 4),    # right_shoulder - right_elbow
    (4, 6),    # right_elbow    - right_wrist
    (7, 9),    # left_hip   - left_knee
    (9, 11),   # left_knee  - left_ankle
    (8, 10),   # right_hip  - right_knee
    (10, 12),  # right_knee - right_ankle
]


def _bfs_distance(num_nodes: int, edges, source: int) -> np.ndarray:
    """Shortest-path graph distance from `source` to every node, BFS."""
    adj = [[] for _ in range(num_nodes)]
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)

    dist = -np.ones(num_nodes, dtype=np.int64)
    dist[source] = 0
    queue = [source]
    while queue:
        node = queue.pop(0)
        for nb in adj[node]:
            if dist[nb] == -1:
                dist[nb] = dist[node] + 1
                queue.append(nb)
    return dist


def build_adjacency(num_nodes: int = NUM_JOINTS,
                    edges=EDGES,
                    centre: int = SPINE) -> np.ndarray:
    """Return a (3, V, V) float32 adjacency tensor with the
    spatial-partitioning strategy.

    Each partition is symmetrically normalised:
        A_norm = D^{-1/2} (A + I if needed) D^{-1/2}
    so feature magnitudes do not grow unbounded as messages pass.
    """
    V = num_nodes

    # Step 1: build undirected adjacency (without self-loops yet)
    A_full = np.zeros((V, V), dtype=np.float32)
    for a, b in edges:
        A_full[a, b] = 1.0
        A_full[b, a] = 1.0

    # Step 2: graph distance from the centre to every node
    centre_dist = _bfs_distance(V, edges, centre)

    # Step 3: split A_full into three partitions
    A_self = np.eye(V, dtype=np.float32)
    A_centripetal = np.zeros_like(A_full)
    A_centrifugal = np.zeros_like(A_full)
    for i in range(V):
        for j in range(V):
            if A_full[i, j] == 0:
                continue
            if centre_dist[j] < centre_dist[i]:
                A_centripetal[i, j] = 1.0
            else:
                A_centrifugal[i, j] = 1.0

    parts = [A_self, A_centripetal, A_centrifugal]

    # Step 4: symmetric normalisation per partition
    A_out = np.zeros((3, V, V), dtype=np.float32)
    for k, A_k in enumerate(parts):
        deg = A_k.sum(axis=1)
        deg_inv_sqrt = np.zeros_like(deg)
        nz = deg > 0
        deg_inv_sqrt[nz] = 1.0 / np.sqrt(deg[nz])
        D = np.diag(deg_inv_sqrt)
        A_out[k] = D @ A_k @ D

    return A_out


if __name__ == "__main__":
    A = build_adjacency()
    print(f"Adjacency tensor shape: {A.shape}")
    print(f"Partition sums (per node, summed along incoming):")
    for k in range(3):
        names = ["self", "centripetal", "centrifugal"][k]
        print(f"  K={k} ({names:>11}): row-sum range "
              f"{A[k].sum(axis=1).min():.3f} .. {A[k].sum(axis=1).max():.3f}")
