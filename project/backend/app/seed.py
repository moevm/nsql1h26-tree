from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from neo4j import Session
from app.seed_data import PERSONS, RELATIONS

def _now():
    return datetime.now(timezone.utc).isoformat()

def _get_reverse_type(rel_type: str, person_gender: Optional[str]) -> str:
    # Динамически вычисляет обратную связь
    if rel_type in ("father", "mother"):
        if person_gender == "M": return "son"
        if person_gender == "F": return "daughter"
        return "child"

    if rel_type in ("son", "daughter"):
        if person_gender == "M": return "father"
        if person_gender == "F": return "mother"
        return "parent"
    
    if rel_type == "spouse":
        return "spouse"
    
    raise ValueError(f"Unknown relation type: {rel_type}")

def seed(session: Session) -> None: 
    # Создает индекс 
    session.run("CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE")

    # Заполняет БД, если она пустая
    count = session.run("MATCH (p:Person) RETURN count(p) AS c").single()["c"]
    if count > 0:
        print(f"[seed] DB already contains {count} people")
        return 
    
    print("[seed] Filling DB...")

    key_to_id: dict[str, str] = {}
    key_to_gender: dict[str, str] = {}

    for key, first, last, birth, death, title, country, gender in PERSONS:
        pid = str(uuid4())
        key_to_id[key] = pid
        key_to_gender[key] = gender

        session.run(
            """
            CREATE (p:Person {
                id: $id, first_name: $first_name, last_name: $last_name,
                birth_year: $birth_year, death_year: $death_year,
                title: $title, country: $country, dynasty: 'Романовы',
                gender: $gender, comment: '',
                created_at: $ts, updated_at: $ts
            })
            """,
            id=pid, first_name=first, last_name=last,
            birth_year=birth, death_year=death,
            title=title, country=country, gender=gender,
            ts=_now(),
        )

    for from_key, rel_type, to_key, start_date, end_date in RELATIONS:
        to_person_gender = key_to_gender[to_key]
        rev_type = _get_reverse_type(rel_type, to_person_gender)
        
        session.run(
            """
            MATCH (a:Person {id: $a_id}), (b:Person {id: $b_id})
            CREATE (a)-[:RELATED_TO {
                type: $rel_type, reverse_type: $rev_type,
                start_date: $start_date, end_date: $end_date
            }]->(b)
            """,
            a_id=key_to_id[from_key],
            b_id=key_to_id[to_key],
            rel_type=rel_type,
            rev_type=rev_type,
            start_date=start_date, 
            end_date=end_date
        )

    print(f"[seed] Added: {len(PERSONS)} people, {len(RELATIONS)} relations")