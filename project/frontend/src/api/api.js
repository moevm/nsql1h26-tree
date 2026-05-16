const API_BASE = import.meta.env.VITE_API_URL;

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats/`);
  return res.json();
}

export async function getRecent() {
  const res = await fetch(`${API_BASE}/persons/recent`);
  return res.json();
}

export async function searchPersons(filters, page = 1, pageSize = 20) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries({ ...filters, page, page_size: pageSize })
      .filter(([_, v]) => v !== "" && v !== null && v !== undefined))
  );
  const res = await fetch(`${API_BASE}/persons/search?${params}`);
  if (!res.ok) throw new Error("Search failed");
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

  const json = await res.json().catch(() => null);
  if (!res.ok) throw { response: { data: json } };
  return json;
}

export async function deletePerson(id) {
  const res = await fetch(`${API_BASE}/persons/${id}`, {
    method: "DELETE",
  });
  return res.json();
}

export async function getGraphData() {
  const res = await fetch(`${API_BASE}/graph`);
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

export async function getCustomStats(params) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== "" && v !== null && v !== undefined))
  );
  const res = await fetch(`${API_BASE}/stats/custom?${query}`);
  if (!res.ok) throw new Error("Ошибка загрузки статистики");
  return res.json();
}