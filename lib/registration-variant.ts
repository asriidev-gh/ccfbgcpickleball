export const USER_TYPE_DEFAULT = "default";
export const USER_TYPE_CCF = "ccf";

export type RegistrationFormVariant = "generic" | "ccf";

/**
 * Registration UI for a game follows the game owner's `userType`:
 * - `default` → generic form (Player only, basic fields)
 * - `ccf` → full CCF questionnaires (Player + Volunteer, ministry questions)
 */
export function getRegistrationFormVariant(
  userType: string | undefined | null,
): RegistrationFormVariant {
  const normalized = userType?.trim().toLowerCase();
  if (normalized === USER_TYPE_DEFAULT) return "generic";
  if (normalized === USER_TYPE_CCF) return "ccf";
  // Legacy owners created before userType existed — keep CCF form.
  return "ccf";
}

export function isRegistrationPhotoRequired(formVariant: RegistrationFormVariant): boolean {
  return formVariant === "ccf";
}
