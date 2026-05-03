from fastapi import APIRouter, HTTPException, Query, Depends
from neo4j import Session
from app.models import (
    PersonBrief,
    PersonCreate,
    PersonFull,
    PersonSearchParams,
)
from app.services import person_service
from app.db import get_session

router = APIRouter(prefix="/api/persons", tags=["persons"])

# UC-02: поиск & фильтрация
@router.get("/search", response_model=list[PersonBrief], summary="Поиск персон (UC-02)")
def search_persons(
    first_name: str | None = Query(None, description="Подстрока имени (регистронезависимо)"),
    last_name: str | None = Query(None, description="Подстрока фамилии (регистронезависимо)"),
    title: str | None = Query(None, description="Подстрока титула (регистронезависимо)"),
    gender: str | None = Query(None, description="Пол: M или F"),
    birth_year_from: int | None = Query(None, description="Год рождения от"),
    birth_year_to: int | None = Query(None, description="Год рождения до"),
    death_year_from: int | None = Query(None, description="Год смерти от"),
    death_year_to: int | None = Query(None, description="Год смерти до"),
    session: Session = Depends(get_session),
):
    params = PersonSearchParams(
        first_name=first_name,
        last_name=last_name,
        title=title,
        gender=gender,
        birth_year_from=birth_year_from,
        birth_year_to=birth_year_to,
        death_year_from=death_year_from,
        death_year_to=death_year_to,
    )
    return person_service.search_persons(session, params)

# UC-03: карточка персоны 
@router.get("/{person_id}", response_model=PersonFull, summary="Карточка персоны (UC-03)")
def get_person(person_id: str, session: Session = Depends(get_session)):
    person = person_service.get_person_by_id(session, person_id)
    if not person: 
        raise HTTPException(status_code=404, detail=f"Person {person_id} not found")
    return person 

# UC-08: добавление персоны
@router.post("", response_model=PersonFull, status_code=201, summary="Добавить персону (UC-08)")
def create_person(body: PersonCreate, session: Session = Depends(get_session)):
    target_genders = {}
    # Проверяется, что существуют все related_person_id
    for rel in body.relations:
        existing = person_service.get_person_by_id(session, rel.related_person_id)
        if not existing:
            raise HTTPException(
                status_code=400,
                detail=f"Person with relation not found: id={rel.related_person_id}",
            )
        target_genders[rel.related_person_id] = existing.gender

    return person_service.create_person(session, body, target_genders)

# UC-09: редактирование персоны
@router.put("/{person_id}", response_model=PersonFull, summary="Редактировать персону (UC-09)")
def update_person(person_id: str, body: PersonCreate, session: Session = Depends(get_session)):
    existing = person_service.get_person_by_id(session, person_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Person {person_id} not found")

    target_genders = {}
    for rel in body.relations:
        related = person_service.get_person_by_id(session, rel.related_person_id)
        if not related:
            raise HTTPException(
                status_code=400,
                detail=f"Person with relation not found: id={rel.related_person_id}",
            )
        target_genders[rel.related_person_id] = related.gender

    return person_service.update_person(session, person_id, body, target_genders)