import { useEffect, useLayoutEffect, useState } from 'react';

export type AppearancePreference = 'light' | 'dark' | 'system';
export function readAppearance(): AppearancePreference {
  try {
    const saved = localStorage.getItem('study.theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch { /* A blocked storage area does not prevent appearance changes. */ }
  return 'system';
}

export function useAppearance() {
  const [preference, setPreference] = useState<AppearancePreference>(readAppearance);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(query.matches);
    query.addEventListener('change', changed);
    changed();
    return () => query.removeEventListener('change', changed);
  }, []);

  useLayoutEffect(() => {
    const scrollPosition = window.scrollY;
    document.documentElement.dataset.theme = theme;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollPosition, behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem('study.theme', preference); } catch { /* Optional persistence. */ }
  }, [preference]);

  return { preference, setPreference, theme };
}
