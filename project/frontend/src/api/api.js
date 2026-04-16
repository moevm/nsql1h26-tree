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