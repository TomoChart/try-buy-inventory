// components/AppLayout.jsx
import Link from "next/link";
import { useRouter } from "next/router";
import CountrySwitcher from "./CountrySwitcher";
import { getCurrentUser } from "../lib/auth";

const linkStyle = { display: "block", padding: "10px 14px", borderRadius: 8, textDecoration: "none", color: "#111" };
const activeStyle = { background: "#eef4ff", fontWeight: 600 };

export default function AppLayout({ children }) {
  const router = useRouter();
  const user = getCurrentUser();

  // Minimal auth guard
  if (typeof window !== "undefined" && !user) {
    if (router.pathname !== "/login") router.replace("/login");
  }

  const path = router.asPath;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "#f7f7fb" }}>
      {/* Sidebar */}
      <aside style={{ background: "#fff", borderRight: "1px solid #eee", padding: 16 }}>
        <h3 style={{ margin: "8px 0 16px 4px" }}>Try-Buy Inventory</h3>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#888", margin: "12px 4px" }}>Nodovi</div>
          <Link href="/c/hr/dashboard" style={{ ...linkStyle, ...(path.includes("/c/") && path.endsWith("/dashboard") ? activeStyle : {}) }}>
            Dashboard
          </Link>
          <Link href="/galaxy-try" style={{ ...linkStyle, ...(path.startsWith("/galaxy-try") ? activeStyle : {}) }}>
            Galaxy Try (Fold7)
          </Link>
          <Link href="/try-and-buy" style={{ ...linkStyle, ...(path.startsWith("/try-and-buy") ? activeStyle : {}) }}>
            Try_and_Buy
          </Link>
          <Link href="/devices" style={{ ...linkStyle, ...(path.startsWith("/devices") ? activeStyle : {}) }}>
            Uređaji
          </Link>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, color: "#888", margin: "12px 4px" }}>BTL</div>
          <Link href="/btl" style={{ ...linkStyle, ...(path.startsWith("/btl") ? activeStyle : {}) }}>
            BTL evidencija
          </Link>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, color: "#888", margin: "12px 4px" }}>Admin</div>
          <Link href="/admin/users" style={{ ...linkStyle, ...(path.startsWith("/admin/users") ? activeStyle : {}) }}>
            Korisnici
          </Link>
          <Link href="/settings" style={{ ...linkStyle, ...(path.startsWith("/settings") ? activeStyle : {}) }}>
            Postavke
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main>
        {/* Topbar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600 }}>Try-Buy</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <CountrySwitcher />
            <button
              onClick={() => { localStorage.removeItem("you_token"); window.location.href = "/login"; }}
              style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, background: "#fafafa" }}
            >
              Logout
            </button>
          </div>
        </div>

        <div style={{ padding: 20 }}>{children}</div>
      </main>
    </div>
  );
}
