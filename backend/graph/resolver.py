"""Entity deduplication using fuzzy string matching."""
from dataclasses import dataclass, field
from typing import Optional
from rapidfuzz import fuzz

MERGE_THRESHOLD = 88  # similarity score to treat two names as the same entity


@dataclass
class RawEntity:
    name: str
    type: str
    description: str = ""
    source: str = ""
    source_url: str = ""
    wikidata_id: Optional[str] = None
    openalex_id: Optional[str] = None
    confidence: float = 1.0
    # relationship to its parent node in the raw graph (used to build edges)
    parent_name: Optional[str] = None
    relation_type: str = "related_to"


def resolve(raw: list[RawEntity]) -> tuple[list[RawEntity], list[tuple[str, str, str]]]:
    """
    Deduplicate entities and return:
      - resolved entity list (unique)
      - edge list as (source_name, target_name, relation_type)

    Merge strategy: keep the entity with the more specific type (organisation
    beats concept) and the longer description; accumulate all source_urls.
    """
    canonical: list[RawEntity] = []  # one entry per unique entity

    # name → canonical index
    name_index: dict[str, int] = {}

    def find_canonical(name: str) -> Optional[int]:
        name_lower = name.lower().strip()
        for idx, c in enumerate(canonical):
            score = fuzz.ratio(name_lower, c.name.lower().strip())
            if score >= MERGE_THRESHOLD:
                return idx
        return None

    for entity in raw:
        if not entity.name or len(entity.name) < 2:
            continue
        idx = find_canonical(entity.name)
        if idx is None:
            canonical.append(entity)
            name_index[entity.name.lower().strip()] = len(canonical) - 1
        else:
            # Merge: keep better type, longer description, add IDs
            existing = canonical[idx]
            if _type_priority(entity.type) > _type_priority(existing.type):
                existing.type = entity.type
            if len(entity.description) > len(existing.description):
                existing.description = entity.description
            if entity.wikidata_id and not existing.wikidata_id:
                existing.wikidata_id = entity.wikidata_id
            if entity.openalex_id and not existing.openalex_id:
                existing.openalex_id = entity.openalex_id

    # Build edge list using canonical names
    edges: list[tuple[str, str, str]] = []
    for entity in raw:
        if not entity.parent_name:
            continue
        src_idx = find_canonical(entity.parent_name)
        tgt_idx = find_canonical(entity.name)
        if src_idx is not None and tgt_idx is not None and src_idx != tgt_idx:
            src_name = canonical[src_idx].name
            tgt_name = canonical[tgt_idx].name
            edges.append((src_name, tgt_name, entity.relation_type))

    # Deduplicate edges (same pair regardless of direction)
    seen_edges: set[frozenset] = set()
    unique_edges: list[tuple[str, str, str]] = []
    for src, tgt, rel in edges:
        key = frozenset([src, tgt])
        if key not in seen_edges:
            seen_edges.add(key)
            unique_edges.append((src, tgt, rel))

    return canonical, unique_edges


_TYPE_PRIORITY = {
    "regulation": 6,
    "institution": 5,
    "organisation": 4,
    "person": 3,
    "paper": 3,
    "dataset": 2,
    "product": 2,
    "concept": 1,
}


def _type_priority(t: str) -> int:
    return _TYPE_PRIORITY.get(t, 0)
