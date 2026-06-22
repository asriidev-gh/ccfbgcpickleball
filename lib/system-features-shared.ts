export const SYSTEM_SETTINGS_ID = "global";

export const SYSTEM_FEATURE_KEYS = {
  quickGame: "quickGame",
} as const;

export type SystemFeatureKey = keyof typeof SYSTEM_FEATURE_KEYS;

export type SystemFeaturesState = Record<SystemFeatureKey, boolean>;

export const DEFAULT_SYSTEM_FEATURES: SystemFeaturesState = {
  quickGame: true,
};

export type SystemFeatureDefinition = {
  key: SystemFeatureKey;
  label: string;
  description: string;
};

export const SYSTEM_FEATURE_DEFINITIONS: SystemFeatureDefinition[] = [
  {
    key: "quickGame",
    label: "Quick Game (live queueing off)",
    description:
      "Shows Quick Game in the Create menu for account holders. When off, only superadmins still see it.",
  },
];

export function normalizeSystemFeatures(
  raw: Partial<SystemFeaturesState> | null | undefined,
): SystemFeaturesState {
  return {
    quickGame: raw?.quickGame ?? DEFAULT_SYSTEM_FEATURES.quickGame,
  };
}

export function resolveEffectiveSystemFeatures(
  raw: SystemFeaturesState,
  isSuperAdmin: boolean,
): SystemFeaturesState {
  if (isSuperAdmin) {
    return { quickGame: true };
  }
  return raw;
}

export function isSystemFeatureEnabled(
  raw: SystemFeaturesState,
  key: SystemFeatureKey,
  isSuperAdmin: boolean,
): boolean {
  return resolveEffectiveSystemFeatures(raw, isSuperAdmin)[key];
}
