from fastapi import APIRouter, HTTPException, Query, Depends
from neo4j import Session
from app.models import (
    PersonBrief,
    PersonCreate,
    PersonFull,
    PersonSearchParams,
    PersonPage
)
from app.services import person_service
from app.db import get_session

router = APIRouter(prefix="/api/persons", tags=["persons"])

# UC-02: поиск & фильтрация
@router.get("/search", response_model=PersonPage, summary="Поиск персон (UC-02)")
def search_persons(
    first_name: str | None = Query(None),
    last_name: str | None = Query(None),
    title: str | None = Query(None),
    gender: str | None = Query(None),
    birth_year_from: int | None = Query(None),
    birth_year_to: int | None = Query(None),
    death_year_from: int | None = Query(None),
    death_year_to: int | None = Query(None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    params = PersonSearchParams(
        first_name=first_name, last_name=last_name, title=title, gender=gender,
        birth_year_from=birth_year_from, birth_year_to=birth_year_to,
        death_year_from=death_year_from, death_year_to=death_year_to,
    )
    return person_service.search_persons(session, params, page, page_size)

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


@router.delete("/{person_id}", status_code=200, summary="Удалить персону (UC-10)")
def delete_person(person_id: str, session: Session = Depends(get_session)):
    deleted = person_service.delete_person(session, person_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Person {person_id} not found")
    return {"status": "deleted", "id": person_id}

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