import { useRouter } from "next/router";
import withAuth from "../../../lib/withAuth";

function CountryDashboard() {
  const router = useRouter();
  const { code } = router.query;
  return (
    <div className="p-8 text-center text-lg font-semibold">
      Dashboard — {code?.toUpperCase()}
    </div>
  );
}

export default withAuth(CountryDashboard);
  const [err, setErr] = useState("");

  // auth guard
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) router.replace("/login");
  }, [user, router]);

  // fetch KPI kad imamo code iz URL-a
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!code) return;
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`${API}/stats?code=${encodeURIComponent(String(code))}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setKpi(data?.kpi ?? null);
      } catch (e) {
        if (mounted) setErr("Ne mogu dohvatiti statistiku.");
      } finally {
        if (mounted) setLoading(false);
      }
// ...file replaced with minimal dashboard per new requirements

