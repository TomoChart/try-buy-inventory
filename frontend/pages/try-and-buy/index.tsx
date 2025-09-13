import { useRouter } from "next/router";
import { useEffect } from "react";
import { getToken, parseJwt, countryCodeById } from "../../lib/auth";

export default function TryBuyIndex() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let target = "hr";
      try {
        const t = getToken();
        const u = t ? parseJwt(t) : null;
        if (u?.countryId) {
          const code = await countryCodeById(u.countryId, t);
          if (code) target = String(code).toLowerCase();
        }
      } catch {}
      if (!cancelled) router.replace(`/try-and-buy/${target}`);
    })();
    return () => { cancelled = true; };
  }, [router]);
  return null;
}
