import { useEffect, useState } from "react";
import withAuth from "../../../components/withAuth";
import { API, getToken } from "../../../lib/auth";

function GalaxyTrySI() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const r = await fetch(`${API}/admin/galaxy-try/si/list`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (alive) setRows(data);
      } catch {
        if (alive) setErr("Ne mogu dohvatiti prijave.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="p-6">Učitavam…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="p-6">
      <button onClick={() => history.back()} className="mb-4 px-3 py-1 rounded border">← Back</button>
      <h1 className="text-xl font-bold mb-4">Galaxy Try — SI</h1>
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Ime</th>
              <th className="p-2 text-left">Prezime</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Grad</th>
              <th className="p-2 text-left">Datum prijave</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={r.submission_id || i} className="border-t">
                <td className="p-2">{r.first_name || r.FirstName || r["Ime"] || "-"}</td>
                <td className="p-2">{r.last_name  || r.LastName  || r["Priimek"] || r["Prezime"] || "-"}</td>
                <td className="p-2">{r.email      || r["E-mail"] || "-"}</td>
                <td className="p-2">{r.city       || r.City      || r["Mesto"] || r["Grad"] || "-"}</td>
                <td className="p-2">{r.created_at || r["Datum prijave"] || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default withAuth(GalaxyTrySI, { roles: ["COUNTRYADMIN","SUPERADMIN"] });
