import withAuth from "../components/withAuth";
import { useEffect, useState } from "react";

function Dashboard() {
  const [api, setApi] = useState("…");

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL;
    const token = localStorage.getItem("you_token");
    fetch(`${base}/devices?country=HR`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(j => setApi(JSON.stringify(j)))
      .catch(() => setApi("API unreachable"));
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard – logged in ✅</h1>
      <p>Backend ping: {api}</p>
      <button
        onClick={() => {
          localStorage.removeItem("you_token");
          window.location.href = "/login";
        }}
      >
        Sign out
      </button>
    </main>
  );
}
export default withAuth(Dashboard);
