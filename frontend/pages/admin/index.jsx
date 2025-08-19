import { useEffect, useState } from "react";
import AdminPanel from "../../components/admin_panel";
import { getToken, parseJwt, API } from "../../lib/auth";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [role, setRole] = useState("SUPERADMIN");

  useEffect(() => {
    const t = getToken();                    // ✅ čita iz sessionStorage ili localStorage
    setToken(t || "");
    const u = t ? parseJwt(t) : null;        // ✅ role iz tokena
    setRole(((u?.role) || "SUPERADMIN").toUpperCase());
  }, []);

  if (!token) return <p>Prijavi se pa otvori /admin…</p>;

  return (
    <AdminPanel
      token={token}
      userRole={role}
      baseUrl={API}
    />
  );
}
