// frontend/pages/c/[code]/dashboard.jsx
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import withAuth from "../../../components/withAuth";
// Ako treba API poziv, odkomentiraj sljedeću liniju
// import { API, getToken } from "../../../lib/auth";

function CountryDashboard() {
  const { query } = useRouter();
  const code = String(query.code || "").toUpperCase();

  // Minimalan prikaz (možeš kasnije dodati KPI pozive)
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-2">Dashboard — {code || "…"}</h1>
      <p className="text-gray-600">Dobrodošao na {code || "…"} overview.</p>
      <div className="mt-4">
        <button
          onClick={() => window.location.assign(`/devices?country=${code}`)}
          className="px-3 py-2 rounded bg-black text-white hover:opacity-90"
        >
          Open Devices
        </button>
      </div>
    </div>
  );
}

export default withAuth(CountryDashboard, { roles: ["COUNTRYADMIN", "SUPERADMIN"] });

