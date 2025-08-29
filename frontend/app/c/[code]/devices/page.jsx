// app/c/[code]/devices/page.jsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchDevicesList } from '@/lib/requests/devices';

export default function DevicesPage() {
  const { code } = useParams(); // HR, SI, RS
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErr('');
      try {
        const data = await fetchDevicesList(String(code).toUpperCase());
        if (!active) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [code]);

  const onBack = () => {
    router.push(`/c/${String(code).toUpperCase()}/dashboard`);
  };

  // U ovoj fazi držimo jednostavne i ujednačene eng nazive kolona.
  // Prilagodit ćemo kasnije nakon što vidimo točan shape podataka iz view-a.
  const columns = [
    { key: 'serial_number', title: 'Serial Number' },
    { key: 'model',         title: 'Model' },
    { key: 'status',        title: 'Status' },
    { key: 'location',      title: 'Location' },
    { key: 'ownership',         title: 'Ownership' },
    { key: 'updated_at',    title: 'Updated At' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Devices — {String(code).toUpperCase()}</h1>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200">
            Back
          </button>
          {/* CSV import & Edit modal dodajemo u idućem koraku */}
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div className="text-red-600">Error: {err}</div>}

      {!loading && !err && (
        <div className="overflow-auto rounded-2xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="text-left px-4 py-2 font-medium">{col.title}</th>
                ))}
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-t">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-2 whitespace-nowrap">
                      {formatCell(r[col.key], col.key)}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <button
                      onClick={() => router.push(`/c/${String(code).toUpperCase()}/devices/${encodeURIComponent(r.serial_number)}`)}
                      className="px-3 py-1 rounded-lg bg-black text-white hover:opacity-80"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="px-4 py-6" colSpan={columns.length + 1}>No data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatCell(val, key) {
  if (!val) return '';
  if (key === 'updated_at') {
    try {
      const d = new Date(val);
      return isNaN(d) ? String(val) : d.toLocaleString();
    } catch {
      return String(val);
    }
  }
  return String(val);
}
