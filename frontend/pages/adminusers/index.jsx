import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { getToken, parseJwt } from "../../lib/auth";

function Guard({ children }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) { router.replace("/login"); return; }
    const u = parseJwt(t) || {};
    const role = String(u.role || "").toUpperCase();
    if (role === "SUPERADMIN" || role === "COUNTRY_ADMIN") {
      setOk(true);
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  if (!ok) return null;
  return children;
}

export default function AdminUsersPage() {
  return (
    <Guard>
      <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 16px" }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/dashboard" legacyBehavior>
            <a style={{ textDecoration: "none", border: "1px solid #ddd", padding: "6px 10px", borderRadius: 8 }}>
              ⬅ Home
            </a>
          </Link>
        </div>

        <h1 style={{ margin: "0 0 12px" }}>adminusers</h1>
        <p style={{ margin: "0 0 24px" }}>
          Ovdje će admini moći dodavati nove operatore i country admine.
          (U sljedećem koraku dodajemo **formu** i submit prema <code>POST /adminusers</code>.)
        </p>

        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 8, background: "#fafafa" }}>
          <strong>Status:</strong> Stranica postoji i zaštićena je ulogom.
        </div>
      </div>
    </Guard>
  );
}
