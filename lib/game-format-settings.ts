import type { QuickPlayGameMode, QuickPlayMatchingType } from "@/lib/quick-play-wizard-shared";
import { getMinExpectedPlayersForGameMode } from "@/lib/quick-play-wizard-shared";

export const DEFAULT_GAME_MODE: QuickPlayGameMode = "doubles";
export const DEFAULT_MATCHING_TYPE: QuickPlayMatchingType = "auto-balanced";

export type GameFormatSettings = {
  gameMode: QuickPlayGameMode;
  matchingType: QuickPlayMatchingType;
};

export function resolveGameMode(value?: string | null): QuickPlayGameMode {
  return value === "singles" ? "singles" : "doubles";
}

export function resolveMatchingType(value?: string | null): QuickPlayMatchingType {
  if (value === "winner-loser-groups" || value === "mixed-doubles") {
    return value;
  }
  return DEFAULT_MATCHING_TYPE;
}

export function resolveGameFormatSettings(input?: {
  gameMode?: string | null;
  matchingType?: string | null;
}): GameFormatSettings {
  return {
    gameMode: resolveGameMode(input?.gameMode),
    matchingType: resolveMatchingType(input?.matchingType),
  };
}

export function minPlayersForGameFormat(gameMode?: QuickPlayGameMode | null) {
  return getMinExpectedPlayersForGameMode(gameMode ?? DEFAULT_GAME_MODE);
}

export function playersPerCourtForGameMode(gameMode?: QuickPlayGameMode | null) {
  return gameMode === "singles" ? 2 : 4;
}
