import { useCallback, useLayoutEffect, useRef, useState, useEffect } from 'react';

export type Page = 'today' | 'library' | 'review';
const currentPage = (): Page => {
  const page = location.hash.slice(1);
  return page === 'library' || page === 'review' ? page : 'today';
};

export function focusPage(page: Page) {
  document.getElementById(`${page}-title`)?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function useNavigation() {
  const [page, setPage] = useState<Page>(currentPage);
  const focusRequested = useRef(false);

  useEffect(() => {
    const changed = () => { focusRequested.current = true; setPage(currentPage()); };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);

  useLayoutEffect(() => {
    if (focusRequested.current) { focusRequested.current = false; focusPage(page); }
  }, [page]);

  const navigate = useCallback((next: Page) => {
    if (next === currentPage()) focusPage(next);
    else location.hash = next;
  }, []);
  return { page, navigate };
}
