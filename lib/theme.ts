export const THEME_STORAGE_KEY = "zlink-theme";

export type AppTheme = "light" | "dark";

export function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent("zlink-theme-change", { detail: theme }));
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" ? "dark" : "light";
}
