// frontend/pages/login.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function Login() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // označi da smo na klijentu (browser), tek tada smijemo dirati localStorage
  useEffect(() => { setReady(true) }, [])

  // ako želiš auto-redirect kad je već prijavljen
  useEffect(() => {
    if (!ready) return
    try {
      const token = window.localStorage.getItem('you_token')
      if (token) router.replace('/dashboard')
    } catch {}
  }, [ready, router])

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL;
      const r = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!r.ok) throw new Error("Bad credentials");
      const data = await r.json();
      window.localStorage.setItem("you_token", data.token);
      // --- REDIRECT LOGIKA ---
      const jwt = JSON.parse(atob(data.token.split('.')[1]));
      if (jwt.countryId) {
        // Dohvati code za countryId
        const cres = await fetch(`${base}/countries`);
        const countries = await cres.json();
        const country = countries.find(c => c.id === jwt.countryId);
        if (country && country.code) {
          router.replace(`/c/${country.code.toLowerCase()}/dashboard`);
        } else {
          router.replace('/dashboard'); // fallback
        }
      } else if (jwt.role === 'superadmin' && !jwt.countryId) {
        router.replace('/select-country');
      } else {
        router.replace('/dashboard');
      }
      // --- END REDIRECT LOGIKA ---
    } catch (err) {
      alert("Login failed");
    }
  }


  // dok ne “oživimo” na klijentu, prikaži minimalni UI ili ništa
  if (!ready) return null

  return (
    <main style={{ padding: 24 }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="Password"
            style={{ width: '100%', paddingRight: 36 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            tabIndex={-1}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0
            }}
            aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
          >
            {showPassword ? (
              <svg width="22" height="22" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.09-2.73 2.99-4.98 5.38-6.36M6.06 6.06A9.97 9.97 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-4.06 5.94M1 1l22 22"/><circle cx="12" cy="12" r="3"/></svg>
            ) : (
              <svg width="22" height="22" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="7"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
        <button type="submit">Sign in</button>
      </form>
    </main>
  )
}
