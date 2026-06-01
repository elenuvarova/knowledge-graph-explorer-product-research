"""OpenAlex API — concepts, works (papers), and institutions."""
import os
from sources.http import get_json

_BASE = "https://api.openalex.org"
# Polite pool: a real contact email gets a faster, more reliable rate limit.
# Set OPENALEX_MAILTO in the environment for production.
_MAILTO = os.getenv("OPENALEX_MAILTO", "kge-research@example.com")
_HEADERS = {
    "User-Agent": f"KnowledgeGraphExplorer/1.0 (mailto:{_MAILTO})",
}


def _get(path: str, params: dict) -> dict:
    params = {**params, "mailto": _MAILTO}
    data = get_json(f"{_BASE}{path}", params=params, headers=_HEADERS, timeout=10)
    return data or {}


def search_concepts(query: str, per_page: int = 15) -> list[dict]:
    """Return OpenAlex concepts matching a query string."""
    data = _get("/concepts", {
        "search": query,
        "per-page": per_page,
        "select": "id,display_name,description,level,related_concepts,works_count",
    })
    return data.get("results", [])


def get_top_works(query: str, per_page: int = 15) -> list[dict]:
    """Return the most-cited papers for a query."""
    data = _get("/works", {
        "search": query,
        "sort": "cited_by_count:desc",
        "per-page": per_page,
        "select": "id,title,doi,publication_year,cited_by_count,concepts,authorships",
    })
    return data.get("results", [])


def get_top_institutions(query: str, per_page: int = 10) -> list[dict]:
    """Return institutions active in a research area."""
    data = _get("/institutions", {
        "search": query,
        "sort": "works_count:desc",
        "per-page": per_page,
        "select": "id,display_name,country_code,type,works_count,homepage_url",
    })
    return data.get("results", [])


def fetch_entities_for_topic(topic: str) -> dict:
    """
    Fetch concepts, top papers, and key institutions for a topic.
    Returns raw OpenAlex data grouped by type.
    """
    concepts = search_concepts(topic)
    works = get_top_works(topic)
    institutions = get_top_institutions(topic)

    # Also pull related concepts from the top concept hit
    related_concepts: list[dict] = []
    if concepts:
        for rc in concepts[0].get("related_concepts", [])[:10]:
            related_concepts.append(rc)

    return {
        "concepts": concepts,
        "related_concepts": related_concepts,
        "works": works,
        "institutions": institutions,
    }
