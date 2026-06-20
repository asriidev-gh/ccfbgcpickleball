export type GameRegistrationMode = "self" | "owner";

export function getGameRegistrationTypeLabel(
  registrationMode?: GameRegistrationMode | string | null,
): "QR Register" | "Manual Register" {
  return registrationMode === "owner" ? "Manual Register" : "QR Register";
}
