import type { ClubBranding } from "@/lib/club-branding";
import type { CourtView } from "@/components/game/court-card";
import type { MatchHistoryView } from "@/components/game/match-history-list";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { GameLeaderboardRecapRow } from "@/lib/game-leaderboard-recap";
import type { LeaderboardGamesPlayedRow } from "@/lib/games-played-map";
import type { SessionInsight } from "@/lib/session-insights";

export type OperatorGameSummary = {
  title: string;
  openPlayType: string;
  courtCount: number;
  gameId: string;
  status: "draft" | "active" | "ended";
  openPlayDate?: string | null;
  openPlayTimeRange?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  venueGoogleMapEmbedUrl?: string | null;
  allowQrRegistration?: boolean;
  registrationMode?: "self" | "owner";
  allowManualPlayerAdd?: boolean;
  /** When false, queue state is client-only (no DB queue records). */
  liveQueue?: boolean;
  /** Browser quick game: account sessions may sync to QuickGameSession; ephemeral never saves. */
  quickGamePersistence?: "account" | "ephemeral";
  registerUrl?: string;
  publicQrCodeDataUrl?: string;
};

export type OperatorShellPayload = {
  game: OperatorGameSummary;
  clubBranding?: ClubBranding | null;
};

export type OperatorQueuePayload = {
  status: "draft" | "active" | "ended";
  queue: QueueEntryView[];
  checkedOut: QueueEntryView[];
  courts: CourtView[];
  firstTimerCount?: number;
  birthdayThisMonthCount?: number;
};

export type OperatorDetailsPayload = {
  leaderboard: LeaderboardGamesPlayedRow[];
  matches: MatchHistoryView[];
  recap?: {
    rows: GameLeaderboardRecapRow[];
    insights: SessionInsight[];
  };
  qr?: {
    registerUrl: string;
    publicQrCodeDataUrl: string;
  };
};

export type OperatorFullPayload = {
  game: OperatorGameSummary;
  queue: QueueEntryView[];
  checkedOut: QueueEntryView[];
  courts: CourtView[];
  leaderboard: LeaderboardGamesPlayedRow[];
  matches: MatchHistoryView[];
  recap?: OperatorDetailsPayload["recap"];
  firstTimerCount?: number;
  birthdayThisMonthCount?: number;
};

export function mergeOperatorGamePayload(
  shell: OperatorShellPayload,
  queue?: OperatorQueuePayload | null,
  details?: OperatorDetailsPayload | null,
): OperatorFullPayload {
  const status = queue?.status ?? shell.game.status;

  return {
    game: {
      ...shell.game,
      status,
      registerUrl: details?.qr?.registerUrl ?? shell.game.registerUrl,
      publicQrCodeDataUrl: details?.qr?.publicQrCodeDataUrl ?? shell.game.publicQrCodeDataUrl,
    },
    queue: queue?.queue ?? [],
    checkedOut: queue?.checkedOut ?? [],
    courts: queue?.courts ?? [],
    leaderboard: details?.leaderboard ?? [],
    matches: details?.matches ?? [],
    recap: details?.recap,
    firstTimerCount: queue?.firstTimerCount ?? 0,
    birthdayThisMonthCount: queue?.birthdayThisMonthCount ?? 0,
  };
}
