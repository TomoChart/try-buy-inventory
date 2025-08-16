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
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fuchsia-700 to-indigo-500">
      <div className="bg-blue-600 rounded-2xl shadow-lg p-9 min-w-[340px]">
        <h1 className="text-white mb-6 text-center text-2xl font-bold">Login</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-lg border border-gray-300 p-2"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pr-9 rounded-lg border border-gray-300 p-2"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer p-0"
              aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
            >
              {showPassword ? (
                <svg width="22" height="22" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.09-2.73 2.99-4.98 5.38-6.36M6.06 6.06A9.97 9.97 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-4.06 5.94M1 1l22 22"/><circle cx="12" cy="12" r="3"/></svg>
              ) : (
                <svg width="22" height="22" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="7"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
          <button
            type="submit"
            className="bg-fuchsia-700 hover:bg-fuchsia-800 text-white rounded-lg p-3 font-semibold text-lg mt-2"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  )


  // dok ne “oživimo” na klijentu, prikaži minimalni UI ili ništa
  if (!ready) return null

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fuchsia-700 to-indigo-500">
      <div className="bg-blue-600 rounded-2xl shadow-lg p-9 min-w-[340px]">
        <h1 className="text-white mb-6 text-center text-2xl font-bold">Login</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-lg border border-gray-300 p-2"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pr-9 rounded-lg border border-gray-300 p-2"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer p-0"
              aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
            >
              {showPassword ? (
                <svg width="22" height="22" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.09-2.73 2.99-4.98 5.38-6.36M6.06 6.06A9.97 9.97 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-4.06 5.94M1 1l22 22"/><circle cx="12" cy="12" r="3"/></svg>
              ) : (
                <svg width="22" height="22" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="7"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
          <button
            type="submit"
            className="bg-fuchsia-700 hover:bg-fuchsia-800 text-white rounded-lg p-3 font-semibold text-lg mt-2"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  )
}
