import { useState } from "react";
import Navbar from "../components/Navbar";
import "../style.css";

export default function ImportExport() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [format, setFormat] = useState("json");
  const [replaceMode, setReplaceMode] = useState(true);

  const exportData = async () => {
    try {
      // для JSON парсим и пересобираем, для остальных — качаем напрямую
      if (format === "json") {
        const res = await fetch("/api/export/json");
        if (!res.ok) throw new Error("Ошибка сервера");
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        triggerDownload(blob, "dynasty_export.json");
      } else {
        const res = await fetch(`/api/export/${format}`);
        if (!res.ok) throw new Error("Ошибка сервера");
        const blob = await res.blob();
        triggerDownload(blob, `dynasty_export.${format}`);
      }
    } catch (err) {
      setMessage("Ошибка экспорта: " + err.message);
    }
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const importData = async () => {
    if (!file) return;
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/import/file?replace=${replaceMode}`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`Ошибка: ${data.detail}`);
        return;
      }

      setMessage(data.message);
    } catch (err) {
      setMessage("Ошибка импорта: " + err.message);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <h1>Управление данными</h1>

      <div className="io-grid">
        <div className="io-box export">
          <h2>Экспорт данных</h2>
          <p>Выгрузить всю БД в файл</p>

          <div className="formats">
            <span>Формат:</span>
            {["json", "csv", "xml"].map((f) => (
              <label key={f}>
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                />
                {f.toUpperCase()}
              </label>
            ))}
          </div>

          <button onClick={exportData}>Экспортировать</button>
        </div>

        <div className="io-box import">
        <h2>Импорт данных</h2>

        <div className="formats">
          <span>Режим:</span>
          <label>
            <input
              type="radio"
              name="replaceMode"
              checked={replaceMode}
              onChange={() => setReplaceMode(true)}
            />
            Заменить всё
          </label>
        </div>

        {replaceMode && (
          <p className="warning">⚠️ Текущая база будет полностью удалена</p>
        )}

        <input
          type="file"
          accept=".json,.csv,.xml"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button onClick={importData}>Импортировать</button>

        {message && <p className="success">{message}</p>}
      </div>
      </div>
    </div>
  );
}