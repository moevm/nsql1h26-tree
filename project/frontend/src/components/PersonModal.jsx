import { useEffect, useState } from "react";

function getRelationLabel(type) {
  const map = {
    mother: "Мать",
    father: "Отец",
    spouse: "Супруг(а)",
    son: "Ребенок",
    daughter: "Ребенок",
  };

  return map[type] || type;
}

export default function PersonModal({
  isOpen,
  onClose,
  person,
  onSelectPerson,
  onDelete,
}) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (person) setData(person);
  }, [person]);

  if (!isOpen || !data) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <span>
            {data.first_name} {data.last_name}
          </span>

          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">

          <div className="modal-info">
            <p>Год рождения: {data.birth_year ?? "?"}</p>
            <p>Год смерти: {data.death_year ?? "н.в."}</p>
            <p>Титул: {data.title || "-"}</p>
            <p>Страна: {data.country || "-"}</p>
            <p>Династия: {data.dynasty || "-"}</p>
          </div>

          <div className="modal-relations">
            <h3>Родственные связи</h3>

            {!data.relations?.length ? (
              <p>Нет связей</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Персона</th>
                    <th>Годы</th>
                  </tr>
                </thead>

                <tbody>
                  {data.relations.map((rel, i) => (
                    <tr
                      key={i}
                      onClick={() => onSelectPerson?.(rel.related_person.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{getRelationLabel(rel.relation_type)}</td>
                      <td style={{ color: "blue" }}>
                        {rel.related_person.first_name} {rel.related_person.last_name}
                      </td>
                      <td>
                        {rel.related_person.birth_year ?? "?"} –{" "}
                        {rel.related_person.death_year ?? "н.в."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>

        <div className="modal-actions">
          <button onClick={() => console.log("EDIT CLICK:", data)}>
            Редактировать
          </button>

          <button
            onClick={() => {
              console.log("DELETE CLICK:", data.id);
              onDelete?.(data.id);
              onClose();
            }}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}