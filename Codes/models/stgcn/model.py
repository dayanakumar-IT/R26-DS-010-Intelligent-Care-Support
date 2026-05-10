"""
Spatio-Temporal Graph Convolutional Network (ST-GCN).

Architecture follows Yan, Xiong, Lin (AAAI 2018):
  "Spatial Temporal Graph Convolutional Networks for Skeleton-Based
   Action Recognition"

================================================================
PIPELINE
================================================================
Input  : (N, C=3, T=100, V=14)        — channels-first skeleton tensor
       └─ BatchNorm over (C * V)       (per-joint, per-channel)

Stack of 10 ST-GCN blocks (the standard depth from the paper):
    Block 1: 3   -> 64    stride 1
    Block 2: 64  -> 64    stride 1
    Block 3: 64  -> 64    stride 1
    Block 4: 64  -> 64    stride 1
    Block 5: 64  -> 128   stride 2  (temporal downsample)
    Block 6: 128 -> 128   stride 1
    Block 7: 128 -> 128   stride 1
    Block 8: 128 -> 256   stride 2  (temporal downsample)
    Block 9: 256 -> 256   stride 1
    Block 10:256 -> 256   stride 1

Pool   : global avg over (T, V)
FC     : 256 -> num_classes

Spatial graph conv uses the (3, V, V) partitioned adjacency from
graph.py: identity / centripetal / centrifugal. Each block adds a
learnable edge mask that lets the network up-weight or suppress
specific bones — this is the "edge importance" trick from the paper
that meaningfully improves the deep model.

Each block: spatial GCN -> BN -> ReLU -> temporal Conv2d (kernel
9x1) -> BN -> dropout -> residual -> ReLU. Residuals stay
dimensionally consistent via a 1x1 conv when channels or temporal
stride changes.
"""

import torch
import torch.nn as nn

from graph import build_adjacency, NUM_JOINTS


# ============================================================
# SPATIAL GRAPH CONVOLUTION
# ============================================================
class SpatialGraphConv(nn.Module):
    """y[n,c,t,w] = sum_k sum_v  W_k[c, c_in] * x[n, c_in, t, v] * A_k[v, w]

    Implemented as one 1x1 conv producing K * C_out channels, then
    an einsum that contracts the K and V dimensions against the
    (K, V, V) adjacency.
    """

    def __init__(self, in_channels: int, out_channels: int, num_partitions: int = 3):
        super().__init__()
        self.K = num_partitions
        self.conv = nn.Conv2d(
            in_channels,
            out_channels * num_partitions,
            kernel_size=(1, 1),
        )

    def forward(self, x: torch.Tensor, A: torch.Tensor) -> torch.Tensor:
        # x: (N, C_in, T, V) ;  A: (K, V, V)
        N, _, T, V = x.shape
        x = self.conv(x)
        C_out = x.shape[1] // self.K
        x = x.view(N, self.K, C_out, T, V)
        # contract K and V
        return torch.einsum("nkctv,kvw->nctw", x, A)


# ============================================================
# ST-GCN BLOCK
# ============================================================
class STGCNBlock(nn.Module):
    """One spatio-temporal block.

    Spatial:    GCN -> BN -> ReLU
    Temporal:   Conv2d(kernel=(t_kernel, 1), stride=(stride, 1))
                -> BN -> dropout
    Residual:   identity if same shape, else 1x1 conv with stride

    Output: ReLU(spatial+temporal output + residual).
    """

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        t_kernel: int = 9,
        stride: int = 1,
        dropout: float = 0.0,
        residual: bool = True,
    ):
        super().__init__()
        assert t_kernel % 2 == 1, "t_kernel must be odd"
        pad_t = (t_kernel - 1) // 2

        self.gcn = SpatialGraphConv(in_channels, out_channels)
        self.bn1 = nn.BatchNorm2d(out_channels)

        self.tcn = nn.Sequential(
            nn.Conv2d(
                out_channels,
                out_channels,
                kernel_size=(t_kernel, 1),
                stride=(stride, 1),
                padding=(pad_t, 0),
            ),
            nn.BatchNorm2d(out_channels),
            nn.Dropout(dropout, inplace=True),
        )

        if not residual:
            self.residual = lambda x: 0
        elif in_channels == out_channels and stride == 1:
            self.residual = nn.Identity()
        else:
            self.residual = nn.Sequential(
                nn.Conv2d(
                    in_channels,
                    out_channels,
                    kernel_size=(1, 1),
                    stride=(stride, 1),
                ),
                nn.BatchNorm2d(out_channels),
            )

        self.relu = nn.ReLU(inplace=True)

        # Learnable per-edge importance mask, multiplied into A at runtime.
        # Initialised at 1.0 so the model starts equivalent to a vanilla
        # ST-GCN.
        self.edge_importance = nn.Parameter(torch.ones(3, NUM_JOINTS, NUM_JOINTS))

    def forward(self, x: torch.Tensor, A: torch.Tensor) -> torch.Tensor:
        res = self.residual(x)
        x = self.gcn(x, A * self.edge_importance)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.tcn(x)
        x = self.relu(x + res)
        return x


# ============================================================
# FULL ST-GCN
# ============================================================
class STGCN(nn.Module):
    def __init__(
        self,
        num_classes: int = 3,
        in_channels: int = 3,
        t_kernel: int = 9,
        dropout: float = 0.5,
    ):
        super().__init__()

        # Persist the adjacency as a non-trainable buffer.
        A = torch.tensor(build_adjacency(), dtype=torch.float32)
        self.register_buffer("A", A)

        self.input_bn = nn.BatchNorm1d(in_channels * NUM_JOINTS)

        # Standard ST-GCN channel ladder.
        configs = [
            #  in,  out, stride
            (in_channels,  64, 1),
            ( 64,  64, 1),
            ( 64,  64, 1),
            ( 64,  64, 1),
            ( 64, 128, 2),
            (128, 128, 1),
            (128, 128, 1),
            (128, 256, 2),
            (256, 256, 1),
            (256, 256, 1),
        ]

        # Block 1 has no residual (residual=True with channel mismatch
        # would still work via the 1x1 conv path, but the original paper
        # uses a plain first block).
        self.blocks = nn.ModuleList()
        for i, (c_in, c_out, stride) in enumerate(configs):
            block = STGCNBlock(
                in_channels=c_in,
                out_channels=c_out,
                t_kernel=t_kernel,
                stride=stride,
                dropout=dropout if i > 0 else 0.0,
                residual=(i > 0),
            )
            self.blocks.append(block)

        self.classifier = nn.Conv2d(256, num_classes, kernel_size=(1, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (N, C, T, V)
        N, C, T, V = x.shape

        # Per-joint, per-channel input BN
        x = x.permute(0, 1, 3, 2).contiguous().view(N, C * V, T)
        x = self.input_bn(x)
        x = x.view(N, C, V, T).permute(0, 1, 3, 2).contiguous()  # back to (N,C,T,V)

        for block in self.blocks:
            x = block(x, self.A)

        # Global average pool over T, V; then 1x1 conv classifier.
        x = x.mean(dim=(2, 3), keepdim=True)         # (N, 256, 1, 1)
        x = self.classifier(x)                       # (N, num_classes, 1, 1)
        return x.view(N, -1)                         # (N, num_classes)

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


if __name__ == "__main__":
    model = STGCN(num_classes=3, in_channels=3, t_kernel=9)
    x = torch.randn(2, 3, 100, 14)
    y = model(x)
    print(f"Output shape   : {tuple(y.shape)}")
    print(f"Trainable params: {model.count_parameters():,}")
