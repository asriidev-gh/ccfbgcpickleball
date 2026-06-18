import type { GenderOption, PickleballLevel } from "@/lib/player-profile-shared";

export type QrUploadProfileField = "gender" | "birthdate" | "pickleballLevel";

export type QrUploadProfileSnapshot = {
  gender?: string | null;
  birthdate?: Date | string | null;
  pickleballLevel?: string | null;
};

export function listMissingQrUploadProfileFields(
  player: QrUploadProfileSnapshot,
): QrUploadProfileField[] {
  const missing: QrUploadProfileField[] = [];
  if (!player.gender?.trim()) missing.push("gender");
  if (!player.birthdate) missing.push("birthdate");
  if (!player.pickleballLevel?.trim()) missing.push("pickleballLevel");
  return missing;
}

export function needsQrUploadProfileCompletion(player: QrUploadProfileSnapshot) {
  return listMissingQrUploadProfileFields(player).length > 0;
}

export function formatQrUploadBirthdate(value: Date | string | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export type QrUploadProfileFormValues = {
  gender: GenderOption | "";
  birthdate: string;
  pickleballLevel: PickleballLevel | "";
};

export function isQrUploadProfileFormComplete(values: QrUploadProfileFormValues) {
  return Boolean(values.gender && values.birthdate && values.pickleballLevel);
}
