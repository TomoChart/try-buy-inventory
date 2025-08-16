// lib/auth.js
export const TOKEN_KEY = "you_token"; // promijeni ako koristiš drugi ključ

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
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
