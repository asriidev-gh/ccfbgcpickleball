export type CourtsViewCourtTheme =
  | "classic"
  | "tournament"
  | "clay"
  | "indoor"
  | "neon";

export const COURTS_VIEW_COURT_THEME_STORAGE_KEY = "ccf-courts-view-court-theme";

export type CourtsViewCourtThemeOption = {
  id: CourtsViewCourtTheme;
  label: string;
  /** Service, kitchen, service preview colors. */
  swatch: [string, string, string];
};

export const COURTS_VIEW_COURT_THEME_OPTIONS: CourtsViewCourtThemeOption[] = [
  {
    id: "classic",
    label: "Classic",
    swatch: ["#003060", "#0088b5", "#003060"],
  },
  {
    id: "tournament",
    label: "Tournament",
    swatch: ["#1a5c2e", "#3d9b55", "#1a5c2e"],
  },
  {
    id: "clay",
    label: "Clay",
    swatch: ["#8b3a2a", "#c45c3e", "#8b3a2a"],
  },
  {
    id: "indoor",
    label: "Indoor",
    swatch: ["#3d4f63", "#6b7f96", "#3d4f63"],
  },
  {
    id: "neon",
    label: "Neon",
    swatch: ["#1e1035", "#00d4ff", "#1e1035"],
  },
];

const VALID_THEMES = new Set<CourtsViewCourtTheme>(
  COURTS_VIEW_COURT_THEME_OPTIONS.map((option) => option.id),
);

export function defaultCourtsViewCourtTheme(): CourtsViewCourtTheme {
  return "classic";
}

export function loadCourtsViewCourtTheme(): CourtsViewCourtTheme {
  if (typeof window === "undefined") return defaultCourtsViewCourtTheme();

  const stored = localStorage.getItem(COURTS_VIEW_COURT_THEME_STORAGE_KEY);
  if (stored && VALID_THEMES.has(stored as CourtsViewCourtTheme)) {
    return stored as CourtsViewCourtTheme;
  }
  return defaultCourtsViewCourtTheme();
}

export function saveCourtsViewCourtTheme(theme: CourtsViewCourtTheme) {
  localStorage.setItem(COURTS_VIEW_COURT_THEME_STORAGE_KEY, theme);
}

export function getCourtsViewCourtThemeLabel(theme: CourtsViewCourtTheme) {
  return (
    COURTS_VIEW_COURT_THEME_OPTIONS.find((option) => option.id === theme)?.label ??
    "Classic"
  );
}
