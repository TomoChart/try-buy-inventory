
import '../styles/globals.css';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const showNav = router.pathname !== '/login';
  return (
    <>
      {showNav && <NavBar />}
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
