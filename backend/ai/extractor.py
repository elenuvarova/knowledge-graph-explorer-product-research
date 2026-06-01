"""
Extract a small knowledge graph (entities + relationships) from an uploaded
document using Groq (Llama 3.3). Falls back to a structural CSV extraction when
no GROQ_API_KEY is set or the model call fails.
"""
from __future__ import annotations
import os
import json

_MODEL = "llama-3.3-70b-versatile"
_VALID_TYPES = {
    "concept", "organisation", "person", "paper",
    "regulation", "product", "dataset", "institution",
}

_SYSTEM = (
    "You extract structured knowledge graphs from documents for product researchers. "
    "Respond with valid JSON only — no markdown fences, no prose."
)


def extract_graph(text: str, topic: str, csv_rows: list[dict] | None = None):
    """
    Return (entities, relationships) where:
      entities      = [{"name", "type", "description"}]
      relationships = [(source_name, target_name, relation_type)]
    """
    api_key = os.getenv("GROQ_API_KEY")
    if api_key and text.strip():
        try:
            return _ai_extract(text, topic, api_key)
        except Exception as exc:
            print(f"[extract] groq error: {exc}")

    # Fallback: derive entities from the first CSV column.
    if csv_rows:
        return _csv_fallback(csv_rows), []
    return [], []


def _ai_extract(text: str, topic: str, api_key: str):
    from groq import Groq
    client = Groq(api_key=api_key, timeout=20.0)

    prompt = (
        f'Topic context: "{topic}".\n\n'
        "Extract the key entities and relationships from the document below. "
        "Return JSON with exactly these keys:\n"
        '{\n'
        '  "entities": [{"name": "...", "type": "concept|organisation|person|product|regulation|dataset|institution|paper", "description": "one short sentence"}],\n'
        '  "relationships": [{"source": "entity name", "target": "entity name", "relation": "related_to"}]\n'
        "}\n"
        "Rules: 8-25 entities max; names under 80 chars; only use entities you listed as relationship endpoints.\n\n"
        f"DOCUMENT:\n{text}"
    )

    response = client.chat.completions.create(
        model=_MODEL,
        max_tokens=1500,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": prompt},
        ],
    )
    data = json.loads(response.choices[0].message.content.strip())
    if not isinstance(data, dict):
        raise ValueError("model did not return a JSON object")

    entities = []
    seen = set()
    for item in data.get("entities", []) if isinstance(data.get("entities"), list) else []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        etype = str(item.get("type", "concept")).strip().lower()
        if etype not in _VALID_TYPES:
            etype = "concept"
        desc = item.get("description")
        entities.append({
            "name": name[:200],
            "type": etype,
            "description": str(desc).strip()[:500] if isinstance(desc, str) else "",
        })

    relationships = []
    for item in data.get("relationships", []) if isinstance(data.get("relationships"), list) else []:
        if not isinstance(item, dict):
            continue
        src = str(item.get("source", "")).strip()
        tgt = str(item.get("target", "")).strip()
        if src and tgt and src.lower() != tgt.lower():
            rel = str(item.get("relation", "related_to")).strip()[:80] or "related_to"
            relationships.append((src, tgt, rel))

    return entities, relationships


def _csv_fallback(rows: list[dict]) -> list[dict]:
    """Use the first column of a CSV as concept entities."""
    entities = []
    seen = set()
    for row in rows:
        if not row:
            continue
        first_value = next((v for v in row.values() if v and str(v).strip()), None)
        if not first_value:
            continue
        name = str(first_value).strip()[:200]
        if name.lower() in seen:
            continue
        seen.add(name.lower())
        entities.append({"name": name, "type": "concept", "description": ""})
        if len(entities) >= 50:
            break
    return entities
