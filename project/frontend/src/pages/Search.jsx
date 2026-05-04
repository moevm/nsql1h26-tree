import { useState } from "react";
import { searchPersons, getPerson, deletePerson } from "../api/api";
import Navbar from "../components/Navbar";
import PersonModal from "../components/PersonModal";
import "../style.css";


export default function Search() {
  const [filters, setFilters] = useState({});
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  async function search() {
    setLoading(true);
    const numericFields = ["birth_year_from", "birth_year_to", "death_year_from", "death_year_to"];
    const clean = Object.fromEntries(
      Object.entries(filters).filter(([k, v]) => {
        if (v === "" || v === null || v === undefined) return false;
        if (numericFields.includes(k)) return /^\d+$/.test(String(v));
        return true;
      })
    );
    try {
      const data = await searchPersons(clean);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  return (
    <div className="page">
      <Navbar />
      <h1>Поиск персон</h1>

      <div className="search-box">
        <div className="search-grid">
          <input placeholder="Имя"
            onChange={e => setFilters({ ...filters, first_name: e.target.value })}
          />

          <input placeholder="Фамилия"
            onChange={e => setFilters({ ...filters, last_name: e.target.value })}
          />

          <input placeholder="Титул"
            onChange={e => setFilters({ ...filters, title: e.target.value })}
          />

          <select
            onChange={e => setFilters({ ...filters, gender: e.target.value })}
          >
            <option value="">Пол</option>
            <option value="M">M</option>
            <option value="F">Ж</option>
          </select>

          <input placeholder="Год рождения от" type="number" min="1"
            onChange={e => setFilters({ ...filters, birth_year_from: e.target.value })}
          />

          <input placeholder="до" type="number" min="1"
            onChange={e => setFilters({ ...filters, birth_year_to: e.target.value })}
          />

          <input placeholder="Год смерти от" type="number" min="1"
            onChange={e => setFilters({ ...filters, death_year_from: e.target.value })}
          />

          <input placeholder="до" type="number" min="1"
            onChange={e => setFilters({ ...filters, death_year_to: e.target.value })}
          />

        </div>

        <button onClick={search}>
          {loading ? "Поиск..." : "Найти"}
        </button>
      </div>

      <h2>Результаты</h2>

      <table>
        <tbody>
          {results.length === 0 ? (
            <tr><td>Ничего не найдено</td></tr>
          ) : (
            results.map(p => (
              <tr
                key={p.id}
                onClick={async () => {
                  setIsModalOpen(true);

                  const fullPerson = await getPerson(p.id);
                  setSelectedPerson(fullPerson);
                }}
              >
                <td>{p.first_name}</td>
                <td>{p.last_name}</td>
                <td>{p.title}</td>
                <td>{p.birth_year} - {p.death_year}</td>
                <td>{p.gender}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <PersonModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPerson(null);
        }}
        person={selectedPerson}
        onSelectPerson={async (id) => {
          const full = await getPerson(id);
          setSelectedPerson(full);
        }}
        onDelete={async (id) => {
          if (!window.confirm("Вы уверены, что хотите удалить эту персону? Все связи будут удалены.")) return;
          await deletePerson(id);
          setIsModalOpen(false);
          setSelectedPerson(null);
          await search();
        }}
      />
    </div>
  );
}
