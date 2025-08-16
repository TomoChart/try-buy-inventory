import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    // provjera tokena – isti key koji koristi login
    const t = typeof window !== "undefined" ? localStorage.getItem("you_token") : null;
    if (!t) router.replace("/login");
  }, [router]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Dashboard</h1>
      <p>Login je uspio ✅ (token je u localStorage).</p>
      <button
        onClick={() => {
          localStorage.removeItem("you_token");
          router.replace("/login");
        }}
        style={{ marginTop: 16 }}
      >
        Log out
      </button>
    </main>
  );
}
