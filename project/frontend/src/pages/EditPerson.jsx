import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getPerson, updatePerson, searchPersons } from "../api/api";
import "../style.css";

const RELATION_TYPES = [
  { value: "father",   label: "Отец" },
  { value: "mother",   label: "Мать" },
  { value: "son",      label: "Сын" },
  { value: "daughter", label: "Дочь" },
  { value: "spouse",   label: "Супруг(а)" },
];

const REVERSE_DISPLAY = {
  mother: "Мать", father: "Отец", son: "Сын",
  daughter: "Дочь", spouse: "Супруг(а)", child: "Ребёнок",
};

export default function EditPerson() {
  const { id } = useParams();
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    first_name: "", last_name: "", gender: "",
    birth_year: "", death_year: "", title: "",
    country: "", dynasty: "", comment: "",
  });

  const [relations, setRelations] = useState([]);

  useEffect(() => {
    getPerson(id).then((p) => {
      setForm({
        first_name: p.first_name ?? "",
        last_name:  p.last_name  ?? "",
        gender:     p.gender     ?? "",
        birth_year: p.birth_year?.toString() ?? "",
        death_year: p.death_year?.toString() ?? "",
        title:      p.title   ?? "",
        country:    p.country ?? "",
        dynasty:    p.dynasty ?? "",
        comment:    p.comment ?? "",
      });

      setRelations(
        (p.relations ?? []).map((rel) => ({
          type:    rel.relation_type,
          person:  {
            id:         rel.related_person.id,
            first_name: rel.related_person.first_name,
            last_name:  rel.related_person.last_name,
            gender:     rel.related_person.gender,
          },
          search:  `${rel.related_person.first_name} ${rel.related_person.last_name}`,
          results: [],
        }))
      );
      setLoading(false);
    }).catch(() => {
      alert("Не удалось загрузить персону");
      navigate(-1);
    });
  }, [id]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: false }));
  }

  function addRelationRow() {
    setRelations((prev) => [...prev, { type: "", person: null, search: "", results: [] }]);
  }

  function removeRelationRow(index) {
    setRelations((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRelation(index, key, value) {
    const copy = [...relations];
    copy[index][key] = value;
    setRelations(copy);
  }

  async function searchRelation(index, value) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (!value) {
        const copy = [...relations];
        copy[index].results = [];
        setRelations(copy);
        return;
      }
      try {
        const res = await searchPersons({ first_name: value });
        const copy = [...relations];
        copy[index].results = (res || []).filter((p) => p.id !== id);
        setRelations(copy);
      } catch (e) {
        console.error(e);
      }
    }, 300);
  }

  function selectRelationPerson(index, person) {
    const copy = [...relations];
    copy[index].person  = person;
    copy[index].search  = `${person.first_name} ${person.last_name}`;
    copy[index].results = [];
    setRelations(copy);
  }

  function validate() {
    const e = {};
    const msgs = [];
    const hasDigits   = /\d/;
    const isOnlyDigits = /^\d+$/;

    if (!form.first_name.trim()) { e.first_name = true; msgs.push("Имя обязательно"); }
    if (!form.last_name.trim())  { e.last_name  = true; msgs.push("Фамилия обязательна"); }
    if (!form.gender)            { e.gender     = true; msgs.push("Выберите пол"); }
    if (!form.title.trim())      { e.title      = true; msgs.push("Титул обязателен"); }
    if (!form.country.trim())    { e.country    = true; msgs.push("Страна обязательна"); }
    if (!form.dynasty.trim())    { e.dynasty    = true; msgs.push("Династия обязательна"); }

    const bYear = form.birth_year.toString().trim();
    const dYear = form.death_year.toString().trim();

    if (!bYear) {
      e.birth_year = true; msgs.push("Год рождения обязателен");
    } else if (!isOnlyDigits.test(bYear) || Number(bYear) <= 0) {
      e.birth_year = true; msgs.push("Год рождения должен быть положительным числом");
    }

    if (dYear && (!isOnlyDigits.test(dYear) || Number(dYear) <= 0)) {
      e.death_year = true; msgs.push("Год смерти должен быть положительным числом");
    }

    if (!e.birth_year && !e.death_year && dYear && Number(dYear) < Number(bYear)) {
      e.death_year = true; msgs.push("Год смерти не может быть меньше года рождения");
    }

    relations.forEach((r, idx) => {
      if (r.type && !r.person) msgs.push(`В связи #${idx + 1} выбран тип, но не выбрана персона`);
      if (r.type === "spouse" && r.person && form.gender && r.person.gender === form.gender) {
        msgs.push(`Супруг(а) не может быть того же пола`);
      }
    });

    setErrors(e);
    if (msgs.length) alert("Ошибки:\n\n• " + msgs.join("\n• "));
    return msgs.length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    const payload = {
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
      gender:     form.gender,
      title:      form.title.trim(),
      country:    form.country.trim(),
      dynasty:    form.dynasty.trim(),
      comment:    form.comment || null,
      birth_year: Number(form.birth_year),
      death_year: form.death_year ? Number(form.death_year) : null,
      relations: relations
        .filter((r) => r.type && r.person)
        .map((r) => ({ relation_type: r.type, related_person_id: r.person.id })),
    };

    try {
      await updatePerson(id, payload);
      navigate(-1);
    } catch (e) {
      alert("Ошибка при сохранении");
    }
  }

  if (loading) return <div className="page"><Navbar /><p>Загрузка...</p></div>;

  return (
    <div className="add-person-page">
      <div className="add-person-container">
        <Navbar />
        <h1>Редактирование персоны</h1>

        <div className="form-container">
          <div className="form-row">
            <input placeholder="Имя *" value={form.first_name}
              onChange={(e) => updateField("first_name", e.target.value)}
              style={{ border: errors.first_name ? "1px solid red" : "" }} />
            <input placeholder="Фамилия *" value={form.last_name}
              onChange={(e) => updateField("last_name", e.target.value)}
              style={{ border: errors.last_name ? "1px solid red" : "" }} />
          </div>

          <div className="form-row">
            <input placeholder="Год рождения *" value={form.birth_year}
              onChange={(e) => updateField("birth_year", e.target.value)}
              style={{ border: errors.birth_year ? "1px solid red" : "" }} />
            <input placeholder="Год смерти" value={form.death_year}
              onChange={(e) => updateField("death_year", e.target.value)}
              style={{ border: errors.death_year ? "1px solid red" : "" }} />
            <select value={form.gender} onChange={(e) => updateField("gender", e.target.value)}
              style={{ border: errors.gender ? "1px solid red" : "" }}>
              <option value="">Пол *</option>
              <option value="M">М</option>
              <option value="F">Ж</option>
            </select>
          </div>

          <div className="form-row">
            <input placeholder="Титул *" value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              style={{ border: errors.title ? "1px solid red" : "" }} />
            <input placeholder="Страна *" value={form.country}
              onChange={(e) => updateField("country", e.target.value)}
              style={{ border: errors.country ? "1px solid red" : "" }} />
            <input placeholder="Династия *" value={form.dynasty}
              onChange={(e) => updateField("dynasty", e.target.value)}
              style={{ border: errors.dynasty ? "1px solid red" : "" }} />
          </div>

          <textarea placeholder="Комментарий" value={form.comment}
            onChange={(e) => updateField("comment", e.target.value)} />
        </div>

        <h2>Связи</h2>

        {relations.map((r, i) => (
          <div key={i} className="relation-row">
            <select value={r.type} onChange={(e) => updateRelation(i, "type", e.target.value)}>
              <option value="">Тип</option>
              {RELATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <input placeholder="Поиск по имени" value={r.search}
              onChange={(e) => {
                updateRelation(i, "search", e.target.value);
                updateRelation(i, "person", null);
                searchRelation(i, e.target.value);
              }} />

            {r.results?.length > 0 && (
              <div className="search-results">
                {r.results.map((p) => (
                  <div key={p.id} className="search-result-item"
                    onClick={() => selectRelationPerson(i, p)}>
                    {p.first_name} {p.last_name}
                  </div>
                ))}
              </div>
            )}

            {r.person && (
              <span className="selected-person">
                ✓ {r.person.first_name} {r.person.last_name}
              </span>
            )}

            <button onClick={() => removeRelationRow(i)}
              style={{ background: "#ffd6d6", border: "none", borderRadius: 4, cursor: "pointer", padding: "4px 10px" }}>
              ✕
            </button>
          </div>
        ))}

        <button className="add-relation-btn" onClick={addRelationRow}>+ Добавить связь</button>

        <div className="actions" style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button className="save-btn" onClick={handleSubmit}>Сохранить</button>
          <button className="cancel-btn" onClick={() => navigate(-1)}>Отмена</button>
        </div>
      </div>
    </div>
  );
}