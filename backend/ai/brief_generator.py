"""
Generate a structured markdown research brief from a project's graph data.
Uses Groq (Llama 3.3) if GROQ_API_KEY is set, falls back to a template.
"""
from __future__ import annotations
import os

_MODEL = "llama-3.3-70b-versatile"

_SYSTEM = (
    "You are a senior product strategist and researcher. "
    "You write clear, structured research briefs for product managers exploring new domains. "
    "Your briefs are concise, insight-driven, and actionable. "
    "Respond with markdown only — no preamble, no code fences."
)


def generate_brief(project, entities, clusters, opportunities) -> str:
    top_entities = sorted(entities, key=lambda e: e.degree or 0, reverse=True)[:15]
    top_clusters = sorted(clusters, key=lambda c: c.opportunity_score or 0, reverse=True)
    top_opps = sorted(opportunities, key=lambda o: o.score or 0, reverse=True)[:5]

    entities_text = "\n".join(
        f"- **{e.name}** ({e.type})"
        + (f": {e.description[:120]}" if e.description else "")
        + f" — degree {(e.degree or 0):.3f}, bridge {(e.bridge_score or 0):.3f}"
        for e in top_entities
    )

    clusters_text = "\n".join(
        f"- **{c.name}**: {c.size} nodes, {c.research_count} research items, score {(c.opportunity_score or 0):.3f}"
        for c in top_clusters
    )

    opps_text = "\n\n".join(
        f"**{o.title}** (score {(o.score or 0):.3f}, {o.risk_level} risk)\n{o.why_it_matters}"
        for o in top_opps
    )

    context = (
        f'Topic: "{project.topic}" | Region: {project.region or "Global"} | Goal: {project.goal or "market understanding"}\n'
        f"Graph: {len(entities)} entities across {len(clusters)} clusters\n\n"
        f"TOP ENTITIES:\n{entities_text}\n\n"
        f"CLUSTERS:\n{clusters_text}\n\n"
        f"TOP OPPORTUNITIES:\n{opps_text}"
    )

    prompt = (
        f"Write a research brief based on this knowledge graph analysis:\n\n{context}\n\n"
        f"Use this structure:\n"
        f"# Research Brief: {project.topic}\n\n"
        f"## Executive Summary\n"
        f"(3-4 sentences: what this domain is, why it matters now, key insight from the graph)\n\n"
        f"## Key Entities & Concepts\n"
        f"(Table: Name | Type | Why it matters — top 8 entities)\n\n"
        f"## Knowledge Clusters\n"
        f"(Each cluster: what it represents, opportunity signal, 2-3 sentences)\n\n"
        f"## Product Opportunities\n"
        f"(Top 3-5: what it is, why now, first experiment to run)\n\n"
        f"## Strategic Recommendations\n"
        f"(3 concrete next steps for a PM exploring this domain)\n\n"
        f"## Data Sources\n"
        f"Wikidata + OpenAlex — {len(entities)} entities, {len(clusters)} clusters."
    )

    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        try:
            from groq import Groq
            client = Groq(api_key=api_key, timeout=20.0)
            response = client.chat.completions.create(
                model=_MODEL,
                max_tokens=2048,
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": prompt},
                ],
            )
            return response.choices[0].message.content.strip()
        except Exception as exc:
            print(f"[brief] groq error: {exc}")

    return _template_brief(project, top_entities, top_clusters, top_opps)


def _template_brief(project, top_entities, clusters, top_opps) -> str:
    from datetime import date
    today = date.today().strftime("%B %d, %Y")

    entity_rows = "\n".join(
        f"| {e.name} | {e.type} | degree {(e.degree or 0):.3f} |"
        for e in top_entities[:8]
    )

    clusters_section = "\n".join(
        f"\n### {c.name}\n{c.size} nodes · {c.research_count} research items · opportunity score {(c.opportunity_score or 0):.3f}"
        for c in clusters
    )

    opps_section = "\n".join(
        f"\n### {o.title}\n{o.why_it_matters}\n\n**Risk**: {o.risk_level} · **Score**: {(o.score or 0):.3f}"
        for o in top_opps
    )

    return f"""# Research Brief: {project.topic}

*{today} · Region: {project.region or 'Global'} · Goal: {project.goal or 'market understanding'}*

---

## Executive Summary

This brief maps the knowledge landscape of **{project.topic}**, identifying {len(top_entities)} key entities across {len(clusters)} knowledge clusters sourced from Wikidata and OpenAlex.

---

## Key Entities & Concepts

| Name | Type | Centrality |
|---|---|---|
{entity_rows}

---

## Knowledge Clusters
{clusters_section}

---

## Product Opportunities
{opps_section}

---

## Data Sources

- **Wikidata** — ontological relationships and entity definitions
- **OpenAlex** — research papers, institutions, and academic concepts
- Graph built with NetworkX · community detection via Louvain algorithm
"""
