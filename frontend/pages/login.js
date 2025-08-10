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
    e.preventDefault()
    // ... poziv prema backendu, validacija, itd.
    // primjer nakon uspješnog logina:
    try {
      window.localStorage.setItem('you_token', 'dummy')
      router.replace('/dashboard')
    } catch {}
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
