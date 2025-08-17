import React, { useState } from "react";
import { useRouter } from "next/router";
import { API, TOKEN_KEY, parseJwt, countryCodeById } from "../lib/auth";

export default function LoginForm() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(false);
	const [err, setErr] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const router = useRouter();

	async function handleSubmit(e) {
		e.preventDefault();
		setErr("");
		setSubmitting(true);
		try {
			const res = await fetch(`${API}/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				mode: "cors",
				body: JSON.stringify({ email, password })
			});
			if (!res.ok) throw new Error(`Login failed (${res.status})`);
			const data = await res.json(); // { token }

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
				const code = await countryCodeById(user.countryId);
				if (code) return router.replace(`/c/${code.toLowerCase()}/dashboard`);
			}
			if (user?.role === "superadmin") {
				return router.replace("/select-country");
			}
			// fallback (ako nema countryId ni superadmin)
			return router.replace("/dashboard");
		} catch (e) {
			setErr("Pogrešan email ili lozinka.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto mt-10">
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
	);
}
