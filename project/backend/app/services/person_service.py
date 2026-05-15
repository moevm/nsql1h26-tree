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
    ExportData, 
    ExportPerson, 
    ExportRelation,
    ImportData,
    CustomStatsParams,
    CustomStatsResult,
    ChartDataPoint
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


def delete_person(session: Session, person_id: str) -> bool:
    result = session.run(
        "MATCH (p:Person {id: $id}) DETACH DELETE p RETURN count(p) AS deleted",
        id=person_id,
    )
    row = result.single()
    return row and row["deleted"] > 0


def get_graph_data(session: Session) -> dict:
    persons_result = session.run(
        """
        MATCH (p:Person)
        RETURN p
        ORDER BY p.birth_year
        """
    )
    persons = []
    for rec in persons_result:
        p = dict(rec["p"])
        persons.append({
            "id": p["id"],
            "first_name": p["first_name"],
            "last_name": p["last_name"],
            "birth_year": p.get("birth_year"),
            "death_year": p.get("death_year"),
            "title": p.get("title"),
            "gender": p.get("gender"),
        })

    relations_result = session.run(
        """
        MATCH (a:Person)-[r:RELATED_TO]->(b:Person)
        RETURN a.id AS from_id, b.id AS to_id, r.type AS rel_type,
               r.start_date AS start_date, r.end_date AS end_date
        """
    )
    relations = []
    for rec in relations_result:
        relations.append({
            "from_id": rec["from_id"],
            "to_id": rec["to_id"],
            "relation_type": rec["rel_type"],
        })

    return {"persons": persons, "relations": relations}

def export_database(session: Session) -> ExportData:
    persons_result = session.run(
        """
        MATCH (p:Person)
        RETURN p
        ORDER BY p.last_name, p.first_name
        """
    )

    persons = []
    for rec in persons_result:
        p = dict(rec["p"])
        persons.append(
            ExportPerson(
                id=p["id"],
                first_name=p["first_name"],
                last_name=p["last_name"],
                birth_year=p.get("birth_year"),
                death_year=p.get("death_year"),
                title=p.get("title"),
                country=p.get("country"),
                dynasty=p.get("dynasty"),
                gender=p.get("gender"),
                comment=p.get("comment"),
                created_at=p.get("created_at"),
                updated_at=p.get("updated_at"),
            )
        )

    relations_result = session.run(
        """
        MATCH (a:Person)-[r:RELATED_TO]->(b:Person)
        RETURN a.id AS from_id, b.id AS to_id,
               r.type AS relation_type,
               r.reverse_type AS reverse_type,
               r.start_date AS start_date,
               r.end_date AS end_date
        """
    )

    relations = []
    for rec in relations_result:
        relations.append(
            ExportRelation(
                from_id=rec["from_id"],
                to_id=rec["to_id"],
                relation_type=rec["relation_type"],
                reverse_type=rec["reverse_type"],
                start_date=rec["start_date"],
                end_date=rec["end_date"],
            )
        )

    return ExportData(
        persons=persons,
        relations=relations,
    )

def import_database(session: Session, data: ImportData, replace: bool = False) -> dict:
    session.run(
        "CREATE CONSTRAINT person_id IF NOT EXISTS "
        "FOR (p:Person) REQUIRE p.id IS UNIQUE"
    )

    def _do_import(tx):
        if replace:
            tx.run("MATCH (n) DETACH DELETE n")

        for person in data.persons:
            tx.run(
                """
                MERGE (p:Person {id: $id})
                SET p.first_name  = $first_name,
                    p.last_name   = $last_name,
                    p.birth_year  = $birth_year,
                    p.death_year  = $death_year,
                    p.title       = $title,
                    p.country     = $country,
                    p.dynasty     = $dynasty,
                    p.gender      = $gender,
                    p.comment     = $comment,
                    p.created_at  = coalesce(p.created_at, $created_at),
                    p.updated_at  = $updated_at
                """,
                **person.model_dump()
            )

        for rel in data.relations:
            tx.run(
                """
                MATCH (a:Person {id: $from_id}), (b:Person {id: $to_id})
                MERGE (a)-[r:RELATED_TO {type: $relation_type}]->(b)
                SET r.reverse_type = $reverse_type,
                    r.start_date   = $start_date,
                    r.end_date     = $end_date
                """,
                **rel.model_dump()
            )

    session.execute_write(_do_import)

    return {
        "status": "success",
        "persons_imported": len(data.persons),
        "relations_imported": len(data.relations),
        "mode": "replace" if replace else "merge",
        "message": (
            f"База заменена: {len(data.persons)} персон, {len(data.relations)} связей"
            if replace else
            f"Добавлено/обновлено: {len(data.persons)} персон, {len(data.relations)} связей"
        )
    }

# UC-09: редактирование персоны
def update_person(session: Session, person_id: str, data: PersonCreate, target_genders: dict) -> PersonFull:
    now = _now_iso()

    session.run(
        """
        MATCH (p:Person {id: $id})
        SET p.first_name = $first_name,
            p.last_name  = $last_name,
            p.birth_year = $birth_year,
            p.death_year = $death_year,
            p.title      = $title,
            p.country    = $country,
            p.dynasty    = $dynasty,
            p.gender     = $gender,
            p.comment    = $comment,
            p.updated_at = $updated_at
        """,
        id=person_id,
        first_name=data.first_name,
        last_name=data.last_name,
        birth_year=data.birth_year,
        death_year=data.death_year,
        title=data.title,
        country=data.country,
        dynasty=data.dynasty,
        gender=data.gender,
        comment=data.comment,
        updated_at=now,
    )

    session.run(
        """
        MATCH (p:Person {id: $id})-[r:RELATED_TO]-()
        DELETE r
        """,
        id=person_id,
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
            from_id=person_id,
            to_id=rel.related_person_id,
            rel_type=rel.relation_type,
            rev_type=rev_type,
            start_date=s_date,
            end_date=e_date,
        )

    return get_person_by_id(session, person_id)

def get_custom_stats(session: Session, params: CustomStatsParams) -> CustomStatsResult:
    conditions: list[str] = []
    qp: dict = {}

    if params.country:
        conditions.append("p.country = $country")
        qp["country"] = params.country

    if params.gender:
        conditions.append("p.gender = $gender")
        qp["gender"] = params.gender

    if params.birth_year_from is not None:
        conditions.append("p.birth_year IS NOT NULL AND p.birth_year >= $birth_year_from")
        qp["birth_year_from"] = params.birth_year_from

    if params.birth_year_to is not None:
        conditions.append("p.birth_year IS NOT NULL AND p.birth_year <= $birth_year_to")
        qp["birth_year_to"] = params.birth_year_to

    if params.death_year_from is not None:
        conditions.append("p.death_year IS NOT NULL AND p.death_year >= $death_year_from")
        qp["death_year_from"] = params.death_year_from

    if params.death_year_to is not None:
        conditions.append("p.death_year IS NOT NULL AND p.death_year <= $death_year_to")
        qp["death_year_to"] = params.death_year_to

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    x_map = {
        "birth_year": "toString(p.birth_year)",
        "title":      "coalesce(p.title, '—')",
        "country":    "coalesce(p.country, '—')",
    }
    x_expr = x_map[params.axis_x]

    if params.axis_y == "count":
        y_expr = "count(p)"
        y_alias = "y_val"
        extra_match = ""
    elif params.axis_y == "avg_age":
        y_expr = """avg(
            CASE WHEN p.birth_year IS NOT NULL AND p.death_year IS NOT NULL
            THEN p.death_year - p.birth_year END
        )"""
        y_alias = "y_val"
        extra_match = ""
    else:
        extra_match = """
        OPTIONAL MATCH (p)-[m:RELATED_TO {type: 'spouse'}]->(:Person)
        """
        y_expr = "avg(coalesce(count(m), 0))"
        y_alias = "y_val"

    cypher = f"""
        MATCH (p:Person)
        {where}
        {extra_match}
        WITH {x_expr} AS x_label, p
        WITH x_label, count(p) AS grp_count,
             avg(
                 CASE WHEN p.birth_year IS NOT NULL AND p.death_year IS NOT NULL
                 THEN p.death_year - p.birth_year END
             ) AS grp_avg_age
        RETURN x_label, grp_count, grp_avg_age
        ORDER BY x_label
    """

    if params.axis_y == "marriages":
        cypher = f"""
            MATCH (p:Person)
            {where}
            WITH {x_expr} AS x_label, p
            OPTIONAL MATCH (p)-[:RELATED_TO {{type: 'spouse'}}]->(:Person)
            WITH x_label, p, count(*) AS p_marriages
            WITH x_label,
                 count(p)            AS grp_count,
                 avg(p_marriages)    AS grp_marriages,
                 avg(
                     CASE WHEN p.birth_year IS NOT NULL AND p.death_year IS NOT NULL
                     THEN p.death_year - p.birth_year END
                 ) AS grp_avg_age
            RETURN x_label, grp_count, grp_marriages, grp_avg_age
            ORDER BY x_label
        """

    rows = list(session.run(cypher, **qp))

    chart: list[ChartDataPoint] = []
    total_persons = 0
    weighted_age_sum = 0.0
    age_count = 0

    for row in rows:
        label = row["x_label"] or "—"
        grp_count: int = row["grp_count"] or 0
        grp_avg_age: float | None = row.get("grp_avg_age")

        if params.axis_y == "count":
            value = float(grp_count)
        elif params.axis_y == "avg_age":
            value = round(grp_avg_age, 1) if grp_avg_age is not None else 0.0
        else:
            value = round(row.get("grp_marriages") or 0.0, 2)

        chart.append(ChartDataPoint(label=label, value=value, count=grp_count))
        total_persons += grp_count

        if grp_avg_age is not None:
            weighted_age_sum += grp_avg_age * grp_count
            age_count += grp_count

    overall_avg_age = round(weighted_age_sum / age_count, 1) if age_count else None

    peak_conditions = list(conditions) + ["p.birth_year IS NOT NULL"]
    peak_where = "WHERE " + " AND ".join(peak_conditions)

    peak_result = session.run(f"""
        MATCH (p:Person)
        {peak_where}
        WITH p.birth_year AS yr, count(*) AS cnt
        ORDER BY cnt DESC, yr
        LIMIT 1
        RETURN yr
    """, **qp)
    peak_row = peak_result.single()
    peak_birth_year = peak_row["yr"] if peak_row else None

    return CustomStatsResult(
        chart=chart,
        total_persons=total_persons,
        avg_age=overall_avg_age,
        peak_birth_year=peak_birth_year,
    )