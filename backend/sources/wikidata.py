"""Wikidata entity search and SPARQL relationship expansion."""
import time
import requests

_SEARCH = "https://www.wikidata.org/w/api.php"
_SPARQL = "https://query.wikidata.org/sparql"
_HEADERS = {
    "User-Agent": "KnowledgeGraphExplorer/1.0 (product-research-tool; https://github.com)",
    "Accept": "application/sparql-results+json",
}

# Wikidata types we want to surface as graph nodes
_USEFUL_TYPES = {
    "Q35120",   # entity
    "Q1047113", # academic discipline
    "Q2088357", # field of study
    "Q11862829", # academic major
    "Q4830453", # business
    "Q43229",   # organization
    "Q15265344", # broadcaster
    "Q178706",  # institution
    "Q7315155", # research institute
    "Q31855",   # research center
    "Q170584",  # project
    "Q1190554", # occurrence
    "Q484652",  # international organization
    "Q7210356", # political organization
}

_RELATED_QUERY = """
SELECT DISTINCT ?target ?targetLabel ?relType WHERE {{
  {{
    wd:{qid} wdt:P279 ?target . BIND("subclass_of" AS ?relType)
  }} UNION {{
    ?target wdt:P279 wd:{qid} . BIND("narrower" AS ?relType)
  }} UNION {{
    wd:{qid} wdt:P361 ?target . BIND("part_of" AS ?relType)
  }} UNION {{
    wd:{qid} wdt:P527 ?target . BIND("has_part" AS ?relType)
  }} UNION {{
    wd:{qid} wdt:P31 ?target . BIND("instance_of" AS ?relType)
  }} UNION {{
    wd:{qid} wdt:P452 ?target . BIND("industry" AS ?relType)
  }}
  FILTER(STRSTARTS(STR(?target), "http://www.wikidata.org/entity/Q"))
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT 30
"""

_DESCRIPTION_QUERY = """
SELECT ?description WHERE {{
  wd:{qid} schema:description ?description .
  FILTER(LANG(?description) = "en")
}}
LIMIT 1
"""


def search_entities(term: str, limit: int = 3) -> list[dict]:
    """Return top Wikidata items matching a search term."""
    try:
        resp = requests.get(
            _SEARCH,
            params={
                "action": "wbsearchentities",
                "search": term,
                "language": "en",
                "type": "item",
                "limit": str(limit),
                "format": "json",
            },
            headers={"User-Agent": _HEADERS["User-Agent"]},
            timeout=8,
        )
        resp.raise_for_status()
        return resp.json().get("search", [])
    except Exception:
        return []


def get_related(qid: str) -> list[dict]:
    """Run SPARQL to get entities related to a QID."""
    time.sleep(0.5)  # polite pause — Wikidata rate limit is ~1 req/sec
    try:
        resp = requests.get(
            _SPARQL,
            params={"query": _RELATED_QUERY.format(qid=qid), "format": "json"},
            headers=_HEADERS,
            timeout=12,
        )
        resp.raise_for_status()
        bindings = resp.json().get("results", {}).get("bindings", [])
        results = []
        for b in bindings:
            uri = b.get("target", {}).get("value", "")
            label = b.get("targetLabel", {}).get("value", "")
            rel = b.get("relType", {}).get("value", "related_to")
            if not label or label.startswith("Q"):  # skip unlabelled items
                continue
            qid_target = uri.rsplit("/", 1)[-1]
            results.append({"qid": qid_target, "label": label, "relation": rel})
        return results
    except Exception:
        return []


def fetch_entities_for_terms(terms: list[str]) -> list[dict]:
    """
    For each search term: find matching Wikidata items, then expand each
    one hop outward. Returns a flat list of raw entity dicts ready for
    normalisation.
    """
    seen_qids: set[str] = set()
    raw: list[dict] = []

    for term in terms:
        hits = search_entities(term, limit=2)
        for hit in hits:
            qid = hit.get("id", "")
            if not qid or qid in seen_qids:
                continue
            seen_qids.add(qid)

            raw.append({
                "qid": qid,
                "label": hit.get("label", ""),
                "description": hit.get("description", ""),
                "source_url": f"https://www.wikidata.org/wiki/{qid}",
                "relation_to_root": "search_result",
                "root_term": term,
            })

            for related in get_related(qid):
                if related["qid"] in seen_qids:
                    continue
                seen_qids.add(related["qid"])
                raw.append({
                    "qid": related["qid"],
                    "label": related["label"],
                    "description": "",
                    "source_url": f"https://www.wikidata.org/wiki/{related['qid']}",
                    "relation_to_root": related["relation"],
                    "root_qid": qid,
                    "root_label": hit.get("label", ""),
                })

    return raw
