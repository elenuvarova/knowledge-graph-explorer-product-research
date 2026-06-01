"""
Score clusters and produce Opportunity candidates.

Scoring formula:
  30% cluster density signal (size + avg_degree)
  25% research activity (papers + institutions)
  25% gap signal (absence of products — whitespace)
  20% bridge potential (max bridge_score in cluster)

Risk heuristic:
  high   — competitive (product_count > 3) or cluster is tiny
  low    — strong research signal, clear gap, large cluster
  medium — everything else
"""
from __future__ import annotations
from dataclasses import dataclass, field
from graph.clustering import ClusterSummary


@dataclass
class OpportunityCandidate:
    cluster: ClusterSummary
    score: float
    evidence_strength: float
    risk_level: str               # low | medium | high
    # Filled in by AI writer later; defaults are template-based
    title: str = ""
    why_it_matters: str = ""
    risks: list[str] = field(default_factory=list)
    next_questions: list[str] = field(default_factory=list)
    generated_by_ai: bool = False


def score_opportunities(
    clusters: list[ClusterSummary],
    topic: str,
) -> list[OpportunityCandidate]:
    """
    Rank clusters by opportunity score. Returns list sorted best-first.
    Only clusters with size >= 3 are considered.
    """
    eligible = [c for c in clusters if c.size >= 3]
    if not eligible:
        return []

    # Normalise signals across eligible clusters
    max_size = max(c.size for c in eligible) or 1
    max_research = max(c.research_count for c in eligible) or 1
    max_bridge = max(c.max_bridge for c in eligible) or 1
    max_products = max(c.product_count for c in eligible) or 1

    candidates: list[OpportunityCandidate] = []

    for cluster in eligible:
        size_norm = cluster.size / max_size
        research_norm = cluster.research_count / max_research
        gap_norm = 1.0 - (cluster.product_count / max_products)
        bridge_norm = cluster.max_bridge / max_bridge

        score = (
            0.30 * size_norm +
            0.25 * research_norm +
            0.25 * gap_norm +
            0.20 * bridge_norm
        )
        score = round(score, 4)

        evidence = round((research_norm + size_norm) / 2, 4)

        risk = _risk_level(cluster)

        title = _template_title(cluster, topic)
        why = _template_why(cluster, topic)
        risks = _template_risks(cluster, topic)
        questions = _template_questions(cluster, topic)

        cluster.opportunity_score = score

        candidates.append(OpportunityCandidate(
            cluster=cluster,
            score=score,
            evidence_strength=evidence,
            risk_level=risk,
            title=title,
            why_it_matters=why,
            risks=risks,
            next_questions=questions,
        ))

    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates


# ── Template fallbacks (used when ANTHROPIC_API_KEY is absent) ─────────────

def _risk_level(c: ClusterSummary) -> str:
    if c.product_count > 3:
        return "high"
    if c.research_count >= 3 and c.product_count == 0:
        return "low"
    return "medium"


def _template_title(c: ClusterSummary, topic: str) -> str:
    lead = c.top_entity_names[0] if c.top_entity_names else topic
    return f"{lead[:50]} opportunity"


def _template_why(c: ClusterSummary, topic: str) -> str:
    return (
        f"This cluster contains {c.size} connected entities around {c.name}, "
        f"with {c.research_count} research signals and "
        f"{'no known products' if c.product_count == 0 else f'{c.product_count} existing products'}. "
        f"The combination of {'strong' if c.research_count > 2 else 'emerging'} research activity "
        f"and {'clear market gap' if c.product_count == 0 else 'fragmented market'} "
        f"suggests a product opportunity in the {topic} space."
    )


def _template_risks(c: ClusterSummary, topic: str) -> list[str]:
    risks = [
        f"Market education required — users may not yet recognise {c.top_entity_names[0] if c.top_entity_names else 'this'} as a distinct need",
        "Adjacent incumbents could expand into this space quickly",
        "Evidence base is {quality} — more primary research needed before committing".format(
            quality="emerging" if c.research_count < 3 else "moderate"
        ),
    ]
    return risks


def _template_questions(c: ClusterSummary, topic: str) -> list[str]:
    lead = c.top_entity_names[0] if c.top_entity_names else topic
    return [
        f"Who is the primary decision-maker for {lead} adoption?",
        f"What does the workflow look like before and after a solution exists?",
        f"Which of the {c.size} entities in this cluster are the highest-leverage entry points?",
    ]
