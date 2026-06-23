import type { QuickPlayGameMode } from "@/lib/quick-play-wizard-shared";

export const SINGLES_PLAYERS_PER_COURT = 2;
export const SINGLES_PLAYERS_PER_TEAM = 1;
export const SINGLES_MIN_QUEUE_TO_FILL = 2;
export const SINGLES_MIN_EXPECTED_PLAYERS = 2;

export function isSinglesGameMode(gameMode?: QuickPlayGameMode | null) {
  return gameMode === "singles";
}
