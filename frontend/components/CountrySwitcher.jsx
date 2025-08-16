import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { API, getCurrentUser } from "../lib/auth";

export default function CountrySwitcher() {
  const router = useRouter();
  const user = getCurrentUser();
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ako nisi superadmin, ne prikazuj switcher (vrati samo badge)
  if (typeof window !== "undefined" && user && user.role !== "superadmin") {
    return (
      <span style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8 }}>
        {user.countryId ? `Country #${user.countryId}` : "No country"}
      </span>
    );
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`${API}/countries`);
        const data = await res.json();
        if (mounted) setCountries(data || []);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, []);

  if (loading) return <span>Loading countries…</span>;

  return (
    <select
      onChange={(e) => {
        const code = e.target.value;
        if (code) router.push(`/c/${code.toLowerCase()}/dashboard`);
      }}
      defaultValue=""
      style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
    >
      <option value="" disabled>Choose country…</option>
        {countries.map((c) => (
          <option key={c.id} value={c.code}>{c.code}</option>
        ))}
            </select>
        );
      }