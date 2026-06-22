import { Schema, model, models } from "mongoose";

import {
  DEFAULT_SYSTEM_FEATURES,
  SYSTEM_SETTINGS_ID,
  type SystemFeaturesState,
} from "@/lib/system-features-shared";

const systemSettingsSchema = new Schema(
  {
    _id: { type: String, required: true, default: SYSTEM_SETTINGS_ID },
    features: {
      quickGame: { type: Boolean, default: DEFAULT_SYSTEM_FEATURES.quickGame },
    },
  },
  { timestamps: true, collection: "system_settings" },
);

if (models.SystemSettings) {
  delete models.SystemSettings;
}

export const SystemSettings = model("SystemSettings", systemSettingsSchema);

export type SystemSettingsDocument = {
  _id: string;
  features: SystemFeaturesState;
};
