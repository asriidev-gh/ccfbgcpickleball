import { GENDER_OPTIONS } from "@/lib/player-profile-shared";
import { cn } from "@/lib/utils";

function resolveGenderPill(gender?: string | null) {
  const value = gender?.trim();
  if (!value || value === "prefer_not_to_say") return null;

  const label = GENDER_OPTIONS.find((option) => option.value === value)?.label;
  if (!label) return null;

  if (value === "male" || value === "female") {
    return {
      value,
      label,
      shortLabel: value === "male" ? "M" : "F",
    };
  }

  return null;
}

export function PlayerGenderPill({
  gender,
  className,
}: {
  gender?: string | null;
  className?: string;
}) {
  const pill = resolveGenderPill(gender);
  if (!pill) return null;

  return (
    <span
      className={cn(
        "player-gender-pill",
        pill.value === "male" ? "player-gender-pill--male" : "player-gender-pill--female",
        className,
      )}
      title={pill.label}
      aria-label={pill.label}
    >
      {pill.shortLabel}
    </span>
  );
}
