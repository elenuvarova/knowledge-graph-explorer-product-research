"""Phase 5 — document upload + graph enrichment."""
from database import SessionLocal
from models import Entity


def test_csv_rows_parsing():
    from sources.uploads import csv_rows, parse_document
    content = b"name,note\nFederated learning,a\nDifferential privacy,b\n"
    rows = csv_rows("topics.csv", content)
    assert len(rows) == 2
    assert rows[0]["name"] == "Federated learning"
    text = parse_document("topics.csv", content)
    assert "Federated learning" in text


def test_extract_graph_csv_fallback_without_key():
    from ai.extractor import extract_graph
    rows = [{"name": "Edge inference"}, {"name": "Model distillation"}, {"name": "Edge inference"}]
    entities, relationships = extract_graph("", "AI tutoring", csv_rows=rows)
    names = [e["name"] for e in entities]
    assert "Edge inference" in names and "Model distillation" in names
    assert len(entities) == 2          # de-duplicated
    assert relationships == []


def test_upload_rejects_unsupported_type(client, ready_project):
    r = client.post(
        f"/api/projects/{ready_project}/upload",
        files={"file": ("notes.exe", b"data", "application/octet-stream")},
    )
    assert r.status_code == 415


def test_upload_csv_enriches_and_rebuilds(client, ready_project):
    s = SessionLocal()
    before = s.query(Entity).filter_by(project_id=ready_project).count()
    s.close()

    csv_content = b"concept\nFederated learning\nDifferential privacy\nOn-device inference\n"
    r = client.post(
        f"/api/projects/{ready_project}/upload",
        files={"file": ("topics.csv", csv_content, "text/csv")},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "building"

    # TestClient runs the background ingest before returning — project is ready.
    proj = client.get(f"/api/projects/{ready_project}").json()
    assert proj["status"] == "ready"

    s = SessionLocal()
    after = s.query(Entity).filter_by(project_id=ready_project).count()
    uploaded = s.query(Entity).filter_by(project_id=ready_project, source="upload").count()
    s.close()
    assert after > before
    assert uploaded >= 1
