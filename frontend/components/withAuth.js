import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function withAuth(Page) {
  return function Guarded(props) {
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useEffect(() => {
      const s = typeof window !== 'undefined' ? localStorage.getItem('session') : null;
      if (!s) router.replace('/login');
      else setReady(true);
    }, [router]);

    if (!ready) return null; // ili loader
    return <Page {...props} />;
  };
}
