"""Phase 6 — RAG Q&A over the graph."""


def test_ask_requires_ready_project(client):
    pid = client.post("/api/projects", json={"topic": "x"}).json()["id"]
    r = client.post(f"/api/projects/{pid}/ask", json={"question": "what is x?"})
    assert r.status_code == 400


def test_ask_rejects_empty_question(client, ready_project):
    r = client.post(f"/api/projects/{ready_project}/ask", json={"question": "   "})
    assert r.status_code == 400


def test_ask_returns_answer_and_highlighted_nodes(client, ready_project):
    r = client.post(
        f"/api/projects/{ready_project}/ask",
        json={"question": "adaptive learning systems"},
    )
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["answer"], str) and body["answer"]
    assert isinstance(body["highlighted_nodes"], list) and len(body["highlighted_nodes"]) >= 1
    assert all(isinstance(s["id"], str) and s["name"] for s in body["sources"])


def test_retrieve_ranks_by_relevance(db, ready_project):
    from models import Entity
    from ai.qa import retrieve
    entities = db.query(Entity).filter_by(project_id=ready_project).all()
    top = retrieve(entities, "adaptive learning")
    assert top  # non-empty
    assert top[0].name == "Adaptive learning"
