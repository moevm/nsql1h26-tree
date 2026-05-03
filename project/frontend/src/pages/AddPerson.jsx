import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { createPerson, searchPersons } from "../api/api";
import "../style.css";

export default function AddPerson() {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    gender: "",
    birth_year: "",
    death_year: "",
    title: "",
    country: "",
    dynasty: "",
    comment: "",
  });

  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [relations, setRelations] = useState([
    { type: "", person: null, search: "", results: [] },
  ]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: false }));
  }

  function validate() {
    const e = {};
    const msgs = [];
    const hasDigits = /\d/;
    const isOnlyDigits = /^\d+$/;

    if (!form.first_name.trim()) {
      e.first_name = true;
      msgs.push("Имя обязательно");
    } else {
      if (form.first_name.length > 100) {
        e.first_name = true;
        msgs.push("Имя не должно превышать 100 символов");
      }
      if (hasDigits.test(form.first_name)) {
        e.first_name = true;
        msgs.push("Имя не должно содержать цифры");
      }
    }

    if (!form.last_name.trim()) {
      e.last_name = true;
      msgs.push("Фамилия обязательна");
    } else {
      if (form.last_name.length > 100) {
        e.last_name = true;
        msgs.push("Фамилия не должна превышать 100 символов");
      }
      if (hasDigits.test(form.last_name)) {
        e.last_name = true;
        msgs.push("Фамилия не должна содержать цифры");
      }
    }

    if (!form.title.trim()) {
      e.title = true;
      msgs.push("Титул обязателен");
    } else {
      if (form.title.length > 100) {
        e.title = true;
        msgs.push("Титул не должен превышать 100 символов");
      }
      if (hasDigits.test(form.title)) {
        e.title = true;
        msgs.push("Титул не должен содержать цифры");
      }
    }

    if (!form.country.trim()) {
      e.country = true;
      msgs.push("Страна обязательна");
    } else {
      if (form.country.length > 100) {
        e.country = true;
        msgs.push("Страна не должна превышать 100 символов");
      }
      if (hasDigits.test(form.country)) {
        e.country = true;
        msgs.push("Страна не должна содержать цифры");
      }
    }

    if (!form.dynasty.trim()) {
      e.dynasty = true;
      msgs.push("Династия обязательна");
    } else {
      if (form.dynasty.length > 100) {
        e.dynasty = true;
        msgs.push("Династия не должна превышать 100 символов");
      }
      if (hasDigits.test(form.dynasty)) {
        e.dynasty = true;
        msgs.push("Династия не должна содержать цифры");
      }
    }

    if (form.comment && form.comment.length > 100) {
      e.comment = true;
      msgs.push("Комментарий не должен превышать 100 символов");
    }

    if (!form.gender) {
      e.gender = true;
      msgs.push("Выберите пол");
    }

    const bYear = form.birth_year.toString().trim();
    const dYear = form.death_year.toString().trim();

    if (!bYear) {
      e.birth_year = true;
      msgs.push("Год рождения обязателен");
    } else if (!isOnlyDigits.test(bYear)) {
      e.birth_year = true;
      msgs.push("Год рождения должен содержать только цифры");
    } else if (Number(bYear) <= 0) {
      e.birth_year = true;
      msgs.push("Год рождения должен быть положительным числом");
    }

    if (dYear) {
      if (!isOnlyDigits.test(dYear)) {
        e.death_year = true;
        msgs.push("Год смерти должен содержать только цифры");
      } else if (Number(dYear) <= 0) {
        e.death_year = true;
        msgs.push("Год смерти должен быть положительным числом");
      }
    }

    if (!e.birth_year && !e.death_year && dYear) {
      if (Number(dYear) < Number(bYear)) {
        e.death_year = true;
        msgs.push("Год смерти не может быть меньше года рождения");
      }
    }

    relations.forEach((r, idx) => {
      if (r.type && !r.person) {
        msgs.push(`В связи #${idx + 1} выбран тип, но не выбрана персона`);
      }
      if (r.type === "spouse" && r.person && form.gender) {
        if (r.person.gender === form.gender) {
          msgs.push(
            `Супруг(а) не может быть того же пола (${form.gender === "M" ? "мужского" : "женского"})`,
          );
        }
      }
    });

    setErrors(e);
    if (msgs.length > 0) {
      alert("Ошибка заполнения формы:\n\n• " + msgs.join("\n• "));
    }
    return msgs.length === 0;
  }

  function toNull(v) {
    return v === "" || v === undefined ? null : v;
  }

  function addRelationRow() {
    setRelations((prev) => [
      ...prev,
      { type: "", person: null, search: "", results: [] },
    ]);
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
        copy[index].results = res || [];
        setRelations(copy);
      } catch (e) {
        console.error("SEARCH ERROR:", e);
      }
    }, 300);
  }

  function selectRelationPerson(index, person) {
    const copy = [...relations];
    copy[index].person = person;
    copy[index].search = `${person.first_name} ${person.last_name}`;
    copy[index].results = [];
    setRelations(copy);
  }

  async function handleSubmit() {
    if (!validate()) return;

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),

      gender: form.gender,
      title: form.title.trim(),
      country: form.country.trim(),
      dynasty: form.dynasty.trim(),
      comment: toNull(form.comment),

      birth_year: Number(form.birth_year),
      death_year: form.death_year ? Number(form.death_year) : null,

      relations: relations
        .filter((r) => r.type && r.person)
        .map((r) => ({
          relation_type: r.type,
          related_person_id: r.person.id,
        })),
    };

    console.dir(payload, { depth: null });

    try {
      const created = await createPerson(payload);

      setSuccessMsg(`Персона «${created.first_name} ${created.last_name}» успешно добавлена!`);
      setForm({ first_name: "", last_name: "", gender: "", birth_year: "", death_year: "", title: "", country: "", dynasty: "", comment: "" });
      setRelations([{ type: "", person: null, search: "", results: [] }]);
      setErrors({});
    } catch (e) {
      setSuccessMsg("");
      alert(
        e?.response?.data?.detail
          ? JSON.stringify(e.response.data.detail, null, 2)
          : "Ошибка при создании",
      );
    }
  }

  return (
    <div className="add-person-page">
      <div className="add-person-container">
        <Navbar />
        <h1>Добавление персоны</h1>

        {successMsg && (
          <div style={{ background: "#d4edda", color: "#155724", border: "1px solid #c3e6cb", borderRadius: "6px", padding: "12px 16px", marginBottom: "16px" }}>
            {successMsg}
          </div>
        )}

        <div className="form-container">
          <div className="form-row">
            <input
              placeholder="Имя *"
              value={form.first_name}
              onChange={(e) => updateField("first_name", e.target.value)}
              style={{ border: errors.first_name ? "1px solid red" : "" }}
            />

            <input
              placeholder="Фамилия *"
              value={form.last_name}
              onChange={(e) => updateField("last_name", e.target.value)}
              style={{ border: errors.last_name ? "1px solid red" : "" }}
            />
          </div>

          <div className="form-row">
            <input
              placeholder="Год рождения *"
              value={form.birth_year}
              onChange={(e) => updateField("birth_year", e.target.value)}
              style={{ border: errors.birth_year ? "1px solid red" : "" }}
            />

            <input
              placeholder="Год смерти"
              value={form.death_year}
              onChange={(e) => updateField("death_year", e.target.value)}
              style={{ border: errors.death_year ? "1px solid red" : "" }}
            />

            <select
              value={form.gender}
              onChange={(e) => updateField("gender", e.target.value)}
              style={{ border: errors.gender ? "1px solid red" : "" }}
            >
              <option value="">Пол *</option>
              <option value="M">М</option>
              <option value="F">Ж</option>
            </select>
          </div>

          <div className="form-row">
            <input
              placeholder="Титул *"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              style={{ border: errors.title ? "1px solid red" : "" }}
            />

            <input
              placeholder="Страна *"
              value={form.country}
              onChange={(e) => updateField("country", e.target.value)}
              style={{ border: errors.country ? "1px solid red" : "" }}
            />

            <input
              placeholder="Династия *"
              value={form.dynasty}
              onChange={(e) => updateField("dynasty", e.target.value)}
              style={{ border: errors.dynasty ? "1px solid red" : "" }}
            />
          </div>

          <textarea
            placeholder="Комментарий"
            value={form.comment}
            onChange={(e) => updateField("comment", e.target.value)}
          />
        </div>

        <h2>Связи</h2>

        {relations.map((r, i) => (
          <div key={i} className="relation-row">
            <select
              value={r.type}
              onChange={(e) => updateRelation(i, "type", e.target.value)}
            >
              <option value="">Тип</option>
              <option value="father">Отец</option>
              <option value="mother">Мать</option>
              <option value="son">Сын</option>
              <option value="daughter">Дочь</option>
              <option value="spouse">Супруг(а)</option>
            </select>

            <input
              placeholder="Поиск"
              value={r.search}
              onChange={(e) => {
                updateRelation(i, "search", e.target.value);
                searchRelation(i, e.target.value);
              }}
            />

            {r.results?.length > 0 && (
              <div className="search-results">
                {r.results.map((p) => (
                  <div key={p.id} onClick={() => selectRelationPerson(i, p)}>
                    {p.first_name} {p.last_name}
                  </div>
                ))}
              </div>
            )}

            {r.person && (
              <div>
                ✓ {r.person.first_name} {r.person.last_name}
              </div>
            )}
          </div>
        ))}

        <button onClick={addRelationRow}>+ Добавить связь</button>

        <div className="actions">
          <button onClick={handleSubmit}>Сохранить</button>
          <button onClick={() => navigate(-1)}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
