import { useEffect, useState } from "react";
import withAuth from "../../../components/withAuth";
import { API, getToken } from "../../../lib/auth";
import CsvImportModal from "../../../components/CsvImportModal";

function GalaxyTryHRPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showImport, setShowImport] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`${API}/admin/galaxy-try/hr/list`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!r.ok) throw new Error();
      setRows(await r.json());
    } catch {
      setErr("Ne mogu dohvatiti prijave.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Galaxy Try — HR</h1>
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => setShowImport(true)}>
          Import CSV
        </button>
      </div>

      {loading ? <div>Učitavam…</div> : err ? <div className="text-red-600">{err}</div> : (
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Ime</th>
                <th className="p-2 text-left">Prezime</th>
                <th className="p-2 text-left">E-mail</th>
                <th className="p-2 text-left">Telefon</th>
                <th className="p-2 text-left">Grad</th>
                <th className="p-2 text-left">Datum prijave</th>
                 <th className="p-2 text-left">Kontaktiran</th>
    <th className="p-2 text-left">Predaja uređaja</th>
    <th className="p-2 text-left">Model</th>
    <th className="p-2 text-left">Serial Number</th> 
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.submission_id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{r["Ime"]}</td>
                  <td className="p-2">{r["Prezime"]}</td>
                  <td className="p-2">{r["E-mail"]}</td>
                  <td className="p-2">{r["Telefon"]}</td>
                  <td className="p-2">{r["Grad"]}</td>
                  <td className="p-2">{r["Datum prijave"]}</td>
                   <td className="p-2">{r["Kontaktiran"]}</td>
      <td className="p-2">{r["Predaja uređaja"]}</td>
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
