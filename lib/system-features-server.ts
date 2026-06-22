import {
  DEFAULT_SYSTEM_FEATURES,
  normalizeSystemFeatures,
  SYSTEM_SETTINGS_ID,
  type SystemFeatureKey,
  type SystemFeaturesState,
} from "@/lib/system-features-shared";
import { SystemSettings } from "@/models/SystemSettings";

export async function getRawSystemFeatures(): Promise<SystemFeaturesState> {
  const doc = await SystemSettings.findById(SYSTEM_SETTINGS_ID).lean();
  return normalizeSystemFeatures(doc?.features);
}

export async function updateSystemFeature(
  key: SystemFeatureKey,
  enabled: boolean,
): Promise<SystemFeaturesState> {
  const doc = await SystemSettings.findByIdAndUpdate(
    SYSTEM_SETTINGS_ID,
    { $set: { [`features.${key}`]: enabled } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  return normalizeSystemFeatures(doc?.features);
}

export async function ensureSystemSettingsDefaults() {
  await SystemSettings.updateOne(
    { _id: SYSTEM_SETTINGS_ID },
    {
      $setOnInsert: {
        _id: SYSTEM_SETTINGS_ID,
        features: DEFAULT_SYSTEM_FEATURES,
      },
    },
    { upsert: true },
  );
}
