"""Hardening: HTTP retry/backoff, brief caching, goal labels."""
from types import SimpleNamespace


class _FakeResp:
    def __init__(self, status, payload=None, headers=None):
        self.status_code = status
        self._payload = payload if payload is not None else {}
        self.headers = headers or {}

    def json(self):
        return self._payload


def test_get_json_retries_then_succeeds(monkeypatch):
    from sources import http
    calls = {"n": 0}

    def fake_get(url, params=None, headers=None, timeout=None):
        calls["n"] += 1
        return _FakeResp(429) if calls["n"] == 1 else _FakeResp(200, {"ok": True})

    monkeypatch.setattr(http.requests, "get", fake_get)
    monkeypatch.setattr(http.time, "sleep", lambda *_: None)

    assert http.get_json("http://x", retries=2) == {"ok": True}
    assert calls["n"] == 2


def test_get_json_gives_up_after_retries(monkeypatch):
    from sources import http
    monkeypatch.setattr(http.requests, "get", lambda *a, **k: _FakeResp(503))
    monkeypatch.setattr(http.time, "sleep", lambda *_: None)
    assert http.get_json("http://x", retries=1) is None


def test_brief_uses_goal_label():
    from ai.brief_generator import generate_brief
    project = SimpleNamespace(topic="T", region="EU", goal="opportunity")
    md = generate_brief(project, [], [], [])
    assert "Product opportunity" in md
    assert "Goal: opportunity" not in md


def test_brief_is_cached(client, ready_project, monkeypatch):
    import routers.projects as rp
    import ai.brief_generator as bg

    calls = {"n": 0}
    original = bg.generate_brief

    def counting(*a, **k):
        calls["n"] += 1
        return original(*a, **k)

    monkeypatch.setattr(bg, "generate_brief", counting)
    rp._brief_cache.clear()

    r1 = client.get(f"/api/projects/{ready_project}/brief")
    r2 = client.get(f"/api/projects/{ready_project}/brief")
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json() == r2.json()
    assert calls["n"] == 1  # second request served from cache
