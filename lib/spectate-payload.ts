import type { ClubBranding } from "@/lib/club-branding";
import type { GameLeaderboardRecapRow } from "@/lib/game-leaderboard-recap";
import type { LeaderboardGamesPlayedRow } from "@/lib/games-played-map";
import type { SessionInsight } from "@/lib/session-insights";
import type { CourtView } from "@/components/game/court-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { MatchHistoryView } from "@/components/game/match-history-list";

export type SpectateGameSummary = {
  title: string;
  openPlayType: string;
  courtCount: number;
  gameId: string;
  status: "draft" | "active" | "ended";
  openPlayDate?: string | null;
  openPlayTimeRange?: string | null;
};

export type SpectateLivePayload = {
  game: SpectateGameSummary;
  queue: QueueEntryView[];
  checkedOut: QueueEntryView[];
  courts: CourtView[];
  spectatorCount?: number;
  firstTimerCount?: number;
  birthdayThisMonthCount?: number;
  clubBranding?: ClubBranding | null;
};

export type SpectateDetailsPayload = {
  leaderboard: LeaderboardGamesPlayedRow[];
  matches: MatchHistoryView[];
  recap?: {
    rows: GameLeaderboardRecapRow[];
    insights: SessionInsight[];
  };
};

export type SpectateFullPayload = SpectateLivePayload &
  SpectateDetailsPayload & {
    matches: MatchHistoryView[];
  };

export function mergeSpectatorGamePayload(
  live: SpectateLivePayload,
  details?: SpectateDetailsPayload | null,
): SpectateFullPayload {
  return {
    ...live,
    leaderboard: details?.leaderboard ?? [],
    matches: details?.matches ?? [],
    recap: details?.recap,
  };
}
