// frontend/pages/login.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function Login() {
  const router = useRouter()
  const [ready, setReady] = useState(false)   // signal da smo u browseru
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
    window.location.href = "/dashboard";
  } catch (err) {
    alert("Login failed");
  }
}


  // dok ne “oživimo” na klijentu, prikaži minimalni UI ili ništa
  if (!ready) return null

  return (
    <main style={{ padding: 24 }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />
        <button type="submit">Sign in</button>
      </form>
    </main>
  )
}
