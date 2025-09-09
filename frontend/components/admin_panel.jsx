import React, { useEffect, useMemo, useState } from "react";

/**
 * AdminPanel – drop‑in page for your dev branch.
 *
 * Props:
 *  - token: string (JWT from /auth/login)
 *  - baseUrl?: string (default https://api.try-buy-inv.net)
 *  - userRole?: 'SUPERADMIN' | 'COUNTRY_ADMIN' | 'OPERATOR' (controls UI)
 *
 * Endpoints used (must exist on backend):
 *  GET  /admin/countries
 *  GET  /admin/users?country=HR
 *  POST /admin/users  { email, password, role, countryCode? }
 *  PATCH /admin/users/:id/password  { newPassword }
 *  PATCH /admin/users/:id/role      { role }  (SUPERADMIN only)
 *  GET  /admin/devices?country=HR&model=Galaxy%20Trifold%207
 *  GET  /admin/loans?country=HR&model=Galaxy%20Trifold%207
 */

export default function AdminPanel({
  token,
  baseUrl = "https://api.try-buy-inv.net",
  userRole = "SUPERADMIN",
}) {
  const [selectedCountry, setSelectedCountry] = useState(""); // "HR" | "SI" | "RS" | ""

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900 p-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Admin Panel</h1>
          <p className="text-sm text-neutral-500">Users (devices/loans)</p>
        </div>
        <div className="flex items-center gap-3">
          <CountrySelect
            token={token}
            baseUrl={baseUrl}
            userRole={userRole}
            value={selectedCountry}
            onChange={setSelectedCountry}
          />
        </div>
      </header>

      <main className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-semibold mb-4">Korisnici</h2>
          <UsersTable
            token={token}
            baseUrl={baseUrl}
            userRole={userRole}
            selectedCountry={selectedCountry}
          />
        </section>

          </main>
    </div>
  );
}

/** COUNTRY SELECT (visible to SUPERADMIN only) */
function CountrySelect({ token, baseUrl, userRole, value, onChange }) {
  const [countries, setCountries] = useState([]);
  const isSuper = userRole === "SUPERADMIN";

  useEffect(() => {
    if (!isSuper) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/admin/countries`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch countries");
        const data = await res.json();
        if (!cancelled) setCountries(data);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuper, baseUrl, token]);

  if (!isSuper) return (
    <span className="inline-flex items-center gap-2 text-sm px-3 py-2 bg-neutral-100 rounded-xl">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
      Country: <strong>moja (admin) zemlja</strong>
    </span>
  );

  return (
    <label className="text-sm flex items-center gap-2">
      <span className="font-medium">Country:</span>
      <select
        className="px-3 py-2 rounded-xl border border-neutral-300 bg-white shadow-sm focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {countries.map((c) => (
          <option key={c.id} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>
    </label>
  );
}

/** USERS TABLE */
function UsersTable({ token, baseUrl, userRole, selectedCountry }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState(
    userRole === "SUPERADMIN" ? "COUNTRY_ADMIN" : "OPERATOR"
  );

  const [pwResetId, setPwResetId] = useState("");
  const [pwResetValue, setPwResetValue] = useState("");

  const canChangeRole = userRole === "SUPERADMIN";

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedCountry) p.set("country", selectedCountry);
    const q = p.toString();
    return q ? `?${q}` : "";
  }, [selectedCountry]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${baseUrl}/admin/users${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Load users failed: ${res.status}`);
      setRows(await res.json());
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, baseUrl, token]);

  async function onCreateUser(e) {
    e.preventDefault();
    setErr("");
    try {
      const body = {
        email: newEmail.trim().toLowerCase(),
        password: newPass,
        role: (newRole || "OPERATOR").toUpperCase(),
      };
      // SUPERADMIN: ako je odabrao dropdown, šaljemo countryCode
      if (userRole === "SUPERADMIN" && selectedCountry) {
        body.countryCode = selectedCountry;
      }
      const res = await fetch(`${baseUrl}/admin/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Create failed: ${res.status} ${t}`);
      }
      setNewEmail("");
      setNewPass("");
      await load();
      alert("User created ✅");
    } catch (e) {
      alert(String(e.message || e));
    }
  }

  async function onResetPassword(id) {
    try {
      const res = await fetch(`${baseUrl}/admin/users/${id}/password`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword: pwResetValue }),
      });
      if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
      setPwResetId("");
      setPwResetValue("");
      alert("Password updated ✅");
    } catch (e) {
      alert(String(e.message || e));
    }
  }

  async function onChangeRole(id, role) {
    try {
      const res = await fetch(`${baseUrl}/admin/users/${id}/role`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(`Role change failed: ${res.status}`);
      await load();
    } catch (e) {
      alert(String(e.message || e));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onCreateUser} className="grid md:grid-cols-5 gap-3 items-end bg-neutral-50 p-3 rounded-xl">
        <div className="md:col-span-2">
          <label className="text-xs font-medium">Email</label>
          <input
            required
            type="email"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@domain.com"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Password</label>
          <input
            required
            type="password"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="StrongPass!1"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Role</label>
          <select
            className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          >
            {userRole === "SUPERADMIN" ? (
              <>
                <option>COUNTRY_ADMIN</option>
                <option>OPERATOR</option>
              </>
            ) : (
              <option>OPERATOR</option>
            )}
          </select>
        </div>
        <div>
          <button
            type="submit"
            className="w-full mt-5 md:mt-0 px-4 py-2 rounded-lg bg-black text-white hover:bg-neutral-800"
          >
            + Add user
          </button>
        </div>
      </form>

      <div className="overflow-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>CountryId</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <Td>{u.email}</Td>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    {u.role}
                    {canChangeRole && (
                      <select
                        className="ml-2 px-2 py-1 rounded border border-neutral-300"
                        value={u.role}
                        onChange={(e) => onChangeRole(u.id, e.target.value)}
                      >
                        <option value="SUPERADMIN">SUPERADMIN</option>
                        <option value="COUNTRY_ADMIN">COUNTRY_ADMIN</option>
                        <option value="OPERATOR">OPERATOR</option>
                      </select>
                    )}
                  </span>
                </Td>
                <Td>{u.countryId ?? "—"}</Td>
                <Td>
                  {pwResetId === u.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="New password"
                        className="px-2 py-1 rounded border border-neutral-300"
                        value={pwResetValue}
                        onChange={(e) => setPwResetValue(e.target.value)}
                      />
                      <button
                        className="px-3 py-1 rounded bg-black text-white"
                        onClick={() => onResetPassword(u.id)}
                        type="button"
                      >Save</button>
                      <button
                        className="px-3 py-1 rounded border"
                        onClick={() => { setPwResetId(""); setPwResetValue(""); }}
                        type="button"
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      className="px-3 py-1 rounded border"
                      onClick={() => setPwResetId(u.id)}
                      type="button"
                    >Reset password</button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}

/** DEVICES + LOANS */
function DevicesTable({ token, baseUrl, selectedCountry }) {
  const [model, setModel] = useState("Galaxy Trifold 7");
  const [status, setStatus] = useState("");
  const [devices, setDevices] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const qsDevices = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedCountry) p.set("country", selectedCountry);
    if (model) p.set("model", model);
    if (status) p.set("status", status);
    const q = p.toString();
    return q ? `?${q}` : "";
  }, [selectedCountry, model, status]);

  async function loadDevices() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${baseUrl}/admin/devices${qsDevices}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Load devices failed: ${res.status}`);
      setDevices(await res.json());
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadLoansForModel() {
    setLoading(true);
    setErr("");
    try {
      const p = new URLSearchParams();
      if (selectedCountry) p.set("country", selectedCountry);
      if (model) p.set("model", model);
      const res = await fetch(`${baseUrl}/admin/loans?${p.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Load loans failed: ${res.status}`);
      setLoans(await res.json());
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qsDevices, baseUrl, token]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-medium">Model</label>
          <input
            className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="npr. Galaxy Trifold 7"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Status</label>
          <select
            className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Svi</option>
            <option>APPLIED</option>
            <option>CONTACTED</option>
            <option>ISSUED</option>
            <option>ON_LOAN</option>
            <option>RETURNED</option>
            <option>CLOSED</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={loadDevices}
            className="w-full px-4 py-2 rounded-lg bg-black text-white hover:bg-neutral-800"
          >
            Refresh devices
          </button>
          <button
            onClick={loadLoansForModel}
            className="w-full px-4 py-2 rounded-lg border"
          >
            View loans for model
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <Th>Model</Th>
              <Th>Serial</Th>
              <Th>IMEI</Th>
              <Th>Status</Th>
              <Th>Country</Th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-t">
                <Td>{d.model}</Td>
                <Td>{d.serial || "—"}</Td>
                <Td>{d.imei || "—"}</Td>
                <Td>{d.status}</Td>
                <Td>{d.country || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loans.length > 0 && (
        <div className="rounded-xl border border-neutral-200 p-3">
          <h3 className="font-semibold mb-2">Loans for model: {model}</h3>
          <ul className="space-y-1 text-sm">
            {loans.map((l) => (
              <li key={l.id} className="flex items-center justify-between border-b py-1">
                <span>
                  <span className="font-medium">User:</span> {l.user?.email || "—"}
                  {"  "}
                  <span className="ml-3 font-medium">Device:</span> {l.device?.model} ({l.device?.serial || l.device?.imei || "—"})
                </span>
                <span className="text-neutral-500">
                  issued: {l.issuedAt ? new Date(l.issuedAt).toLocaleDateString() : "—"}
                  {"  /  "}
                  returned: {l.returnedAt ? new Date(l.returnedAt).toLocaleDateString() : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}

/** tiny table helpers */
function Th({ children }) {
  return (
    <th className="text-left font-semibold text-neutral-700 px-3 py-2 whitespace-nowrap">
      {children}
    </th>
  );
}
function Td({ children }) {
  return <td className="px-3 py-2 align-top whitespace-nowrap">{children}</td>;
}
