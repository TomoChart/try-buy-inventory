// frontend/pages/index.js
import { useEffect } from "react";
import { useRouter } from "next/router";
import { getToken } from "../lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    // Jedinstveni cilj: nakon logina /dashboard (bez /c/{code}/dashboard)
    router.replace("/dashboard");
  }, [router]);

  return null; // čisti redirect bez flickera
}
