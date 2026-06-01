import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import ResearchProject, Entity, Relationship, Cluster, Opportunity

router = APIRouter(prefix="/projects", tags=["graph"])


@router.get("/{project_id}/graph")
def get_graph(project_id: str, db: Session = Depends(get_db)):
    project = db.query(ResearchProject).filter_by(id=project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    entities = db.query(Entity).filter_by(project_id=project_id).all()
    relationships = db.query(Relationship).filter_by(project_id=project_id).all()

    entity_ids = {e.id for e in entities}

    nodes = [_node_out(e) for e in entities]
    edges = [
        _edge_out(r) for r in relationships
        if r.source_id in entity_ids and r.target_id in entity_ids
    ]

    return {
        "project": {
            "id": project.id,
            "topic": project.topic,
            "status": project.status,
        },
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "node_count": len(nodes),
            "edge_count": len(edges),
        },
    }


@router.get("/{project_id}/entities/{entity_id}")
def get_entity(project_id: str, entity_id: str, db: Session = Depends(get_db)):
    entity = db.query(Entity).filter_by(id=entity_id, project_id=project_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    neighbors = db.query(Relationship).filter(
        (Relationship.project_id == project_id) &
        ((Relationship.source_id == entity_id) | (Relationship.target_id == entity_id))
    ).all()

    neighbor_ids = set()
    for r in neighbors:
        neighbor_ids.add(r.source_id if r.target_id == entity_id else r.target_id)

    neighbor_entities = db.query(Entity).filter(Entity.id.in_(neighbor_ids)).all()

    return {
        **_node_out(entity),
        "neighbors": [_node_out(e) for e in neighbor_entities],
        "relationships": [_edge_out(r) for r in neighbors],
    }


@router.get("/{project_id}/clusters")
def get_clusters(project_id: str, db: Session = Depends(get_db)):
    _require_project(project_id, db)
    clusters = (
        db.query(Cluster)
        .filter_by(project_id=project_id)
        .order_by(Cluster.opportunity_score.desc())
        .all()
    )
    return {"clusters": [_cluster_out(c) for c in clusters]}


@router.get("/{project_id}/opportunities")
def get_opportunities(project_id: str, db: Session = Depends(get_db)):
    _require_project(project_id, db)
    opps = (
        db.query(Opportunity)
        .filter_by(project_id=project_id)
        .order_by(Opportunity.score.desc())
        .all()
    )

    result = []
    for o in opps:
        cluster = db.query(Cluster).filter_by(id=o.cluster_db_id).first() if o.cluster_db_id else None
        result.append(_opportunity_out(o, cluster))
    return {"opportunities": result}


def _require_project(project_id: str, db: Session) -> ResearchProject:
    p = db.query(ResearchProject).filter_by(id=project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


def _cluster_out(c: Cluster) -> dict:
    return {
        "id": c.id,
        "cluster_id": c.cluster_id,
        "name": c.name,
        "top_entities": _parse_json(c.top_entities, []),
        "size": c.size,
        "research_count": c.research_count,
        "product_count": c.product_count,
        "opportunity_score": c.opportunity_score,
        "avg_degree": c.avg_degree,
        "max_bridge": c.max_bridge,
    }


def _opportunity_out(o: Opportunity, cluster: Cluster | None) -> dict:
    return {
        "id": o.id,
        "cluster_db_id": o.cluster_db_id,
        "cluster_name": cluster.name if cluster else None,
        "cluster_size": cluster.size if cluster else None,
        "title": o.title,
        "why_it_matters": o.why_it_matters,
        "risks": _parse_json(o.risks, []),
        "next_questions": _parse_json(o.next_questions, []),
        "evidence_strength": o.evidence_strength,
        "risk_level": o.risk_level,
        "score": o.score,
        "generated_by_ai": o.generated_by_ai,
    }


def _parse_json(value: str | None, default):
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def _node_out(e: Entity) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "type": e.type,
        "description": e.description,
        "source": e.source,
        "source_url": e.source_url,
        "wikidata_id": e.wikidata_id,
        "openalex_id": e.openalex_id,
        "degree": e.degree,
        "betweenness": e.betweenness,
        "bridge_score": e.bridge_score,
        "cluster_id": e.cluster_id,
    }


def _edge_out(r: Relationship) -> dict:
    return {
        "id": r.id,
        "source": r.source_id,
        "target": r.target_id,
        "relation_type": r.relation_type,
        "weight": r.weight,
        "evidence_source": r.evidence_source,
    }
