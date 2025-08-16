import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { API, getCurrentUser } from "../lib/auth";

export default function CountrySwitcher() {
  const router = useRouter();
  const user = getCurrentUser();
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/countries`);
        const data = await res.json();
        setCountries(Array.isArray(data) ? data : []);
      } catch {}
    })();
  }, []);

  const codeFromId = useMemo(() => {
    const map = new Map(countries.map((c) => [c.id, c.code]));
    return map.get(user?.countryId) ?? null;
  }, [countries, user]);

  // country_admin: samo badge sa svojom zemljom
  if (user && user.role !== "superadmin") {
    return (
      <span className="inline-flex items-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
        {codeFromId ? codeFromId : "No country"}
      </span>
    );
  }

  // superadmin: može birati
  return (
    <select
      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
      defaultValue=""
      onChange={(e) => {
        const code = e.target.value;
        if (code) router.push(`/c/${code.toLowerCase()}/dashboard`);
      }}
    >
      <option value="" disabled>
        Choose country…
      </option>
      {countries.map((c) => (
        <option key={c.id} value={c.code}>
          {c.code}
        </option>
      ))}
    </select>
  );
}