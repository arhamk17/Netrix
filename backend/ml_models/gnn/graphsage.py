import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv


class GraphSAGEEncoder(nn.Module):
    """
    GraphSAGE Node Embedding Encoder.
    Aggregates structural neighborhood and topological traffic flow properties
    to produce rich, contextual node embeddings.
    """
    def __init__(
        self,
        in_channels: int,
        hidden_dim: int = 64,
        out_dim: int = 64,
        num_layers: int = 2,
        dropout: float = 0.2
    ):
        super().__init__()
        self.num_layers = num_layers
        self.dropout = dropout

        self.convs = nn.ModuleList()
        self.norms = nn.ModuleList()

        # First layer
        self.convs.append(SAGEConv(in_channels, hidden_dim, aggr="mean"))
        self.norms.append(nn.LayerNorm(hidden_dim))

        # Intermediate and output layers
        for _ in range(num_layers - 2):
            self.convs.append(SAGEConv(hidden_dim, hidden_dim, aggr="mean"))
            self.norms.append(nn.LayerNorm(hidden_dim))

        if num_layers > 1:
            self.convs.append(SAGEConv(hidden_dim, out_dim, aggr="mean"))
            self.norms.append(nn.LayerNorm(out_dim))

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """
        Compute node embeddings.
        Args:
            x: Node feature matrix [num_nodes, in_channels]
            edge_index: Graph adjacency structure [2, num_edges]
        Returns:
            z: Node embeddings [num_nodes, out_dim]
        """
        for i, (conv, norm) in enumerate(zip(self.convs, self.norms)):
            x = conv(x, edge_index)
            x = norm(x)
            x = F.relu(x)
            if i < self.num_layers - 1:
                x = F.dropout(x, p=self.dropout, training=self.training)
        return x


class EdgeClassifierMLP(nn.Module):
    """
    Edge Classifier Multi-Layer Perceptron.
    Takes concatenated source node embedding, destination node embedding,
    and direct flow edge attributes to predict whether a network flow is malicious.
    """
    def __init__(
        self,
        node_embed_dim: int,
        edge_attr_dim: int,
        hidden_dim: int = 64,
        dropout: float = 0.2
    ):
        super().__init__()
        input_dim = 2 * node_embed_dim + edge_attr_dim

        self.mlp = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.LayerNorm(hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1)
        )

    def forward(
        self,
        z_src: torch.Tensor,
        z_dst: torch.Tensor,
        edge_attr: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            z_src: Source node embeddings [batch_size, node_embed_dim]
            z_dst: Destination node embeddings [batch_size, node_embed_dim]
            edge_attr: Flow edge attributes [batch_size, edge_attr_dim]
        Returns:
            logits: Unnormalized logit scores [batch_size]
        """
        flow_repr = torch.cat([z_src, z_dst, edge_attr], dim=-1)
        logits = self.mlp(flow_repr).squeeze(-1)
        return logits


class GraphSAGEEdgeClassifier(nn.Module):
    """
    Complete GraphSAGE-based Edge Classification Architecture for Network Intrusion Detection.
    Combines graph-level neighborhood representation learning with flow-level prediction.
    """
    def __init__(
        self,
        node_in_channels: int,
        edge_in_channels: int,
        node_hidden_dim: int = 64,
        node_out_dim: int = 64,
        mlp_hidden_dim: int = 64,
        num_gnn_layers: int = 2,
        dropout: float = 0.2
    ):
        super().__init__()
        self.encoder = GraphSAGEEncoder(
            in_channels=node_in_channels,
            hidden_dim=node_hidden_dim,
            out_dim=node_out_dim,
            num_layers=num_gnn_layers,
            dropout=dropout
        )
        self.classifier = EdgeClassifierMLP(
            node_embed_dim=node_out_dim,
            edge_attr_dim=edge_in_channels,
            hidden_dim=mlp_hidden_dim,
            dropout=dropout
        )

    def encode_nodes(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """Compute node representations using message passing."""
        return self.encoder(x, edge_index)

    def classify_edges(
        self,
        z: torch.Tensor,
        edge_pairs: torch.Tensor,
        edge_attr: torch.Tensor
    ) -> torch.Tensor:
        """
        Classify a set of edge flows given precomputed node embeddings.
        """
        src_idx, dst_idx = edge_pairs[0], edge_pairs[1]
        z_src = z[src_idx]
        z_dst = z[dst_idx]
        return self.classifier(z_src, z_dst, edge_attr)

    def forward(
        self,
        x: torch.Tensor,
        msg_edge_index: torch.Tensor,
        eval_edge_pairs: torch.Tensor,
        eval_edge_attr: torch.Tensor
    ) -> torch.Tensor:
        """
        End-to-end forward pass.
        """
        z = self.encode_nodes(x, msg_edge_index)
        return self.classify_edges(z, eval_edge_pairs, eval_edge_attr)
