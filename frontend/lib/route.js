// lib/route.js
import { useRouter } from "next/router";

export function useActiveCountryCode() {
  const router = useRouter();
  const as = router?.asPath || "";
  const m = as.match(/^\/c\/([a-z]{2})(\/|$)/i);
  return m ? m[1].toLowerCase() : null;
}
