import { GENDER_OPTIONS } from "@/lib/player-profile-shared";
import {
  computePlayerAgeYears,
  formatGenderAgePillLabel,
} from "@/lib/player-age";
import { cn } from "@/lib/utils";

function resolveGenderPill(
  gender?: string | null,
  birthdate?: string | Date | null,
) {
  const value = gender?.trim();
  if (!value || value === "prefer_not_to_say") return null;

  const label = GENDER_OPTIONS.find((option) => option.value === value)?.label;
  if (!label) return null;

  if (value === "male" || value === "female") {
    const shortLabel = value === "male" ? "M" : "F";
    const ageYears = computePlayerAgeYears(birthdate);
    return {
      value,
      label,
      shortLabel: formatGenderAgePillLabel(shortLabel, ageYears),
      ageYears,
    };
  }

  return null;
}

export function PlayerGenderPill({
  gender,
  birthdate,
  className,
}: {
  gender?: string | null;
  birthdate?: string | Date | null;
  className?: string;
}) {
  const pill = resolveGenderPill(gender, birthdate);
  if (!pill) return null;

  const accessibleLabel =
    pill.ageYears != null && pill.ageYears > 0
      ? `${pill.label}, ${pill.ageYears} years old`
      : pill.label;

  return (
    <span
      className={cn(
        "player-gender-pill",
        pill.value === "male" ? "player-gender-pill--male" : "player-gender-pill--female",
        pill.ageYears != null && pill.ageYears > 0 && "player-gender-pill--with-age",
        className,
      )}
      title={accessibleLabel}
      aria-label={accessibleLabel}
    >
      {pill.shortLabel}
    </span>
  );
}
