"""
Use Claude to enrich opportunity candidates with narrative cards.
Falls back to template descriptions if ANTHROPIC_API_KEY is not set.
"""
from __future__ import annotations
import os
import json
import time
from graph.opportunities import OpportunityCandidate

# Only the top N clusters get AI-generated cards (keeps API cost low)
_AI_CARD_LIMIT = 5

_SYSTEM = (
    "You are a senior product strategist helping product managers discover opportunities "
    "in new domains. You write crisp, evidence-based opportunity cards. "
    "Always respond with valid JSON only — no markdown fences, no extra text."
)

_USER_TMPL = """Topic the researcher is exploring: "{topic}"

Knowledge cluster from the domain graph:
- Cluster name: {name}
- Key concepts/entities: {top_entities}
- Size: {size} connected nodes
- Research signals: {research_count} papers and institutions
- Existing products in cluster: {product_count}
- Bridge entities (connecting this cluster to others): {bridge_list}

Write a product opportunity card as JSON with exactly these keys:
{{
  "title": "concise opportunity title, 5 words max",
  "why_it_matters": "2 sentences. First: what the opportunity is and why now. Second: one piece of evidence from the cluster data above.",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "next_questions": ["discovery question 1", "discovery question 2", "discovery question 3"]
}}"""


def enrich_with_ai(
    candidates: list[OpportunityCandidate],
    topic: str,
    entities_by_cluster: dict[str, list],
) -> list[OpportunityCandidate]:
    """
    For the top _AI_CARD_LIMIT candidates, call Claude to replace the
    template title/why/risks/questions with AI-generated content.
    Returns the same list (mutated in-place).
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("[ai] ANTHROPIC_API_KEY not set — using template descriptions")
        return candidates

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
    except ImportError:
        print("[ai] anthropic package not installed")
        return candidates

    for candidate in candidates[:_AI_CARD_LIMIT]:
        cluster = candidate.cluster
        bridge_entities = [
            e.name for e in entities_by_cluster.get(cluster.cluster_id, [])
            if (e.bridge_score or 0) > 0.3
        ][:5]

        prompt = _USER_TMPL.format(
            topic=topic,
            name=cluster.name,
            top_entities=", ".join(cluster.top_entity_names),
            size=cluster.size,
            research_count=cluster.research_count,
            product_count=cluster.product_count,
            bridge_list=", ".join(bridge_entities) if bridge_entities else "none identified",
        )

        try:
            msg = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=512,
                system=_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text.strip()
            data = json.loads(raw)

            candidate.title = data.get("title", candidate.title)
            candidate.why_it_matters = data.get("why_it_matters", candidate.why_it_matters)
            candidate.risks = data.get("risks", candidate.risks)
            candidate.next_questions = data.get("next_questions", candidate.next_questions)
            candidate.generated_by_ai = True
            print(f"[ai] generated card for cluster '{cluster.name}'")

        except Exception as exc:
            print(f"[ai] claude error for cluster '{cluster.name}': {exc}")

        time.sleep(0.3)  # stay well within rate limits

    return candidates
