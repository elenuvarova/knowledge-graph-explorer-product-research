"""Tests for topic expansion — the offline fallback and JSON-shape hardening."""
from graph.builder import _simple_expand, _expand_topic


def test_simple_expand_keeps_full_topic_first():
    terms = _simple_expand("AI tutoring tools")
    assert terms[0] == "AI tutoring tools"


def test_simple_expand_drops_short_tokens():
    # "AI" (len 2) is noisy for Wikidata search and must be filtered out
    terms = _simple_expand("AI tutoring tools")
    assert "AI" not in terms
    assert "tutoring" in terms
    assert "tools" in terms


def test_simple_expand_single_word():
    assert _simple_expand("blockchain") == ["blockchain"]


def test_expand_topic_falls_back_without_key():
    # GROQ_API_KEY is "" in the test env, so this must use _simple_expand
    terms = _expand_topic("quantum computing hardware")
    assert terms[0] == "quantum computing hardware"
    assert all(isinstance(t, str) for t in terms)
