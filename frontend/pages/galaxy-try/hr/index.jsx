import { useEffect, useState } from "react";
import withAuth from "../../../components/withAuth";
import { API, getToken } from "../../../lib/auth";
import CsvImportModal from "../../../components/CsvImportModal";
import { useRouter } from "next/router";

function GalaxyTryHRPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showImport, setShowImport] = useState(false);
  const router = useRouter();


  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`${API}/admin/galaxy-try/hr/list`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!r.ok) throw new Error();
      setRows(await r.json());
    } catch {
      setErr("Can't fetch applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.back()}
          className="px-3 py-2 border rounded hover:bg-gray-50"
        >
          ← Back
        </button>

        <h1 className="text-xl font-bold">Galaxy Try — HR</h1>

        <button
          className="px-3 py-2 bg-blue-600 text-white rounded"
          onClick={() => setShowImport(true)}
        >
          Import CSV
        </button>
      </div>

      {loading ? <div>Učitavam…</div> : err ? <div className="text-red-600">{err}</div> : (
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
            <th className="p-2 text-left">First Name</th>
<th className="p-2 text-left">Last Name</th>
<th className="p-2 text-left">Email</th>
<th className="p-2 text-left">Phone</th>
<th className="p-2 text-left">Pickup City</th>
<th className="p-2 text-left">Created At</th>
<th className="p-2 text-left">Contacted At</th>
<th className="p-2 text-left">Handover At</th>
    <th className="p-2 text-left">Model</th>
    <th className="p-2 text-left">Serial Number</th> 
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.submission_id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{r["First Name"]}</td>
<td className="p-2">{r["Last Name"]}</td>
<td className="p-2">{r["Email"]}</td>
<td className="p-2">{r["Phone"]}</td>
<td className="p-2">{r["Pickup City"]}</td>
<td className="p-2">{r["Created At"]}</td>
<td className="p-2">{r["Contacted At"]}</td>
<td className="p-2">{r["Handover At"]}</td>
      <td className="p-2">{r["Model"]}</td>
      <td className="p-2">{r["Serial Number"]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <CsvImportModal
          onClose={() => { setShowImport(false); load(); }}
          countryCode="HR"
          kind="leads"     // <-- za Galaxy Try
        />
      )}
    </div>
  );
}

export default withAuth(GalaxyTryHRPage, { roles: ["COUNTRY_ADMIN", "SUPERADMIN"] });
