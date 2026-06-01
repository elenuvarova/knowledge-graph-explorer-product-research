from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db, SessionLocal
from models import ResearchProject, Entity, Relationship, Cluster, Opportunity
from graph.builder import build_project_graph

_MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_EXT = (".pdf", ".csv", ".txt", ".md")

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    topic: str
    region: Optional[str] = None
    goal: Optional[str] = None


class AskRequest(BaseModel):
    question: str


@router.post("", status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    project = ResearchProject(topic=body.topic, region=body.region, goal=body.goal)
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.get("")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(ResearchProject).order_by(ResearchProject.created_at.desc()).all()
    return [_project_out(p) for p in projects]


@router.get("/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(project_id, db)
    return _project_out(project)


@router.post("/{project_id}/build")
def trigger_build(project_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    project = _get_or_404(project_id, db)
    if project.status == "building":
        return {"status": "already_building"}
    project.status = "building"
    db.commit()
    background_tasks.add_task(_run_build, project_id)
    return {"status": "building", "project_id": project_id}


# project_id → (version_key, payload). Cleared implicitly when the project's
# updated_at changes (i.e. after any rebuild/upload), so the LLM brief is only
# regenerated when the underlying graph actually changed.
_brief_cache: dict = {}


@router.get("/{project_id}/brief")
def get_brief(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(project_id, db)
    if project.status != "ready":
        raise HTTPException(status_code=400, detail="Project is not ready yet")

    version = project.updated_at.isoformat() if project.updated_at else ""
    cached = _brief_cache.get(project_id)
    if cached and cached[0] == version:
        return cached[1]

    entities = db.query(Entity).filter_by(project_id=project_id).all()
    clusters = db.query(Cluster).filter_by(project_id=project_id).all()
    opportunities = db.query(Opportunity).filter_by(project_id=project_id).all()
    from ai.brief_generator import generate_brief
    markdown = generate_brief(project, entities, clusters, opportunities)
    slug = project.topic.lower().replace(" ", "-")[:30]
    payload = {"markdown": markdown, "filename": f"brief-{slug}.md"}
    _brief_cache[project_id] = (version, payload)
    return payload


@router.post("/{project_id}/ask")
def ask_question(project_id: str, body: AskRequest, db: Session = Depends(get_db)):
    project = _get_or_404(project_id, db)
    if project.status != "ready":
        raise HTTPException(status_code=400, detail="Project is not ready yet")
    question = (body.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty")
    entities = db.query(Entity).filter_by(project_id=project_id).all()
    from ai.qa import answer_question
    return answer_question(project, entities, question)


@router.post("/{project_id}/upload")
async def upload_document(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = _get_or_404(project_id, db)
    if project.status == "building":
        raise HTTPException(status_code=409, detail="Project is already processing")

    filename = file.filename or "upload"
    if not filename.lower().endswith(_ALLOWED_EXT):
        raise HTTPException(status_code=415, detail="Unsupported file type. Use PDF, CSV, TXT or MD.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")

    project.status = "building"
    db.commit()
    background_tasks.add_task(_run_ingest, project_id, filename, content)
    return {"status": "building", "filename": filename}


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(project_id, db)
    # Delete all children before the parent. SQLite does not enforce
    # ondelete="CASCADE" without a per-connection PRAGMA, and on Postgres a
    # bare parent delete raises a FK violation while children still reference it.
    db.query(Opportunity).filter_by(project_id=project_id).delete()
    db.query(Cluster).filter_by(project_id=project_id).delete()
    db.query(Relationship).filter_by(project_id=project_id).delete()
    db.query(Entity).filter_by(project_id=project_id).delete()
    db.delete(project)
    db.commit()


def _run_build(project_id: str):
    db = SessionLocal()
    try:
        build_project_graph(project_id, db)
    except Exception as exc:
        project = db.get(ResearchProject, project_id)
        if project:
            project.status = "error"
            project.error_message = str(exc)
            db.commit()
    finally:
        db.close()


def _run_ingest(project_id: str, filename: str, content: bytes):
    """Parse an uploaded document, extract a sub-graph, merge it into the
    project's graph, and recompute clusters/opportunities."""
    db = SessionLocal()
    try:
        from sources.uploads import parse_document, csv_rows
        from ai.extractor import extract_graph
        from graph.builder import enrich_from_extraction

        project = db.get(ResearchProject, project_id)
        if not project:
            return

        text = parse_document(filename, content)
        rows = csv_rows(filename, content)
        entities, relationships = extract_graph(text, project.topic, csv_rows=rows)
        enrich_from_extraction(project_id, db, entities, relationships)

        project = db.get(ResearchProject, project_id)
        if project:
            project.status = "ready"
            db.commit()
    except Exception as exc:
        project = db.get(ResearchProject, project_id)
        if project:
            project.status = "error"
            project.error_message = f"Upload failed: {exc}"
            db.commit()
    finally:
        db.close()


def _get_or_404(project_id: str, db: Session) -> ResearchProject:
    project = db.query(ResearchProject).filter_by(id=project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _project_out(p: ResearchProject) -> dict:
    return {
        "id": p.id,
        "topic": p.topic,
        "region": p.region,
        "goal": p.goal,
        "status": p.status,
        "error_message": p.error_message,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
