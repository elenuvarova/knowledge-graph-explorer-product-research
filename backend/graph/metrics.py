"""Compute per-node graph metrics using NetworkX."""
import networkx as nx
from dataclasses import dataclass


@dataclass
class NodeMetrics:
    degree: float = 0.0
    betweenness: float = 0.0
    bridge_score: float = 0.0  # betweenness / max(degree, ε) — high = potential wedge
    cluster_id: str = "0"


def compute(G: nx.Graph) -> dict[str, NodeMetrics]:
    if len(G.nodes) == 0:
        return {}

    degree = nx.degree_centrality(G)

    # betweenness is expensive for large graphs; skip for >400 nodes
    if len(G.nodes) <= 400:
        betweenness = nx.betweenness_centrality(G, normalized=True)
    else:
        betweenness = {n: 0.0 for n in G.nodes}

    cluster_map = _detect_clusters(G)

    metrics = {}
    for node in G.nodes:
        d = degree.get(node, 0.0)
        b = betweenness.get(node, 0.0)
        bridge = b / max(d, 1e-6)
        metrics[node] = NodeMetrics(
            degree=round(d, 4),
            betweenness=round(b, 4),
            bridge_score=round(min(bridge, 10.0), 4),  # cap at 10 for readability
            cluster_id=str(cluster_map.get(node, 0)),
        )
    return metrics


def _detect_clusters(G: nx.Graph) -> dict[str, int]:
    try:
        import community as community_louvain
        return community_louvain.best_partition(G)
    except ImportError:
        # Fallback to connected components if python-louvain not installed
        partition = {}
        for i, component in enumerate(nx.connected_components(G)):
            for node in component:
                partition[node] = i
        return partition
