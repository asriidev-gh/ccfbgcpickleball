import { CCF_ATTENDED_NOT_YET } from "@/lib/ccf-registration";

export const PICKLEBALL_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "low_intermediate", label: "Low intermediate" },
  { value: "high_intermediate", label: "High intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "pro", label: "Pro" },
] as const;

export type PickleballLevel = (typeof PICKLEBALL_LEVELS)[number]["value"];

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export type GenderOption = (typeof GENDER_OPTIONS)[number]["value"];

export const MAX_PLAYER_DISPLAY_NAME_LENGTH = 30;

/** Letters (including accented characters) and spaces only. */
export const PLAYER_DISPLAY_NAME_PATTERN = /^[\p{L}\p{M} ]+$/u;

export function playerDisplayNameTooLongMessage(
  length: number = MAX_PLAYER_DISPLAY_NAME_LENGTH,
) {
  return `Player name must be ${length} characters or less.`;
}

export function playerDisplayNameInvalidCharacterMessage() {
  return "Player name can only contain letters and spaces.";
}

export function sanitizePlayerDisplayNameInput(value: string) {
  return value.replace(/[^\p{L}\p{M} ]/gu, "");
}

export function isValidPlayerDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return PLAYER_DISPLAY_NAME_PATTERN.test(trimmed);
}

export function findFirstPlayerNameTooLongIndex(
  entries: readonly { name: string }[],
  maxLength: number = MAX_PLAYER_DISPLAY_NAME_LENGTH,
) {
  for (let index = 0; index < entries.length; index += 1) {
    const trimmed = entries[index]?.name.trim() ?? "";
    if (trimmed.length > maxLength) return index;
  }
  return null;
}

export function findFirstPlayerNameWithInvalidCharactersIndex(
  entries: readonly { name: string }[],
) {
  for (let index = 0; index < entries.length; index += 1) {
    const trimmed = entries[index]?.name.trim() ?? "";
    if (trimmed && !isValidPlayerDisplayName(trimmed)) return index;
  }
  return null;
}

export function assertPlayerDisplayNameLength(
  displayName: string,
  maxLength: number = MAX_PLAYER_DISPLAY_NAME_LENGTH,
) {
  if (displayName.trim().length > maxLength) {
    throw new Error(playerDisplayNameTooLongMessage(maxLength));
  }
}

export function assertPlayerDisplayNameCharacters(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) return;
  if (!isValidPlayerDisplayName(trimmed)) {
    throw new Error(playerDisplayNameInvalidCharacterMessage());
  }
}

export function assertPlayerDisplayName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error("Player name is required.");
  }
  assertPlayerDisplayNameCharacters(trimmed);
  assertPlayerDisplayNameLength(trimmed);
}

export function deriveCcfEventsBefore(attendedEvents: string[] | undefined | null) {
  if (!attendedEvents?.length) return null;
  if (attendedEvents.length === 1 && attendedEvents[0] === CCF_ATTENDED_NOT_YET) {
    return "not_yet" as const;
  }
  return "yes" as const;
}

export function isPlayerCcfNotYet(attendedEvents: string[] | undefined | null) {
  const status = deriveCcfEventsBefore(attendedEvents);
  return status === "not_yet" || status === null;
}

export function isPlayerCcfAttended(attendedEvents: string[] | undefined | null) {
  return deriveCcfEventsBefore(attendedEvents) === "yes";
}
