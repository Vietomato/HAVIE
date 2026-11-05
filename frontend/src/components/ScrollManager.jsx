import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// BrowserRouter keeps the old scroll offset on navigation. Back/forward (POP) is left to the browser.
export default function ScrollManager() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash, navigationType]);

  return null;
}
