// frontend/components/CsvImportModal.jsx
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { API, getToken } from "../lib/auth";

const DEVICE_FIELDS = [
  "model","purpose","ownership","serial_number","imei","control_no","color",
  "status","name","leadid","location","city",
  "date_assigned","expected_return","date_last_change","comment",
  "submission_id","leadname","cityfromlead"
];

const LEAD_FIELDS = [
  "submission_id","created_at","first_name","last_name","email","phone",
  "address","city","postal_code","pickup_city","contacted",
  "handover_at","days_left","model","imei","note","form_name"
];

// heuristika za automatsko mapiranje
const ALIASES = {
  // devices
  "s/n": "serial_number", "sn": "serial_number", "serial": "serial_number",
  "imei": "imei", "imei1": "imei", "imei_1": "imei", "imei 1": "imei",
  "control": "control_no", "control no": "control_no", "control_number": "control_no",
  "colour": "color",
  // leads
  "e-mail": "email", "e pošta": "email", "e_posta": "email", "e posta": "email",
  "zip": "postal_code",
  "created at": "created_at",
  "handover at": "handover_at",
  "date handover": "handover_at", "date_handover": "handover_at",
  "date contacted": "contacted", "date_contacted": "contacted",
  "contacted at": "contacted",
  "days left": "days_left", "daysleft": "days_left",
};

function guessMap(headers, kind) {
  const target = kind === "devices" ? DEVICE_FIELDS : LEAD_FIELDS;
  const map = {};
  headers.forEach(h => {
    const raw = String(h || "").trim();
    const key = raw.toLowerCase();
    const alias = ALIASES[key];
    if (alias && target.includes(alias)) {
      map[raw] = alias;
      return;
    }
    // direct hit?
    if (target.includes(key)) {
      map[raw] = key;
      return;
    }
    // special cases
    if (key === "s/n" || key === "s\\n") map[raw] = "serial_number";
    else if (key === "imei1") map[raw] = "imei";
  });
  return map;
}

export default function CsvImportModal({ onClose, countryCode = "HR", kind = "devices" }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({});
  const [mode, setMode] = useState("upsert");
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState(null);

  function handleFile(f) {
    setFile(f);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setRows(data);
        const hdrs = res.meta?.fields || Object.keys(data[0] || {});
        setHeaders(hdrs);
        setMap(guessMap(hdrs, kind));
      }
    });
  }

  const targetFields = kind === "devices" ? DEVICE_FIELDS : LEAD_FIELDS;

  function buildPayload() {
    // premapiraj
    const out = rows.map(r => {
      const o = {};
      for (const [src, dst] of Object.entries(map)) {
        if (!dst) continue;
        o[dst] = r[src] ?? null;
      }
      return o;
    });
    return out;
  }

  async function submit() {
    try {
      setPosting(true); setResult(null);
      const token = getToken();
      const body = { rows: buildPayload() };
      const url = kind === "devices"
        ? `${API}/admin/devices/${countryCode}/import?mode=${mode}`
        : `${API}/admin/galaxy-try/${countryCode}/import?mode=${mode}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Import failed");
      setResult({ ok: true, ...data });
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow p-5 w-[720px] max-w-[98vw]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">CSV import — {kind === "devices" ? "Uređaji" : "Galaxy Try"} ({countryCode})</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">&times;</button>
        </div>

        <div className="mb-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="mt-2 flex items-center gap-3 text-sm">
            <label className="font-medium">Mode:</label>
            <select value={mode} onChange={e => setMode(e.target.value)} className="border rounded px-2 py-1">
              <option value="upsert">Upsert (preporučeno)</option>
              <option value="replace">Replace (oprezno)</option>
            </select>
          </div>
        </div>

        {headers.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2">Mapiranje stupaca</div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-auto border rounded p-2">
              {headers.map(h => (
                <div key={h} className="flex items-center gap-2">
                  <div className="w-1/2 truncate text-xs bg-gray-100 rounded px-2 py-1">{h}</div>
                  <select
                    className="w-1/2 text-xs border rounded px-2 py-1"
                    value={map[h] || ""}
                    onChange={e => setMap(m => ({ ...m, [h]: e.target.value || undefined }))}
                  >
                    <option value="">(ignoriraj)</option>
                    {targetFields.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Savjet: obavezno mapiraj ključna polja — za uređaje <b>serial_number</b>, za prijave <b>submission_id</b>.
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-600">
            {rows.length ? <>Učitano redaka: <b>{rows.length}</b></> : "Nema učitanih redaka."}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 border rounded">Odustani</button>
            <button
              disabled={!rows.length || posting}
              onClick={submit}
              className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {posting ? "Učitavam..." : "Pošalji import"}
            </button>
          </div>
        </div>

        {result && (
          <div className={`mt-3 text-sm ${result.ok ? "text-green-700" : "text-red-700"}`}>
            {result.ok ? `OK — mode=${result.mode}, upserted=${result.upserted}` : `Greška: ${result.error}`}
          </div>
        )}
      </div>
    </div>
  );
}
