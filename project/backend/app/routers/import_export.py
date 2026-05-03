from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from neo4j import Session
from app.db import get_session
from app.models import ExportData, ImportData, ExportPerson, ExportRelation
from app.services import person_service
from fastapi import UploadFile, File, Query
import json
import csv
import io
import xml.etree.ElementTree as ET

router = APIRouter(prefix="/api", tags=["import-export"])

@router.get("/export/json", response_model=ExportData)
def export_json(session: Session = Depends(get_session)):
    return person_service.export_database(session)


@router.get("/export/csv")
def export_csv(session: Session = Depends(get_session)):
    data = person_service.export_database(session)
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["=== PERSONS ==="])
    writer.writerow(["id", "first_name", "last_name", "birth_year", "death_year",
                     "title", "country", "dynasty", "gender", "comment",
                     "created_at", "updated_at"])
    for p in data.persons:
        writer.writerow([p.id, p.first_name, p.last_name, p.birth_year, p.death_year,
                         p.title, p.country, p.dynasty, p.gender, p.comment,
                         p.created_at, p.updated_at])
    writer.writerow([])
    writer.writerow(["=== RELATIONS ==="])
    writer.writerow(["from_id", "to_id", "relation_type", "reverse_type",
                     "start_date", "end_date"])
    for r in data.relations:
        writer.writerow([r.from_id, r.to_id, r.relation_type, r.reverse_type,
                         r.start_date, r.end_date])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=dynasty_export.csv"}
    )


@router.get("/export/xml")
def export_xml(session: Session = Depends(get_session)):
    data = person_service.export_database(session)
    root = ET.Element("dynasty")

    persons_el = ET.SubElement(root, "persons")
    for p in data.persons:
        el = ET.SubElement(persons_el, "person")
        for field, value in p.model_dump().items():
            ET.SubElement(el, field).text = str(value) if value is not None else ""

    relations_el = ET.SubElement(root, "relations")
    for r in data.relations:
        el = ET.SubElement(relations_el, "relation")
        for field, value in r.model_dump().items():
            ET.SubElement(el, field).text = str(value) if value is not None else ""

    xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")
    return StreamingResponse(
        iter([xml_str]),
        media_type="application/xml",
        headers={"Content-Disposition": "attachment; filename=dynasty_export.xml"}
    )


def _parse_csv(content: bytes) -> ImportData:
    text = content.decode("utf-8")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    persons_start = relations_start = None
    for i, row in enumerate(rows):
        if row and row[0] == "=== PERSONS ===":
            persons_start = i + 2
        if row and row[0] == "=== RELATIONS ===":
            relations_start = i + 2

    if persons_start is None or relations_start is None:
        raise ValueError("Неверная структура CSV: не найдены секции PERSONS или RELATIONS")

    persons = []
    for row in rows[persons_start:]:
        if not any(row):
            break
        if len(row) < 12:
            raise ValueError(f"Неверное количество колонок в строке персоны: {row}")
        persons.append(ExportPerson(
            id=row[0], first_name=row[1], last_name=row[2],
            birth_year=int(row[3]) if row[3] else None,
            death_year=int(row[4]) if row[4] else None,
            title=row[5] or None, country=row[6] or None,
            dynasty=row[7] or None, gender=row[8] or None,
            comment=row[9] or None,
            created_at=row[10] or None, updated_at=row[11] or None,
        ))

    relations = []
    for row in rows[relations_start:]:
        if not any(row):
            break
        if len(row) < 6:
            raise ValueError(f"Неверное количество колонок в строке связи: {row}")
        relations.append(ExportRelation(
            from_id=row[0], to_id=row[1],
            relation_type=row[2], reverse_type=row[3] or None,
            start_date=row[4] or None, end_date=row[5] or None,
        ))

    return ImportData(persons=persons, relations=relations)


def _parse_xml(content: bytes) -> ImportData:
    try:
        root = ET.fromstring(content.decode("utf-8"))
    except ET.ParseError as e:
        raise ValueError(f"Невалидный XML: {e}")

    def text(el, tag) -> str | None:
        child = el.find(tag)
        return child.text if child is not None and child.text else None

    persons_el = root.find("persons")
    relations_el = root.find("relations")

    if persons_el is None or relations_el is None:
        raise ValueError("XML должен содержать теги <persons> и <relations>")

    persons = []
    for el in persons_el.findall("person"):
        persons.append(ExportPerson(
            id=text(el, "id"),
            first_name=text(el, "first_name"),
            last_name=text(el, "last_name"),
            birth_year=int(text(el, "birth_year")) if text(el, "birth_year") else None,
            death_year=int(text(el, "death_year")) if text(el, "death_year") else None,
            title=text(el, "title"), country=text(el, "country"),
            dynasty=text(el, "dynasty"), gender=text(el, "gender"),
            comment=text(el, "comment"),
            created_at=text(el, "created_at"), updated_at=text(el, "updated_at"),
        ))

    relations = []
    for el in relations_el.findall("relation"):
        relations.append(ExportRelation(
            from_id=text(el, "from_id"), to_id=text(el, "to_id"),
            relation_type=text(el, "relation_type"),
            reverse_type=text(el, "reverse_type"),
            start_date=text(el, "start_date"), end_date=text(el, "end_date"),
        ))

    return ImportData(persons=persons, relations=relations)

@router.post("/import/file")
async def import_file(
    file: UploadFile = File(...),
    replace: bool = Query(False),
    session: Session = Depends(get_session),
):
    filename = file.filename.lower()
    if not any(filename.endswith(ext) for ext in (".json", ".csv", ".xml")):
        raise HTTPException(status_code=400, detail="Поддерживаются только .json, .csv, .xml")

    MAX_SIZE = 10 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 10 МБ)")

    try:
        if filename.endswith(".json"):
            raw = json.loads(content)
            if "persons" not in raw or "relations" not in raw:
                raise ValueError('Файл должен содержать поля "persons" и "relations"')
            data = ImportData(**raw)

        elif filename.endswith(".csv"):
            data = _parse_csv(content)

        elif filename.endswith(".xml"):
            data = _parse_xml(content)

    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Ошибка разбора файла: {str(e)}")

    return person_service.import_database(session, data, replace)