import { useEffect, useState } from "react";
import { getStats, getRecent } from "../api/api";
import Navbar from "../components/Navbar";
import PersonModal from "../components/PersonModal";
import "../style.css";

export default function Home() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const statsData = await getStats();
        const recentData = await getRecent();

        setStats(statsData);
        setRecent(recentData);

      } catch (err) {
        setError("Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>{error}</div>;

  return (
    
    <div className="page">
      <Navbar />

      <h1>Династия Романовых</h1>

      <h3>Российский императорский дом  {stats.dynasty_start} - {stats.dynasty_end}</h3>

      <div className="cards">
        <div className="card pink">
          <div className="value">{stats.total_persons}</div>
          <div>Персон в базе данных</div>
        </div>

        <div className="card blue">
          <div className="value">{stats.avg_age}</div>
          <div>Средний возраст</div>
        </div>

        <div className="card yellow">
          <div className="value">
            {stats.dynasty_end - stats.dynasty_start}
          </div>
          <div>лет в истории</div>
        </div>
      </div>

      <h2>Последние добавленные</h2>

      {recent.length === 0 ? (
        <div>Нет данных</div>
      ) : (
        <div className="recent-list">
          {recent.map(p => (
            <div 
              className="person-card" 
              key={p.id}
              onClick={() => {
                setSelectedPerson(p);
                setIsModalOpen(true);
              }}
              style={{ cursor: "pointer" }}
            >
              <div className="person-name">
                {p.first_name} {p.last_name}
              </div>

              <div className="person-years">
                {p.birth_year ?? "?"} – {p.death_year ?? "н.в."}
              </div>
            </div>
          ))}
        </div>
      )}

      <PersonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        person={selectedPerson}
      />
    </div>
  );
}