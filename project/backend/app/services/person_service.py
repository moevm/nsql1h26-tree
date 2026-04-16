from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from neo4j import Session 
from app.models import (
    DynastyStats,
    PersonBrief,
    PersonCreate,
    PersonFull,
    PersonSearchParams,
    RelatedPersonBrief,
    RelationOut,
)
from app.seed import _get_reverse_type

def _now_iso() -> str: 
    return datetime.now(timezone.utc).isoformat()

def _node_to_brief(node) -> PersonBrief:
    p = dict(node)
    return PersonBrief(
        id=p["id"],
        first_name=p["first_name"],
        last_name=p["last_name"],
        title=p.get("title"),
        birth_year=p.get("birth_year"),
        death_year=p.get("death_year"),
        gender=p.get("gender"),
    )

def _node_to_full(node, relations: list[RelationOut]) -> PersonFull:
    p = dict(node)
    return PersonFull(
        id=p["id"],
        first_name=p["first_name"],
        last_name=p["last_name"],
        title=p.get("title"),
        birth_year=p.get("birth_year"),
        death_year=p.get("death_year"),
        gender=p.get("gender"),
        country=p.get("country"),
        dynasty=p.get("dynasty"),
        comment=p.get("comment"),
        created_at=p.get("created_at"),
        updated_at=p.get("updated_at"),
        relations=relations,
    )

def _build_relations(records) -> list[RelationOut]:
    result = []
    for rec in records:
        rel_type = rec.get("rel_type")
        rp = rec.get("related")
        if rel_type and rp:
            rp_dict = dict(rp)
            result.append(
                RelationOut(
                    relation_type=rel_type,
                    start_date=rec.get("start_date"),
                    end_date=rec.get("end_date"),
                    related_person=RelatedPersonBrief(
                        id=rp_dict["id"],
                        first_name=rp_dict["first_name"],
                        last_name=rp_dict["last_name"],
                        birth_year=rp_dict.get("birth_year"),
                        death_year=rp_dict.get("death_year"),
                    ),
                )
            )
    return result

# UC-01: статистика & недавно добавленные персоны
def get_dynasty_stats(session: Session) -> DynastyStats:
    result = session.run(
        """
        MATCH (p:Person)
        WITH count(p) AS total, avg(
            CASE
                WHEN p.birth_year IS NOT NULL AND p.death_year IS NOT NULL 
                THEN p.death_year - p.birth_year
            END    
        ) AS avg_age, min(p.birth_year) AS dynasty_start, max(p.death_year) AS dynasty_end
        OPTIONAL MATCH ()-[r:RELATED_TO]->()
        RETURN total, avg_age, dynasty_start, dynasty_end, count(r) AS total_relations
        """
    )
    row = result.single()
    if not row:
        return DynastyStats(total_persons=0, total_relations=0)
    
    total: int = row["total"]
    total_rels: int = row["total_relations"]
    avg_age: Optional[float] = row["avg_age"]
    dynasty_start: Optional[int] = row["dynasty_start"]
    dynasty_end: Optional[int] = row["dynasty_end"]

    period = f"{dynasty_start}-{dynasty_end}" if (dynasty_start and dynasty_end) else None 

    return DynastyStats(
        total_persons=total,
        total_relations=total_rels,
        avg_age=round(avg_age, 1) if avg_age else None,
        dynasty_start=dynasty_start,
        dynasty_end=dynasty_end,
        dynasty_period=period,
    )

def get_recent_persons(session: Session, limit: int = 5) -> list[PersonBrief]:
    result = session.run(
        """
        MATCH (p:Person)
        RETURN p
        ORDER BY p.created_at DESC
        LIMIT $limit
        """,
        limit=limit,
    )
    return [_node_to_brief(rec["p"]) for rec in result]

# UC-02: поиск & фильтрация
def search_persons(session: Session, params: PersonSearchParams) -> list[PersonBrief]:
    conditions: list[str] = []
    query_params: dict = {}

    if params.first_name: 
        conditions.append("toLower(p.first_name) CONTAINS toLower($first_name)")
        query_params["first_name"] = params.first_name

    if params.last_name:
        conditions.append("toLower(p.last_name) CONTAINS toLower($last_name)")
        query_params["last_name"] = params.last_name

    if params.title:
        conditions.append("p.title IS NOT NULL AND toLower(p.title) CONTAINS toLower($title)")
        query_params["title"] = params.title

    if params.gender:
        conditions.append("p.gender = $gender")
        query_params["gender"] = params.gender

    if params.birth_year_from is not None:
        conditions.append("p.birth_year IS NOT NULL AND p.birth_year >= $birth_year_from")
        query_params["birth_year_from"] = params.birth_year_from

    if params.birth_year_to is not None: 
        conditions.append("p.birth_year IS NOT NULL AND p.birth_year <= $birth_year_to")
        query_params["birth_year_to"] = params.birth_year_to

    if params.death_year_from is not None: 
        conditions.append("p.death_year IS NOT NULL AND p.death_year >= $death_year_from")
        query_params["death_year_from"] = params.death_year_from
    
    if params.death_year_to is not None: 
        conditions.append("p.death_year IS NOT NULL AND p.death_year <= $death_year_to")
        query_params["death_year_to"] = params.death_year_to

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    cypher = f"""
        MATCH (p:Person)
        {where_clause}
        RETURN p
        ORDER BY p.last_name, p.first_name
    """
    result = session.run(cypher, **query_params)
    return [_node_to_brief(rec["p"]) for rec in result]

# UC-03: карточка персоны
def get_person_by_id(session: Session, person_id: str) -> Optional[PersonFull]:
    # Находит узел персоны 
    person_result = session.run(
        "MATCH (p:Person {id: $id}) RETURN p",
        id=person_id,
    )
    person_row = person_result.single()
    if not person_row:
        return None 
    
    # Находит все связи для персоны: исходящие и входящие
    relations_result = session.run(
        """
        MATCH (p:Person {id: $id})-[r:RELATED_TO]->(related:Person)
        RETURN r.type AS rel_type, r.start_date AS start_date, r.end_date AS end_date, related
        UNION ALL 
        MATCH (related:Person)-[r:RELATED_TO]->(p:Person {id: $id})
        WHERE r.reverse_type IS NOT NULL 
        RETURN r.reverse_type AS rel_type, r.start_date AS start_date, r.end_date AS end_date, related
        """,
        id=person_id,
    )
    relations = _build_relations(relations_result)
    return _node_to_full(person_row["p"], relations)

# UC-08: добавление персоны
def create_person(session: Session, data: PersonCreate, target_genders: dict) -> PersonFull:
    new_id = str(uuid4())
    now = _now_iso()

    # Создает новый узел 
    session.run(
        """
        CREATE (p:Person {
            id: $id,
            first_name: $first_name,
            last_name: $last_name,
            birth_year: $birth_year,
            death_year: $death_year,
            title: $title,
            country: $country,
            dynasty: $dynasty,
            gender: $gender,
            comment: $comment,
            created_at: $created_at,
            updated_at: $updated_at
        })
        """,
        id=new_id,
        first_name=data.first_name,
        last_name=data.last_name,
        birth_year=data.birth_year,
        death_year=data.death_year,
        title=data.title,
        country=data.country,
        dynasty=data.dynasty,
        gender=data.gender,
        comment=data.comment,
        created_at=now,
        updated_at=now,
    )

    for rel in data.relations:
        target_gender = target_genders.get(rel.related_person_id)
        rev_type = _get_reverse_type(rel.relation_type, target_gender)
        s_date = rel.start_date if rel.relation_type == "spouse" else None 
        e_date = rel.end_date if rel.relation_type == "spouse" else None 

        session.run(
            """
            MATCH (a:Person {id: $from_id}), (b:Person {id: $to_id})
            CREATE (a)-[:RELATED_TO {
                type: $rel_type, reverse_type: $rev_type, 
                start_date: $start_date, end_date: $end_date
            }]->(b)
            """,
            from_id=new_id,
            to_id=rel.related_person_id,
            rel_type=rel.relation_type,
            rev_type=rev_type,
            start_date=s_date,
            end_date=e_date
        )

    person = get_person_by_id(session, new_id)
    return person