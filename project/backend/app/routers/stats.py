from fastapi import APIRouter, Depends, Query
from neo4j import Session 
from app.db import get_session
from app.models import DynastyStats, PersonBrief
from app.services import person_service

router = APIRouter(prefix="/api", tags=["stats"])

from app.models import DynastyStats, PersonBrief, CustomStatsParams, CustomStatsResult

@router.get(
    "/stats/custom",
    response_model=CustomStatsResult,
    summary="Кастомная статистика (UC-05)",
)
def get_custom_stats(
    country: str | None = Query(None),
    gender: str | None = Query(None),
    birth_year_from: int | None = Query(None),
    birth_year_to: int | None = Query(None),
    death_year_from: int | None = Query(None),
    death_year_to: int | None = Query(None),
    axis_x: str = Query(..., description="birth_year | title | country"),
    axis_y: str = Query(..., description="count | avg_age | marriages"),
    session: Session = Depends(get_session),
):
    params = CustomStatsParams(
        country=country,
        gender=gender,
        birth_year_from=birth_year_from,
        birth_year_to=birth_year_to,
        death_year_from=death_year_from,
        death_year_to=death_year_to,
        axis_x=axis_x,
        axis_y=axis_y,
    )
    return person_service.get_custom_stats(session, params)

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