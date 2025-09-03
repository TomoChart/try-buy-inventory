import React, { useEffect, useState, Fragment } from "react";
import withAuth from "../../../../components/withAuth";
import { API, getToken } from "../../../../lib/auth";

function DevicesHRPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`${API}/admin/devices/hr/list`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!r.ok) throw new Error("Greška pri dohvaćanju.");
        const data = await r.json();
        setRows(data || []);
      } catch (e) {
        setErr("Can't fetch devices. Call Tomo.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleExpand(serial) {
    if (expanded === serial) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(serial);
    setDetail(null);
    try {
      const r = await fetch(`${API}/admin/devices/hr/${encodeURIComponent(serial)}`, {
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
      <h1 className="text-xl font-bold mb-4">Devices — HR</h1>
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Model</th>
              <th className="text-left p-2">Ownership</th>
              <th className="text-left p-2">IMEI</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Location</th>
              <th className="text-left p-2">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <Fragment key={r.serial_number}>
                <tr className="border-t hover:bg-gray-50">
                  <td className="p-2">{r.Model}</td>
                  <td className="p-2">{r.Ownership}</td>
                  <td className="p-2">{r.IMEI}</td>
                  <td className="p-2">{r.Status}</td>
                  <td className="p-2">{r.Location}</td>
                  <td className="p-2">
                    <button
                      className="px-2 py-1 rounded bg-blue-600 text-white"
                      onClick={() => toggleExpand(r.serial_number)}
                    >
                      {expanded === r.serial_number ? "Sakrij" : "Detalji"}
                    </button>
                  </td>
                </tr>

                {expanded === r.serial_number && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="p-3">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ⚠ roles pišemo malim slovima; withAuth ih sam pretvara u UPPERCASE
export default withAuth(DevicesHRPage, { roles: ["country_admin", "superadmin"] });
