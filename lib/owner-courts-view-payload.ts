import type { CourtView } from "@/components/game/court-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { LeaderboardGamesPlayedRow } from "@/lib/games-played-map";

import type { QuickPlayMatchingType } from "@/lib/quick-play-wizard-shared";

export type OwnerCourtsViewSession = {
  gameId: string;
  title: string;
  openPlayType: string;
  courtCount: number;
  status: "draft" | "active" | "ended";
  openPlayDate?: string | null;
  openPlayTimeRange?: string | null;
  gameMode?: "doubles" | "singles";
  matchingType?: QuickPlayMatchingType;
  courts: CourtView[];
  queue: QueueEntryView[];
  checkedOut?: QueueEntryView[];
  leaderboard: LeaderboardGamesPlayedRow[];
};

export type OwnerCourtsViewPayload = {
  sessions: OwnerCourtsViewSession[];
};
