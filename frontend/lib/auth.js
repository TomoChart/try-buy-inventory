// lib/auth.js
export const TOKEN_KEY = "you_token"; // promijeni ako koristiš drugi ključ

export function getToken() {
  if (typeof window === "undefined") return null;
  // preferiraj sessionStorage (ako user NIJE odabrao "Remember me")
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  const t = getToken();
  if (!t) return null;
  return parseJwt(t); // očekujemo { role, countryId, ... }
}

export const API = process.env.NEXT_PUBLIC_BACKEND_URL;

// --- NOVO: dohvat zemalja + mapiranje id -> code (jednostavna cache) ---
let _countriesCache = null;
export async function fetchCountries() {
  if (_countriesCache) return _countriesCache;
  const res = await fetch(`${API}/countries`);
  const data = await res.json();
  _countriesCache = Array.isArray(data) ? data : [];
  return _countriesCache;
}

export async function countryCodeById(id) {
  const list = await fetchCountries();
  const item = list.find(c => String(c.id) === String(id));
  return item?.code || null;
}
