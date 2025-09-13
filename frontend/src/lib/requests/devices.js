// src/lib/requests/devices.js
// Pretpostavka: imaš getToken() već negdje u lib-u (npr. src/lib/auth/getToken.js)
// Ako je na drugom putu, samo prilagodi import ispod.
import { getToken } from '../../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

export async function fetchDevicesList(code) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/devices/${String(code).toUpperCase()}/list`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || `Devices list failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchDeviceDetail(code, serial) {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/admin/devices/${String(code).toUpperCase()}/${encodeURIComponent(serial)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || `Device detail failed: ${res.status}`);
  }
  return res.json();
}
