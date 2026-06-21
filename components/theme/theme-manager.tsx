"use client";

import { useEffect } from "react";

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

export function ThemeManager() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
    const theme = saved ?? DEFAULT_THEME;
    applyTheme(theme);
  }, []);

  return null;
}
