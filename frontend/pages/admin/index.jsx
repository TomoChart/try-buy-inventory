import { useEffect, useState } from "react";
import AdminPanel from "../../components/admin_panel";
import { getToken, parseJwt, API } from "../../lib/auth";

export default function AdminPage() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    // prvi pokušaj odmah
    let t = getToken();
    if (t) {
      setToken(t);
      const u = parseJwt(t);
      setRole(((u?.role) || "SUPERADMIN").toUpperCase());
      return;
    }
    // ako je login upravo napravio redirect, pričekaj par ms dok se storage ispuni
    const id = setInterval(() => {
      t = getToken();
      if (t) {
        clearInterval(id);
        setToken(t);
        const u = parseJwt(t);
        setRole(((u?.role) || "SUPERADMIN").toUpperCase());
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  if (!token || !role) return <p>Loading…</p>;

  return (
    <AdminPanel
      token={token}
      userRole={role}
      baseUrl={API}
    />
  );
}
