import { useState } from "react";
import { searchPersons } from "../api/api";
import Navbar from "../components/Navbar";
import PersonModal from "../components/PersonModal";
import "../style.css";
import { getPerson } from "../api/api";


export default function Search() {
  const [filters, setFilters] = useState({});
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  async function search() {
    setLoading(true);
    const data = await searchPersons(filters);
    setResults(data);
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

          <input placeholder="Год рождения от"
            onChange={e => setFilters({ ...filters, birth_year_from: e.target.value })}
          />

          <input placeholder="до"
            onChange={e => setFilters({ ...filters, birth_year_to: e.target.value })}
          />

          <input placeholder="Год смерти от"
            onChange={e => setFilters({ ...filters, death_year_from: e.target.value })}
          />

          <input placeholder="до"
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
        onClose={() => setIsModalOpen(false)}
        person={selectedPerson}
        onSelectPerson={async (id) => {
          const full = await getPerson(id);
          setSelectedPerson(full);
        }}
        onDelete={(id) => console.log("delete", id)}
        onSave={(data) => console.log("save", data)}
      />
    </div>
  );
}