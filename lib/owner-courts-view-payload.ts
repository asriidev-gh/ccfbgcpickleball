import type { CourtView } from "@/components/game/court-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { LeaderboardGamesPlayedRow } from "@/lib/games-played-map";

export type OwnerCourtsViewSession = {
  gameId: string;
  title: string;
  openPlayType: string;
  courtCount: number;
  status: "draft" | "active" | "ended";
  openPlayDate?: string | null;
  openPlayTimeRange?: string | null;
  courts: CourtView[];
  queue: QueueEntryView[];
  leaderboard: LeaderboardGamesPlayedRow[];
};

export type OwnerCourtsViewPayload = {
  sessions: OwnerCourtsViewSession[];
};
