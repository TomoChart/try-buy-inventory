// Helper za dohvat usera iz tokena (koristi se u više komponenti)
export function getCurrentUser() {
  const t = getToken();
  if (!t) return null;
  return parseJwt(t);
}
// lib/auth.js
export const TOKEN_KEY = "jwt"; // jedan ključ svugdje
export const API =
  process.env.NEXT_PUBLIC_API_URL || "https://api.try-buy-inv.net";

export function getToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function parseJwt(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// ---- countries helper (traži Authorization; backend ruta je /admin/countries)
let _countriesCache = null;
export async function countryCodeById(countryId, token) {
  if (!countryId) return null;
  if (!_countriesCache) {
    const auth = token || getToken() || "";
    const res = await fetch(`${API}/countries`, {
      // header nije potreban, ali može ostati
      headers: { Authorization: `Bearer ${auth}` }
    });
    _countriesCache = res.ok ? await res.json() : [];
  }
  const item = _countriesCache.find(c => String(c.id) === String(countryId));
  return item?.code || null;
}
