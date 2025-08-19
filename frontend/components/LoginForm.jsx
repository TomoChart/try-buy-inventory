import React, { useState } from "react";
import { useRouter } from "next/router";
import { API, TOKEN_KEY, parseJwt, countryCodeById } from "../lib/auth";

// Use NEXT_PUBLIC_API_URL directly for API calls
const API = process.env.NEXT_PUBLIC_API_URL || "https://api.try-buy-inv.net";

// DEV reset password modal
function DevResetModal({ onClose }) {
	const [resetEmail, setResetEmail] = useState("");
	const [resetResult, setResetResult] = useState(null);
	const [loading, setLoading] = useState(false);

	async function handleResetRequest(e) {
		e.preventDefault();
		setResetResult(null);
		setLoading(true);
		try {
					   const res = await fetch(`${API}/auth/dev-reset-request`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: resetEmail })
			});
			const data = await res.json();
			setResetResult(data);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
			<div className="bg-white p-6 rounded shadow max-w-sm w-full relative">
				<button className="absolute top-2 right-2 text-gray-400" onClick={onClose}>&times;</button>
				<h3 className="text-lg font-bold mb-2">Reset lozinke (DEV)</h3>
				<form onSubmit={handleResetRequest}>
					<input
						type="email"
						className="w-full mb-2 p-2 border rounded"
						placeholder="Unesi email"
						value={resetEmail}
						onChange={e => setResetEmail(e.target.value)}
						required
					/>
					<button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 mb-2" disabled={loading}>
						{loading ? "Generiram..." : "Generiraj reset link"}
					</button>
				</form>
				{resetResult && (
					<div className="bg-gray-100 p-2 rounded text-xs break-all mt-2">
						<div className="mb-1">Reset link/token:</div>
						<div className="mb-2"><code>{resetResult.resetUrl || resetResult.error}</code></div>
						{resetResult.resetUrl && (
							<a href={resetResult.resetUrl} className="text-blue-600 underline" onClick={onClose}>
								Otvori stranicu za unos nove lozinke
							</a>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

export default function LoginForm() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(false);
	const [err, setErr] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [showReset, setShowReset] = useState(false);
	const router = useRouter();

	async function handleSubmit(e) {
		e.preventDefault();
		setErr("");
		setSubmitting(true);
		try {
			const res = await fetch(`${API}/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password })
			});
			const data = await res.json();
			console.log("Login response:", data); // <-- dodaj ovo
			if (!res.ok) {
				setErr(data?.error || `Login failed (${res.status})`);
				return;
			}
			if (!data?.token) throw new Error("No token");

			// Remember me: ako je uključen -> localStorage, inače sessionStorage
			if (rememberMe) {
				localStorage.setItem(TOKEN_KEY, data.token);
				sessionStorage.removeItem(TOKEN_KEY);
			} else {
				sessionStorage.setItem(TOKEN_KEY, data.token);
				localStorage.removeItem(TOKEN_KEY);
			}

			// Redirect po zemlji/ulogi
			const user = parseJwt(data.token);
			if (user?.countryId) {
				const code = await countryCodeById(user.countryId, data.token);
				if (code) return router.replace(`/c/${code.toLowerCase()}/dashboard`);
			}
			if ((user?.role || "").toUpperCase() === "SUPERADMIN") {
				return router.replace("/admin");
			}
			// fallback (ako nema countryId ni superadmin)
			return router.replace("/dashboard");
		} catch (e) {
			setErr("Greška u mreži ili serveru.");
		} finally {
			setSubmitting(false);
		}
  }

	return (
		<div className="max-w-sm mx-auto mt-10">
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="block mb-1">Email</label>
					<input
						type="email"
						value={email}
						onChange={e => setEmail(e.target.value)}
						className="w-full border rounded px-3 py-2"
						required
					/>
				</div>
				<div>
					<label className="block mb-1">Lozinka</label>
					<input
						type="password"
						value={password}
						onChange={e => setPassword(e.target.value)}
						className="w-full border rounded px-3 py-2"
						required
					/>
				</div>
				<div className="flex items-center">
					<input
						type="checkbox"
						checked={rememberMe}
						onChange={e => setRememberMe(e.target.checked)}
						id="rememberMe"
					/>
					<label htmlFor="rememberMe" className="ml-2">Zapamti me</label>
				</div>
				{err && <div className="text-red-600 text-sm">{err}</div>}
				<button
					type="submit"
					className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
					disabled={submitting}
				>
					{submitting ? "Prijava..." : "Prijavi se"}
				</button>
			</form>
			   <div className="mt-6 flex justify-center">
				   <button
					   className="text-sm text-white font-semibold hover:text-pink-200 transition-colors duration-150 underline underline-offset-4"
					   onClick={() => setShowReset(true)}
					   type="button"
				   >
					   Zaboravljena lozinka?
				   </button>
			   </div>
			   {showReset && <DevResetModal onClose={() => setShowReset(false)} />}
		</div>
	);
}
