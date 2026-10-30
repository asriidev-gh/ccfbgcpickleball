export const SYSTEM_SETTINGS_ID = "global";

export const SYSTEM_FEATURE_KEYS = {
  quickGame: "quickGame",
  passkeyLogin: "passkeyLogin",
} as const;

export type SystemFeatureKey = keyof typeof SYSTEM_FEATURE_KEYS;

export type SystemFeaturesState = Record<SystemFeatureKey, boolean>;

export const DEFAULT_SYSTEM_FEATURES: SystemFeaturesState = {
  quickGame: true,
  passkeyLogin: false,
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
  {
    key: "passkeyLogin",
    label: "Face ID / passkey login",
    description:
      "Lets users sign in with Face ID, fingerprint or Windows Hello, and shows the setup option in the account menu. When off, only superadmins can set up passkeys.",
  },
];

export function normalizeSystemFeatures(
  raw: Partial<SystemFeaturesState> | null | undefined,
): SystemFeaturesState {
  return {
    quickGame: raw?.quickGame ?? DEFAULT_SYSTEM_FEATURES.quickGame,
    passkeyLogin: raw?.passkeyLogin ?? DEFAULT_SYSTEM_FEATURES.passkeyLogin,
  };
}

export function resolveEffectiveSystemFeatures(
  raw: SystemFeaturesState,
  isSuperAdmin: boolean,
): SystemFeaturesState {
  if (isSuperAdmin) {
    return { quickGame: true, passkeyLogin: true };
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
