import { useEffect, useState } from "react";
import withAuth from "../../../components/withAuth";
import { API, getToken } from "../../../lib/auth";

function UsersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", role: "operator", countryId: "", password: "" });
  const [filter, setFilter] = useState("all"); // all | operator

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`${API}/users`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setErr("Can't fetch users.");
    } finally {
      setLoading(false);
    }
  }

  function genPass() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%?";
    let out = "";
    for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, password: out }));
  }

  async function addUser(e) {
    e.preventDefault();
    if (!form.email || !form.password) { alert("Email i password su obavezni."); return; }
    try {
      setSubmitting(true);
      const body = {
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      };
      if (form.countryId) body.countryId = Number(form.countryId);

      const r = await fetch(`${API}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(data?.error || "Greška pri dodavanju korisnika.");
        return;
      }
      setRows(prev => [...prev, data]);
      setShowAdd(false);
      setForm({ email: "", role: "operator", countryId: "", password: "" });
    } catch (e) {
      console.error(e);
      alert("Network greška.");
    } finally {
      setSubmitting(false);
    }
  }

  const shown = rows.filter(u => filter === "operator" ? String(u.role).toLowerCase() === "operator" : true);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Users</h1>
        <div className="flex items-center gap-3">
          <select
            className="border rounded px-2 py-1"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            title="Filter"
          >
            <option value="all">All</option>
            <option value="operator">Operators only</option>
          </select>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-2 rounded bg-blue-600 text-white"
          >
            Add new
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div className="text-red-600">{err}</div>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Country</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">{u.id}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 capitalize">{String(u.role || "").toLowerCase()}</td>
                  <td className="p-3">{u.countryId ?? "-"}</td>
                </tr>
              ))}
              {!shown.length && (
                <tr><td className="p-3 italic text-gray-500" colSpan={4}>No users</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="p-4 border-b font-semibold">Add new user</div>
            <form onSubmit={addUser} className="p-4 space-y-3">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border rounded px-3 py-2"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Generate or enter"
                    required
                  />
                  <button type="button" onClick={genPass} className="px-3 py-2 rounded border">
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">Role</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="operator">operator</option>
                  <option value="country_admin">country_admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Country ID (optional)</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={form.countryId}
                  onChange={e => setForm(f => ({ ...f, countryId: e.target.value }))}
                  placeholder="npr. 1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(UsersPage);
