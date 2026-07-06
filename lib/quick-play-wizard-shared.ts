import type { OpenPlayType } from "@/lib/open-play-types";
import { PLAYER_OPEN_PLAY_LEVELS, type PlayerOpenPlayLevel } from "@/lib/open-play-types";
import type { GenderOption } from "@/lib/player-profile-shared";
import { isCcfUserType } from "@/lib/registration-variant";

export const QUICK_PLAY_TOTAL_STEPS = 3;

export const QUICK_PLAY_STEP_HEADINGS = [
  "Courts & Game Format",
  "Add players",
  "Start play",
] as const;

export const QUICK_PLAY_WIZARD_STEPS = [
  { number: 1, label: "Set courts & format" },
  { number: 2, label: "Add players" },
  { number: 3, label: "Start play" },
] as const;

export type QuickPlayGameMode = "doubles" | "singles";
export type QuickPlayMatchingType = "auto-balanced" | "winner-loser-groups" | "mixed-doubles";

export const QUICK_PLAY_GAME_MODE_OPTIONS: Array<{
  value: QuickPlayGameMode;
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    value: "doubles",
    label: "Doubles",
    description: "Four players per court — two per team.",
  },
  {
    value: "singles",
    label: "Singles",
    description: "One player per side.",
  },
];

export type QuickPlayMatchingTypeOption = {
  value: QuickPlayMatchingType;
  label: string;
  description: string;
  disabled?: boolean;
};

export const QUICK_PLAY_MATCHING_TYPE_OPTIONS: QuickPlayMatchingTypeOption[] = [
  {
    value: "auto-balanced",
    label: "Auto-balanced",
    description:
      "Two players from the last game ended play together with the last two players on the queue.",
  },
  {
    value: "winner-loser-groups",
    label: "Winner / Loser rotation",
    description:
      "Play through the main queue in order. The next four on deck can include bracket players when the main line runs short. Complete bracket foursomes (not already on deck) move to the end of the main line.",
  },
  {
    value: "mixed-doubles",
    label: "Mixed doubles",
    description:
      "Each court has two men and two women. Register an even number of players with equal men and women.",
  },
];

const CCF_HIDDEN_DOUBLES_MATCHING_TYPES: ReadonlyArray<QuickPlayMatchingType> = [
  "winner-loser-groups",
  "mixed-doubles",
];

export function getQuickPlayMatchingTypeOptions(
  userType?: string | null,
): QuickPlayMatchingTypeOption[] {
  if (!isCcfUserType(userType)) return QUICK_PLAY_MATCHING_TYPE_OPTIONS;
  return QUICK_PLAY_MATCHING_TYPE_OPTIONS.filter(
    (option) => !CCF_HIDDEN_DOUBLES_MATCHING_TYPES.includes(option.value),
  );
}

/** Matching options shown when game mode is singles. */
export const QUICK_PLAY_SINGLES_MATCHING_TYPE_OPTIONS: QuickPlayMatchingTypeOption[] = [
  {
    value: "auto-balanced",
    label: "Queue order",
    description:
      "Players return to the end of the queue after each game. The next two waiting players play.",
  },
  {
    value: "winner-loser-groups",
    label: "Winner / Loser rotation",
    description:
      "Keep queue order first (1, 2, 3…). Winners and losers wait at the end until a pair forms, then join the main line.",
  },
];

export function getQuickPlaySinglesMatchingTypeOptions(
  userType?: string | null,
): QuickPlayMatchingTypeOption[] {
  if (!isCcfUserType(userType)) return QUICK_PLAY_SINGLES_MATCHING_TYPE_OPTIONS;
  return QUICK_PLAY_SINGLES_MATCHING_TYPE_OPTIONS.filter(
    (option) => option.value !== "winner-loser-groups",
  );
}

export function resolveMatchingTypeForUserType(
  matchingType: QuickPlayMatchingType,
  userType?: string | null,
): QuickPlayMatchingType {
  if (!isCcfUserType(userType)) return matchingType;
  if (matchingType === "winner-loser-groups" || matchingType === "mixed-doubles") {
    return "auto-balanced";
  }
  return matchingType;
}

export type QuickPlayWizardPlayerEntry = {
  name: string;
  gender: "male" | "female" | "";
  openPlayLevel: PlayerOpenPlayLevel;
};

export type QuickPlayWizardFormFields = {
  title: string;
  openPlayType: string;
  courtCount: number;
  expectedPlayers: number;
  gameMode: QuickPlayGameMode;
  matchingType: QuickPlayMatchingType;
};

export const DEFAULT_PLAYER_OPEN_PLAY_LEVEL: PlayerOpenPlayLevel = "Beginner";
export const MIN_EXPECTED_PLAYERS = 4;
export const MAX_QUICK_PLAY_PLAYERS = 40;
export const MAX_QUICK_PLAY_COURTS = 20;

export function getMinExpectedPlayersForGameMode(gameMode: QuickPlayGameMode) {
  return gameMode === "singles" ? 2 : MIN_EXPECTED_PLAYERS;
}

export const WIZARD_PLAYER_LEVEL_OPTIONS = PLAYER_OPEN_PLAY_LEVELS.map((level) => ({
  value: level,
  label: level,
})) satisfies ReadonlyArray<{ value: PlayerOpenPlayLevel; label: string }>;

export const WIZARD_PLAYER_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const satisfies ReadonlyArray<{ value: GenderOption; label: string }>;

export function quickPlayPlayerNumberWord(index: number) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ] as const;
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ] as const;

  if (index < 1 || index > MAX_QUICK_PLAY_PLAYERS) return "";
  if (index < 10) return ones[index];
  if (index < 20) return teens[index - 10];
  if (index === 20) return "Twenty";
  if (index < 30) return `Twenty ${ones[index - 20]}`;
  if (index === 30) return "Thirty";
  if (index < 40) return `Thirty ${ones[index - 30]}`;
  return "Forty";
}

export function defaultQuickPlayPlayerName(index: number) {
  const word = quickPlayPlayerNumberWord(index);
  return word ? `Player ${word}` : "";
}

export function createQuickPlayWizardPlayerEntry(
  index: number,
  openPlayLevel: PlayerOpenPlayLevel = DEFAULT_PLAYER_OPEN_PLAY_LEVEL,
): QuickPlayWizardPlayerEntry {
  return {
    name: defaultQuickPlayPlayerName(index),
    gender: "male",
    openPlayLevel,
  };
}

export function syncQuickPlayWizardPlayerEntryCount(
  entries: QuickPlayWizardPlayerEntry[],
  targetCount: number,
  openPlayLevel: PlayerOpenPlayLevel,
): QuickPlayWizardPlayerEntry[] {
  const count = Math.min(MAX_QUICK_PLAY_PLAYERS, Math.max(1, targetCount));
  if (entries.length === count) return entries;
  if (entries.length > count) return entries.slice(0, count);
  return [
    ...entries,
    ...Array.from({ length: count - entries.length }, (_, index) =>
      createQuickPlayWizardPlayerEntry(entries.length + index + 1, openPlayLevel),
    ),
  ];
}

export function resolvePlayerOpenPlayLevel(level?: PlayerOpenPlayLevel) {
  return level ?? DEFAULT_PLAYER_OPEN_PLAY_LEVEL;
}

export function normalizeQuickPlayPlayerNameKey(name: string) {
  return name.trim().toLowerCase();
}

export function findLastDuplicateQuickPlayPlayerNameIndex(entries: QuickPlayWizardPlayerEntry[]) {
  const seen = new Set<string>();
  let lastDuplicateIndex: number | null = null;

  for (let index = 0; index < entries.length; index += 1) {
    const key = normalizeQuickPlayPlayerNameKey(entries[index]?.name ?? "");
    if (!key) continue;
    if (seen.has(key)) lastDuplicateIndex = index;
    else seen.add(key);
  }

  return lastDuplicateIndex;
}

export function findFirstMissingQuickPlayPlayerGenderIndex(entries: QuickPlayWizardPlayerEntry[]) {
  for (let index = 0; index < entries.length; index += 1) {
    const name = entries[index]?.name.trim() ?? "";
    const gender = entries[index]?.gender ?? "";
    if (name && gender !== "male" && gender !== "female") return index;
  }
  return null;
}

export function isMixedDoublesMatching(matchingType?: QuickPlayMatchingType | null) {
  return matchingType === "mixed-doubles";
}

export function getMixedDoublesPlayersValidationError(
  players: ReadonlyArray<{ gender: "male" | "female" }>,
): string | null {
  if (players.length === 0) return null;

  if (players.length % 2 !== 0) {
    return "Mixed doubles requires an even number of players.";
  }

  let maleCount = 0;
  let femaleCount = 0;
  for (const player of players) {
    if (player.gender === "male") maleCount += 1;
    else femaleCount += 1;
  }

  if (maleCount !== femaleCount) {
    return "Mixed doubles requires the same number of men and women (50% each).";
  }

  return null;
}

export function quickPlayPlayerRowGridCols(showLevel: boolean, showRemove: boolean) {
  if (showLevel && showRemove) {
    return "grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.95fr)_2.75rem]";
  }
  if (showLevel) {
    return "grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.95fr)]";
  }
  if (showRemove) {
    return "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem]";
  }
  return "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";
}

export function getQuickPlayGameModeLabel(mode: QuickPlayGameMode) {
  return QUICK_PLAY_GAME_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

export function getQuickPlayMatchingTypeLabel(type: QuickPlayMatchingType) {
  return QUICK_PLAY_MATCHING_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function getQuickPlayMatchingTypeDescription(type: QuickPlayMatchingType) {
  return QUICK_PLAY_MATCHING_TYPE_OPTIONS.find((option) => option.value === type)?.description ?? "";
}

export const SINGLES_QUEUE_MATCHING_LABEL = QUICK_PLAY_SINGLES_MATCHING_TYPE_OPTIONS[0].label;

export const SINGLES_QUEUE_MATCHING_DESCRIPTION =
  QUICK_PLAY_SINGLES_MATCHING_TYPE_OPTIONS[0].description;

export function getSinglesMatchingTypeLabel(type: QuickPlayMatchingType) {
  return (
    QUICK_PLAY_SINGLES_MATCHING_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
  );
}

export function getSinglesMatchingTypeDescription(type: QuickPlayMatchingType) {
  return (
    QUICK_PLAY_SINGLES_MATCHING_TYPE_OPTIONS.find((option) => option.value === type)
      ?.description ?? ""
  );
}

export function getQuickPlayQueueMatchingLabel(
  gameMode: QuickPlayGameMode,
  matchingType: QuickPlayMatchingType,
) {
  if (gameMode === "singles") return getSinglesMatchingTypeLabel(matchingType);
  return getQuickPlayMatchingTypeLabel(matchingType);
}

export function getQuickPlayQueueMatchingDescription(
  gameMode: QuickPlayGameMode,
  matchingType: QuickPlayMatchingType,
) {
  if (gameMode === "singles") return getSinglesMatchingTypeDescription(matchingType);
  return getQuickPlayMatchingTypeDescription(matchingType);
}

export function playerPreviewInitial(displayName: string) {
  const trimmed = displayName.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}
