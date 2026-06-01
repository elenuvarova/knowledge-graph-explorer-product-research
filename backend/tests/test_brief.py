"""Unit tests for the brief generator's template path and its None-safety."""
from types import SimpleNamespace

from ai.brief_generator import generate_brief


def _entity(name, degree=None, bridge=None, desc=None):
    return SimpleNamespace(name=name, type="concept", description=desc,
                           degree=degree, bridge_score=bridge)


def _cluster(name, score=None):
    return SimpleNamespace(name=name, size=3, research_count=2,
                           product_count=0, opportunity_score=score)


def _opp(title, score=None):
    return SimpleNamespace(title=title, score=score, risk_level="medium",
                           why_it_matters="It matters.")


def test_template_brief_renders_topic():
    project = SimpleNamespace(topic="CSRD reporting", region="EU", goal="policy")
    md = generate_brief(project,
                        [_entity("Double materiality", 0.6, 0.3)],
                        [_cluster("Disclosure", 0.5)],
                        [_opp("Audit assistant", 0.7)])
    assert "CSRD reporting" in md
    assert "Audit assistant" in md


def test_template_brief_survives_null_metrics():
    """Entities/clusters/opps with NULL numeric metrics must not crash the
    f-string float formatting (regression for `:.3f` on None)."""
    project = SimpleNamespace(topic="Null safety", region=None, goal=None)
    md = generate_brief(project,
                        [_entity("Orphan node", degree=None, bridge=None)],
                        [_cluster("Sparse", score=None)],
                        [_opp("Untested", score=None)])
    assert isinstance(md, str)
    assert "Null safety" in md


def test_template_brief_handles_empty_inputs():
    project = SimpleNamespace(topic="Empty", region="Global", goal="market")
    md = generate_brief(project, [], [], [])
    assert "Empty" in md
    assert "## Executive Summary" in md
