"""API-surface tests: project CRUD, graph reads, brief, and the delete-cascade
regression (a project delete must not leave orphan cluster/opportunity rows)."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["db"] == "sqlite"


def test_create_and_get_project(client):
    r = client.post("/api/projects", json={"topic": "e-waste", "region": "EU"})
    assert r.status_code == 201
    body = r.json()
    assert body["topic"] == "e-waste"
    assert body["status"] == "pending"
    pid = body["id"]

    got = client.get(f"/api/projects/{pid}")
    assert got.status_code == 200
    assert got.json()["id"] == pid


def test_get_project_404(client):
    assert client.get("/api/projects/does-not-exist").status_code == 404


def test_list_projects(client, ready_project):
    r = client.get("/api/projects")
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert ready_project in ids


def test_brief_rejects_unready_project(client):
    pid = client.post("/api/projects", json={"topic": "x"}).json()["id"]
    r = client.get(f"/api/projects/{pid}/brief")
    assert r.status_code == 400


def test_brief_template_for_ready_project(client, ready_project):
    r = client.get(f"/api/projects/{ready_project}/brief")
    assert r.status_code == 200
    body = r.json()
    assert "AI tutoring" in body["markdown"]
    assert body["filename"].startswith("brief-")
    # No GROQ key in tests -> template path includes these section headers
    assert "## Executive Summary" in body["markdown"]
    assert "Data Sources" in body["markdown"]


def test_graph_endpoint(client, ready_project):
    r = client.get(f"/api/projects/{ready_project}/graph")
    assert r.status_code == 200
    body = r.json()
    assert body["stats"]["node_count"] == 2
    assert body["stats"]["edge_count"] == 1


def test_clusters_and_opportunities(client, ready_project):
    clusters = client.get(f"/api/projects/{ready_project}/clusters").json()["clusters"]
    assert len(clusters) == 1
    assert clusters[0]["top_entities"] == ["Adaptive learning"]

    opps = client.get(f"/api/projects/{ready_project}/opportunities").json()["opportunities"]
    assert len(opps) == 1
    assert opps[0]["risks"] == ["adoption"]
    assert opps[0]["cluster_name"] == "Adaptive learning"


def test_delete_cascades_all_children(client, db, ready_project):
    """Regression: DELETE must remove clusters and opportunities too, not just
    entities/relationships — otherwise orphan rows accumulate (and Postgres
    raises a FK violation on the parent delete)."""
    from models import Entity, Relationship, Cluster, Opportunity

    r = client.delete(f"/api/projects/{ready_project}")
    assert r.status_code == 204

    assert client.get(f"/api/projects/{ready_project}").status_code == 404
    for model in (Entity, Relationship, Cluster, Opportunity):
        leftover = db.query(model).filter_by(project_id=ready_project).count()
        assert leftover == 0, f"{model.__name__} rows orphaned after delete"
