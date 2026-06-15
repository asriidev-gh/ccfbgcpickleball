export const REGISTRATION_FEATURE_DEFAULT = "default";
export const REGISTRATION_FEATURE_QR_ID = "qr_id";

/** Existing-player check-in via upload QR. CCF games may still collect questionnaire answers. */
export const QR_UPLOAD_REGISTRATION_SOURCE = "qr-upload";

export type RegistrationFeature =
  | typeof REGISTRATION_FEATURE_DEFAULT
  | typeof REGISTRATION_FEATURE_QR_ID;

export function normalizeRegistrationFeature(
  value: string | undefined | null,
): RegistrationFeature {
  return value === REGISTRATION_FEATURE_QR_ID
    ? REGISTRATION_FEATURE_QR_ID
    : REGISTRATION_FEATURE_DEFAULT;
}

export function isQrIdRegistrationEnabled(
  feature: string | undefined | null,
): boolean {
  return normalizeRegistrationFeature(feature) === REGISTRATION_FEATURE_QR_ID;
}
