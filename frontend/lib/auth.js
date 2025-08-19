// Helper za dohvat usera iz tokena (koristi se u više komponenti)
export function getCurrentUser() {
  const t = getToken();
  if (!t) return null;
  return parseJwt(t);
}
// lib/auth.js
export const TOKEN_KEY = "jwt";  // JEDAN ključ svugdje
export const API = process.env.NEXT_PUBLIC_API_URL || "https://api.try-buy-inv.net";

export function getToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function parseJwt(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("utf8"));
  } catch { return null; }
}

// cache za id->code
const _cache = new Map();
export async function countryCodeById(countryId, token) {
  if (!countryId) return null;
  if (_cache.size === 0) {
    const auth = token || getToken() || "";
    const res = await fetch(`${API}/admin/countries`, { headers: { Authorization: `Bearer ${auth}` } });
    if (res.ok) (await res.json()).forEach(c => _cache.set(String(c.id), c.code));
  }
  return _cache.get(String(countryId)) || null;
}
