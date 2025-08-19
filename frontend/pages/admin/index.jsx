import { useEffect, useState } from "react";
import AdminPanel from "../../components/admin_panel";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [role, setRole] = useState("SUPERADMIN");

  useEffect(() => {
    // prilagodi svojem auth-u:
    setToken(localStorage.getItem("jwt") || "");
    setRole(localStorage.getItem("role") || "SUPERADMIN");
  }, []);

  if (!token) return <p>Prijavi se pa otvori /admin…</p>;

  return (
    <AdminPanel
      token={token}
      userRole={role}
      baseUrl={process.env.NEXT_PUBLIC_API_URL || "https://api.try-buy-inv.net"}
    />
  );
}
