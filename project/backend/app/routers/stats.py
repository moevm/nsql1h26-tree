from fastapi import APIRouter, Depends, Query
from neo4j import Session 
from app.db import get_session
from app.models import DynastyStats, PersonBrief
from app.services import person_service

router = APIRouter(prefix="/api", tags=["stats"])

# UC-01: cтатистика
@router.get("/stats", response_model=DynastyStats, summary="Статистика династии (UC-01)")
def get_stats(session: Session = Depends(get_session)):
    return person_service.get_dynasty_stats(session)

@router.get(
    "/persons/recent",
    response_model=list[PersonBrief],
    summary="Последние добавленные персоны (UC-01)",
)
def get_recent(
    limit: int = Query(default=5, ge=1, le=20),
    session: Session = Depends(get_session),
): return person_service.get_recent_persons(session, limit)


@router.get("/graph", summary="Данные для графа дерева (UC-04)")
def get_graph(session: Session = Depends(get_session)):
    return person_service.get_graph_data(session)