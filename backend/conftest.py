"""
Shared pytest fixtures.

Critical: these env vars are set BEFORE database.py is imported. python-dotenv's
load_dotenv() uses override=False, so setting them here prevents the real .env
(production Neon DATABASE_URL, live GROQ_API_KEY) from ever being used in tests.
Tests run against a throwaway SQLite file and the template/offline AI paths.
"""
import os
import sys
import tempfile

_tmp_db = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
_tmp_db.close()
os.environ["DATABASE_URL"] = ""          # force sqlite, ignore .env
os.environ["SQLITE_PATH"] = _tmp_db.name  # throwaway file, not ./data.sqlite
os.environ["GROQ_API_KEY"] = ""          # force template / offline AI paths

sys.path.insert(0, os.path.dirname(__file__))

import pytest                      # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import database                    # noqa: E402
import models                      # noqa: E402  (registers tables on Base)
import main                        # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_schema():
    """Drop + recreate every table before each test for isolation."""
    database.Base.metadata.drop_all(bind=database.engine)
    database.Base.metadata.create_all(bind=database.engine)
    yield


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def db():
    s = database.SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def ready_project(db):
    """Seed a fully-built project (entities, relationship, cluster, opportunity)
    without running the external-API build pipeline. Returns the project id."""
    from models import ResearchProject, Entity, Relationship, Cluster, Opportunity

    project = ResearchProject(
        topic="AI tutoring", region="EU", goal="opportunity", status="ready",
    )
    db.add(project)
    db.flush()

    e1 = Entity(project_id=project.id, name="Intelligent tutoring system",
                type="concept", source="wikidata", degree=0.8,
                bridge_score=0.4, cluster_id="0")
    e2 = Entity(project_id=project.id, name="Adaptive learning",
                type="concept", source="openalex", degree=0.5,
                bridge_score=0.2, cluster_id="0")
    db.add_all([e1, e2])
    db.flush()

    db.add(Relationship(project_id=project.id, source_id=e1.id,
                        target_id=e2.id, relation_type="related_to"))

    cluster = Cluster(project_id=project.id, cluster_id="0",
                      name="Adaptive learning", top_entities='["Adaptive learning"]',
                      size=2, research_count=1, opportunity_score=0.7)
    db.add(cluster)
    db.flush()

    db.add(Opportunity(project_id=project.id, cluster_db_id=cluster.id,
                      title="AI tutor for K-12", why_it_matters="Demand is rising.",
                      risks='["adoption"]', next_questions='["who pays?"]',
                      risk_level="medium", score=0.7, generated_by_ai=False))
    db.commit()
    return project.id
