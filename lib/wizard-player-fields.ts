import type { GenderOption } from "@/lib/player-profile-shared";

export const WIZARD_PLAYER_FIELD_CLASS =
  "border-border bg-background dark:border-input dark:bg-input/30";

const WIZARD_PLAYER_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const satisfies ReadonlyArray<{ value: GenderOption; label: string }>;

export function wizardGenderLabel(gender: "male" | "female" | "") {
  return WIZARD_PLAYER_GENDER_OPTIONS.find((option) => option.value === gender)?.label;
}
