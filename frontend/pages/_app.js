
import '../styles/globals.css';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';
import { Toaster } from 'react-hot-toast';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const showNav = router.pathname !== '/login';
  return (
    <>
      {showNav && <NavBar />}
      <Component {...pageProps} />
      <Toaster position="top-right" />
    </>
  );
}

export default MyApp;
