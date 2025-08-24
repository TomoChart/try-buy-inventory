import React, { useEffect, useState, Fragment } from "react";
import withAuth from "../../../../components/withAuth";
import { API, getToken } from "../../../../lib/auth";

function getVal(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return "";
}
function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("hr-HR");
}

function GalaxyTryHRPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`${API}/admin/galaxy-try/hr/list`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!r.ok) throw new Error("Greška pri dohvaćanju.");
        const data = await r.json();
        setRows(data || []);
      } catch (e) {
        setErr("Ne mogu dohvatiti prijave.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleExpand(id) {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    setDetail(null);
    try {
      const r = await fetch(`${API}/admin/galaxy-try/hr/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error();
      setDetail(await r.json());
    } catch {
      setDetail({ error: "Ne mogu dohvatiti detalje." });
    }
  }

  if (loading) return <div className="p-6">Učitavam…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Galaxy Try — HR</h1>
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Ime</th>
              <th className="text-left p-2">Prezime</th>
              <th className="text-left p-2">Pošta</th>
              <th className="text-left p-2">Grad preuzimanja</th>
              <th className="text-left p-2">Datum prijave</th>
              <th className="text-left p-2">Datum predaje uređaja</th>
              <th className="text-left p-2">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const id =
                getVal(r, ["submission_id", "SubmissionID", "ID", "id"]) || idx;

              const firstName = getVal(r, ["Ime", "first_name"]);
              const lastName = getVal(r, ["Prezime", "last_name"]);
              const post = getVal(r, ["Pošta", "postal_code", "post_code"]);
              const pickupCity = getVal(r, ["Grad preuzimanja", "pickup_city"]);
              const dateCreated = fmtDate(getVal(r, ["Datum prijave", "created_at"]));
              const dateHandover = fmtDate(getVal(r, ["Datum predaje", "date_handover"]));

              return (
                <Fragment key={id}>
                  <tr className="border-t hover:bg-gray-50">
                    <td className="p-2">{firstName}</td>
                    <td className="p-2">{lastName}</td>
                    <td className="p-2">{post}</td>
                    <td className="p-2">{pickupCity}</td>
                    <td className="p-2">{dateCreated}</td>
                    <td className="p-2">{dateHandover}</td>
                    <td className="p-2">
                      <button
                        className="px-2 py-1 rounded bg-blue-600 text-white"
                        onClick={() => toggleExpand(id)}
                      >
                        {expanded === id ? "Sakrij" : "Detalji"}
                      </button>
                    </td>
                  </tr>

                  {expanded === id && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="p-3">
                        {!detail && <div>Učitavam detalje…</div>}
                        {detail && detail.error && (
                          <div className="text-red-600">{detail.error}</div>
                        )}
                        {detail && !detail.error && (
                          <pre className="text-xs whitespace-pre-wrap">
                            {JSON.stringify(detail, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default withAuth(GalaxyTryHRPage, { roles: ["country_admin", "superadmin"] });
