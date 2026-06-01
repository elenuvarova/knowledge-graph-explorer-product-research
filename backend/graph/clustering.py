"""
Label Louvain clusters and compute per-cluster signals used for opportunity scoring.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class ClusterSummary:
    cluster_id: str
    entity_ids: list[str] = field(default_factory=list)
    top_entity_names: list[str] = field(default_factory=list)
    name: str = ""
    size: int = 0
    research_count: int = 0   # papers + institutions
    product_count: int = 0
    concept_count: int = 0
    avg_degree: float = 0.0
    max_bridge: float = 0.0
    opportunity_score: float = 0.0


def label_clusters(entities: list) -> list[ClusterSummary]:
    """
    Group entities by cluster_id, compute signals, derive a readable name.
    `entities` are SQLAlchemy Entity rows with: id, name, type, degree,
    betweenness, bridge_score, cluster_id.
    """
    groups: dict[str, list] = defaultdict(list)
    for e in entities:
        cid = e.cluster_id or "0"
        groups[cid].append(e)

    summaries: list[ClusterSummary] = []

    for cid, members in groups.items():
        if len(members) < 2:
            # Singleton clusters carry no signal — skip
            continue

        research = sum(1 for e in members if e.type in ("paper", "institution"))
        products = sum(1 for e in members if e.type == "product")
        concepts = sum(1 for e in members if e.type == "concept")

        degrees = [e.degree or 0.0 for e in members]
        avg_deg = sum(degrees) / len(degrees) if degrees else 0.0
        max_bridge = max((e.bridge_score or 0.0) for e in members)

        # Name the cluster: top-3 entities by degree, prefer concepts over papers
        sorted_members = sorted(
            members,
            key=lambda e: (e.type == "concept", e.degree or 0.0),
            reverse=True,
        )
        top_names = [e.name for e in sorted_members[:3]]
        name = _generate_name(top_names, research, products)

        s = ClusterSummary(
            cluster_id=cid,
            entity_ids=[e.id for e in members],
            top_entity_names=top_names,
            name=name,
            size=len(members),
            research_count=research,
            product_count=products,
            concept_count=concepts,
            avg_degree=round(avg_deg, 4),
            max_bridge=round(max_bridge, 4),
        )
        summaries.append(s)

    # Sort by size descending so the most populated clusters come first
    summaries.sort(key=lambda s: s.size, reverse=True)
    return summaries


def _generate_name(top_names: list[str], research_count: int, product_count: int) -> str:
    """
    Build a cluster name from the top entity names.
    Strips redundant words and capitalises properly.
    """
    if not top_names:
        return "Unnamed cluster"
    # Use first 2 names, truncated, joined with ' · '
    parts = [n[:40] for n in top_names[:2]]
    base = " · ".join(parts)
    return base.strip()
