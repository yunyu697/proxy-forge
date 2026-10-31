/** 深色模式：class 策略，持久化到 localStorage */
export type Theme = 'light' | 'dark';

const KEY = 'pf-theme';

export function initTheme(): Theme {
  const saved = (localStorage.getItem(KEY) as Theme | null) || null;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const theme: Theme = saved || (prefersDark ? 'dark' : 'light');
  apply(theme);
  return theme;
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(KEY, theme);
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  apply(next);
  return next;
}
