const API_BASE = import.meta.env.VITE_API_URL;

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats/`);
  return res.json();
}

export async function getRecent() {
  const res = await fetch(`${API_BASE}/persons/recent`);
  return res.json();
}

export async function searchPersons(filters) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_BASE}/persons/search?${params}`);
  return res.json();
}

export async function getPerson(id) {
  const res = await fetch(`${API_BASE}/persons/${id}`);
  return res.json();
}

export async function createPerson(data) {
  const res = await fetch(`${API_BASE}/persons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function updatePerson(id, data) {
  const res = await fetch(`/api/persons/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Ошибка сохранения");
  return res.json();
}