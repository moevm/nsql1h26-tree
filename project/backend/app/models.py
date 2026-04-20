from __future__ import annotations
from pydantic import BaseModel, field_validator 

VALID_RELATION_TYPES = {"father", "mother", "son", "daughter", "spouse"}
VALID_GENDERS = {"M", "F"}


class RelationIn(BaseModel):
    relation_type: str 
    related_person_id: str
    start_date: str | None = None 
    end_date: str | None = None 

    @field_validator("relation_type")
    @classmethod
    def validate_relation_type(cls, v: str) -> str:
        if v not in VALID_RELATION_TYPES:
            raise ValueError(f"relation_type must be one of {VALID_RELATION_TYPES}")
        return v 


class RelatedPersonBrief(BaseModel):
    id: str
    first_name: str
    last_name: str
    birth_year: int | None = None
    death_year: int | None = None 


class RelationOut(BaseModel):
    relation_type: str
    start_date: str | None = None 
    end_date: str | None = None 
    related_person: RelatedPersonBrief


class PersonBrief(BaseModel):
    # Краткая информация о персоне для таблиц
    id: str
    first_name: str
    last_name: str 
    title: str | None = None 
    birth_year: int | None = None 
    death_year: int | None = None 
    gender: str | None = None 


class PersonFull(PersonBrief):
    # Полная информация о персоне для карточки
    country: str | None = None 
    dynasty: str | None = None 
    comment: str | None = None 
    created_at: str | None = None 
    updated_at: str | None = None 
    relations: list[RelationOut] = []


class PersonCreate(BaseModel):
    # Тело запроса для UC-08
    first_name: str 
    last_name: str 
    birth_year: int | None = None 
    death_year: int | None = None 
    title: str | None = None 
    country: str | None = None 
    dynasty: str | None = None 
    gender: str | None = None 
    comment: str | None = None 
    relations: list[RelationIn] = []

    @field_validator("first_name", "last_name", "title", "country", "dynasty")
    @classmethod
    def not_empty(cls, v: str) -> str: 
        if not v or not v.strip():
            raise ValueError("this field must not be empty")
        return v.strip()
    
    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_GENDERS:
            raise ValueError("gender must be 'M' or 'F'")
        return v
        

class DynastyStats(BaseModel):
    total_persons: int 
    total_relations: int 
    avg_age: float | None = None 
    dynasty_start: int | None = None 
    dynasty_end: int | None = None 
    dynasty_period: str | None = None 


class PersonSearchParams(BaseModel):
    first_name: str | None = None 
    last_name: str | None = None 
    title: str | None = None 
    gender: str | None = None
    birth_year_from: int | None = None 
    birth_year_to: int | None = None 
    death_year_from: int | None = None 
    death_year_to: int | None = None 