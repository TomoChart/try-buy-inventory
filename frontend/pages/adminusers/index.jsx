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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("OPERATOR"); // OPERATOR | COUNTRY_ADMIN
  const [countryId, setCountryId] = useState(""); // broj ili prazan
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    setMsg(null);

    // osnovne provjere
    if (!email.trim() || !password.trim()) {
      setMsg({ type: "error", text: "Email i lozinka su obavezni." });
      return;
    }
    if (!["OPERATOR","COUNTRY_ADMIN"].includes(role)) {
      setMsg({ type: "error", text: "Uloga mora biti OPERATOR ili COUNTRY_ADMIN." });
      return;
    }
    // SUPERADMIN mora navesti countryId za non-superadmin korisnike (OPERATOR/COUNTRY_ADMIN).
    // COUNTRY_ADMIN ne treba slati (ignorirat će se na backendu i postavit će se njegova zemlja).
    const payload = { email: email.trim().toLowerCase(), password, role };
    if (countryId !== "") {
      const n = Number(countryId);
      if (Number.isFinite(n)) payload.countryId = n;
    }

    setSubmitting(true);
    try {
      const t = getToken();
      if (!t) { setMsg({ type: "error", text: "Nema tokena. Prijavi se ponovno." }); setSubmitting(false); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/adminusers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${t}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}

      if (!res.ok) {
        const errText = data?.error || text || `Greška (${res.status})`;
        setMsg({ type: "error", text: errText });
        setSubmitting(false);
        return;
      }

      // uspjeh
      setMsg({ type: "ok", text: `Korisnik kreiran: ${data?.user?.email || email}` });
      setEmail("");
      setPassword("");
      setRole("OPERATOR");
      setCountryId("");
    } catch (err) {
      console.error("POST /adminusers failed", err);
      setMsg({ type: "error", text: "Neuspješan zahtjev prema serveru." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Guard>
      <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 16px" }}>
        <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          <Link href="/dashboard" legacyBehavior>
            <a style={{ textDecoration: "none", border: "1px solid #ddd", padding: "6px 10px", borderRadius: 8 }}>⬅ Home</a>
          </Link>
        </div>

        <h1 style={{ margin: "0 0 12px" }}>adminusers</h1>
        <p style={{ margin: "0 0 24px" }}>
          Dodaj novog korisnika (operatora ili country admina).
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              placeholder="npr. ime.prezime@domena.hr"
              required
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Lozinka</span>
            <input
              type="password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="min. 8 znakova"
              required
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Uloga</span>
            <select
              value={role}
              onChange={e=>setRole(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
            >
              <option value="OPERATOR">OPERATOR</option>
              <option value="COUNTRY_ADMIN">COUNTRY_ADMIN</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>countryId (broj) — za SUPERADMIN-e obavezno za nove non-superadmin korisnike</span>
            <input
              type="number"
              value={countryId}
              onChange={e=>setCountryId(e.target.value)}
              placeholder="npr. 1"
              min="1"
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>

          <button type="submit" disabled={submitting}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", background: submitting ? "#f0f0f0" : "#fff" }}>
            {submitting ? "Spremam..." : "Dodaj korisnika"}
          </button>

          {msg && (
            <div
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 6,
                background: msg.type === "ok" ? "#e8f6ed" : "#fdecec",
                border: `1px solid ${msg.type === "ok" ? "#b7e2c5" : "#f3c2c2"}`,
              }}
            >
              {msg.text}
            </div>
          )}
        </form>
      </div>
    </Guard>
  );
}
