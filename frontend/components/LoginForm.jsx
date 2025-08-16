import { useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import styles from "../styles/login.module.css";
import { API, TOKEN_KEY } from "../lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

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
      const data = await res.json(); // očekujemo { token }
      if (!data?.token) throw new Error("No token");
      // spremi token (ostajemo na localStorage radi konzistentnosti)
      localStorage.setItem(TOKEN_KEY, data.token);
      // redirect: neka postojeća logika obavi svoje (ili po želji ovdje)
      router.replace("/dashboard"); // ako koristiš /c/{code}/dashboard, već imaš post-login redirect
    } catch (e) {
      setErr("Pogrešan email ili lozinka.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${styles.frame} relative`}>
      {/* Vibrating light border */}
      <div className={`absolute inset-0 ${styles.pointerNone}`}>
        {/* Top */}
        <div className="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 opacity-60 animate-pulse" />
        <div className="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-pink-400 to-blue-400 opacity-40 animate-[shimmer_2s_ease-in-out_infinite]" />
        {/* Bottom */}
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 via-blue-400 to-pink-400 opacity-60 animate-pulse" />
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-pink-400 via-cyan-400 to-purple-400 opacity-40 animate-[shimmer_2s_ease-in-out_infinite_reverse]" />
        {/* Left */}
        <div className="absolute -left-1 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 via-blue-400 to-purple-400 opacity-60 animate-pulse" />
        <div className="absolute -left-1 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 via-pink-400 to-cyan-400 opacity-40 animate-[shimmer_2s_ease-in-out_infinite]" />
        {/* Right */}
        <div className="absolute -right-1 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-400 via-purple-400 to-blue-400 opacity-60 animate-pulse" />
        <div className="absolute -right-1 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 via-cyan-400 to-pink-400 opacity-40 animate-[shimmer_2s_ease-in-out_infinite_reverse]" />
        {/* Corners */}
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-blue-400 rounded-full opacity-80 animate-[glow_1.5s_ease-in-out_infinite]" />
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-400 rounded-full opacity-80 animate-[glow_1.5s_ease-in-out_infinite_0.5s]" />
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-cyan-400 rounded-full opacity-80 animate-[glow_1.5s_ease-in-out_infinite_1s]" />
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-pink-400 rounded-full opacity-80 animate-[glow_1.5s_ease-in-out_infinite_1.5s]" />
      </div>

      {/* Circling lights */}
      <div className={`absolute inset-0 ${styles.pointerNone}`}>
        <div className="absolute top-0 left-1/2 w-2 h-2 bg-blue-400 rounded-full opacity-60 animate-[spin_8s_linear_infinite] origin-[0_200px]" />
        <div className="absolute top-0 left-1/2 w-1.5 h-1.5 bg-purple-400 rounded-full opacity-70 animate-[spin_6s_linear_infinite_reverse] origin-[0_180px]" />
        <div className="absolute top-0 left-1/2 w-1 h-1 bg-cyan-400 rounded-full opacity-80 animate-[spin_10s_linear_infinite] origin-[0_220px]" />
        <div className="absolute top-0 left-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full opacity-60 animate-[spin_7s_linear_infinite_reverse] origin-[0_160px]" />
      </div>

      <Card className="w-full max-w-md mx-auto backdrop-blur-sm bg-card/95 border-white/20 shadow-2xl relative z-10">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {err && <div className="text-sm text-red-600">{err}</div>}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-input-background/50 border-white/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-input-background/50 border-white/20"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} />
                <Label htmlFor="remember" className="text-sm">Remember me</Label>
              </div>
              {/* maknuto: Forgot password */}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
