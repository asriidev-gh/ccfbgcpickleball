"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "ccf-theme";
export const DEFAULT_THEME = "neon";

export type AppTheme =
  | "neon"
  | "emerald"
  | "sunset"
  | "fintech"
  | "material"
  | "cupertino"
  | "cosmos"
  | "session"
  | "makati"
  | "smarthome"
  | "travel";

export const APP_THEMES: { value: AppTheme; label: string }[] = [
  { value: "makati", label: "Dark Blue Theme" },
  { value: "session", label: "Session Dark" },
  { value: "neon", label: "Neon Arena" },
  { value: "cosmos", label: "Cosmos Dark" },
  { value: "emerald", label: "Emerald Court" },
  { value: "sunset", label: "Sunset Heat" },
  { value: "fintech", label: "Fintech Pro" },
  { value: "material", label: "Material UI" },
  { value: "cupertino", label: "Apple iOS" },
  { value: "smarthome", label: "Smart Home" },
  { value: "travel", label: "Travel" },
];

export function applyTheme(theme: AppTheme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function getAppTheme(): AppTheme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const fromDom = document.documentElement.getAttribute("data-theme") as AppTheme | null;
  if (fromDom && APP_THEMES.some((option) => option.value === fromDom)) {
    return fromDom;
  }
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
  return saved && APP_THEMES.some((option) => option.value === saved) ? saved : DEFAULT_THEME;
}

export function useAppTheme(): AppTheme {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(getAppTheme());
    const observer = new MutationObserver(() => {
      setTheme(getAppTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export function ThemeManager() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
    const theme = saved ?? DEFAULT_THEME;
    applyTheme(theme);
  }, []);

  return null;
}
