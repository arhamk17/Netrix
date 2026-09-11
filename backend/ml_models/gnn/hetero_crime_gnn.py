import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import HeteroConv, SAGEConv


class HeteroCrimeGNN(nn.Module):
    """
    Multi-Task Heterogeneous Graph Neural Network for Criminal Intelligence.
    Learns joint embeddings across Suspects, Phones, Bank Accounts, FIRs, and IPs.
    Equipped with residual connections, symmetric link prediction, and AML edge classification.
    """
    def __init__(
        self,
        node_in_dims: dict,
        trans_attr_dim: int = 4,
        hidden_dim: int = 64,
        out_dim: int = 64,
        num_layers: int = 2,
        dropout: float = 0.2
    ):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.dropout = dropout

        # 1. Project all heterogeneous node feature dimensions into a common hidden_dim space
        self.node_projections = nn.ModuleDict({
            ntype: nn.Sequential(
                nn.Linear(in_dim, hidden_dim),
                nn.LayerNorm(hidden_dim),
                nn.ReLU()
            )
            for ntype, in_dim in node_in_dims.items()
        })

        # 2. Heterogeneous Message Passing Layers with Residual Connections
        self.convs = nn.ModuleList()
        self.norms = nn.ModuleList()

        for _ in range(num_layers):
            conv_dict = {
                ("account", "transfers_to", "account"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("phone", "calls", "phone"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("suspect", "operates", "phone"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("phone", "operated_by", "suspect"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("suspect", "owns", "account"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("account", "owned_by", "suspect"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("suspect", "uses", "ip"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("ip", "used_by", "suspect"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("suspect", "accused_in", "fir"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("fir", "has_accused", "suspect"): SAGEConv(hidden_dim, hidden_dim, aggr="mean"),
                ("suspect", "co_accused_with", "suspect"): SAGEConv(hidden_dim, hidden_dim, aggr="mean")
            }
            self.convs.append(HeteroConv(conv_dict, aggr="sum"))
            self.norms.append(nn.ModuleDict({
                ntype: nn.LayerNorm(hidden_dim) for ntype in node_in_dims.keys()
            }))

        # 3. Task Head 1: Financial AML Edge Classifier (Using Hadamard & Absolute Diff)
        aml_in_dim = 4 * hidden_dim + trans_attr_dim
        self.aml_classifier = nn.Sequential(
            nn.Linear(aml_in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.LayerNorm(hidden_dim // 2),
            nn.GELU(),
            nn.Linear(hidden_dim // 2, 1)
        )

        # 4. Task Head 2: Suspect Link Predictor (Symmetric Bilinear + Hadamard + Diff)
        link_in_dim = 4 * hidden_dim
        self.link_predictor = nn.Sequential(
            nn.Linear(link_in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.GELU(),
            nn.Linear(hidden_dim // 2, 1)
        )

        # 5. Task Head 3: Kingpin / Influencer Importance Head
        self.kingpin_scorer = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
            nn.Sigmoid()
        )

    def encode_nodes(self, x_dict: dict, edge_index_dict: dict) -> dict:
        """Forward pass through node projection and HeteroConv message passing with residual connections."""
        # Initial projection
        h_dict = {
            ntype: self.node_projections[ntype](x)
            for ntype, x in x_dict.items() if ntype in self.node_projections
        }

        # Message passing layers
        for conv, norm_dict in zip(self.convs, self.norms):
            h_dict_next = conv(h_dict, edge_index_dict)
            for ntype in h_dict_next.keys():
                # Residual connection
                if ntype in h_dict:
                    h_res = h_dict[ntype] + h_dict_next[ntype]
                else:
                    h_res = h_dict_next[ntype]
                h_dict[ntype] = norm_dict[ntype](F.relu(h_res))
                h_dict[ntype] = F.dropout(h_dict[ntype], p=self.dropout, training=self.training)

        return h_dict

    def classify_transactions(
        self,
        z_account: torch.Tensor,
        edge_pairs: torch.Tensor,
        edge_attr: torch.Tensor
    ) -> torch.Tensor:
        """Classifies financial transactions as money laundering or legitimate."""
        src, dst = edge_pairs[0], edge_pairs[1]
        z_src = z_account[src]
        z_dst = z_account[dst]
        
        # Symmetrical interaction terms + edge attributes
        hadamard = z_src * z_dst
        diff = torch.abs(z_src - z_dst)
        feat = torch.cat([z_src, z_dst, hadamard, diff, edge_attr], dim=-1)
        return self.aml_classifier(feat).squeeze(-1)

    def predict_suspect_links(
        self,
        z_suspect: torch.Tensor,
        suspect_pairs: torch.Tensor
    ) -> torch.Tensor:
        """Predicts probability of a hidden/unobserved co-conspirator connection."""
        u, v = suspect_pairs[0], suspect_pairs[1]
        z_u = z_suspect[u]
        z_v = z_suspect[v]
        
        hadamard = z_u * z_v
        diff = torch.abs(z_u - z_v)
        pair_feat = torch.cat([z_u, z_v, hadamard, diff], dim=-1)
        return self.link_predictor(pair_feat).squeeze(-1)

    def score_kingpins(self, z_suspect: torch.Tensor) -> torch.Tensor:
        """Calculates influential kingpin / syndicate leadership score for all suspects."""
        return self.kingpin_scorer(z_suspect).squeeze(-1)
