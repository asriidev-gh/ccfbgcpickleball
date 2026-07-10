import { nanoid } from "nanoid";

import type { CourtView } from "@/components/game/court-card";
import type { MatchHistoryView } from "@/components/game/match-history-list";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { resolvePlayerId, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { getCourtEffectiveElapsedMs } from "@/lib/court-cancel-grace";
import type { LeaderboardGamesPlayedRow } from "@/lib/games-played-map";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import {
  canPickSinglesCourtPair,
  isSinglesWinnerLoserRotation,
  pickSinglesCourtPair,
  rebuildSinglesQueueOrder,
  removeQueueEntriesById,
} from "@/lib/singles/singles-queue-fill";
import {
  appendRequeueEntriesWithoutDuplicates,
  prependRequeueEntriesWithoutDuplicates,
} from "@/lib/queue-dedupe";
import {
  SINGLES_MIN_QUEUE_TO_FILL,
  SINGLES_PLAYERS_PER_COURT,
} from "@/lib/singles/singles-constants";

export type SinglesGamePayload = OperatorFullPayload;

export type SinglesEndGameInput = {
  courtNumber: number;
  winnerTeam: "A" | "B";
  teamAScore: number;
  teamBScore: number;
  rematch: boolean;
};

function leaderboardRowPlayerId(row: LeaderboardGamesPlayedRow): string | null {
  const playerId = row.playerId;
  if (playerId == null) return null;
  if (typeof playerId === "object" && "_id" in playerId && playerId._id != null) {
    return String(playerId._id);
  }
  return String(playerId);
}

function bumpLeaderboardRow(
  rows: LeaderboardGamesPlayedRow[],
  player: PlayerPhotoRef,
  won: boolean,
): LeaderboardGamesPlayedRow[] {
  const playerId = resolvePlayerId(player);
  if (!playerId) return rows;

  const existing = rows.find((row) => leaderboardRowPlayerId(row) === playerId);
  if (existing) {
    return rows.map((row) => {
      if (leaderboardRowPlayerId(row) !== playerId) return row;
      const wins = (row.wins ?? 0) + (won ? 1 : 0);
      const losses = (row.losses ?? 0) + (won ? 0 : 1);
      return {
        ...row,
        wins,
        losses,
        gamesPlayed: wins + losses,
      };
    });
  }

  return [
    ...rows,
    {
      playerId: { _id: playerId },
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
      gamesPlayed: 1,
    },
  ];
}

function buildSinglesRequeueEntries(
  teamA: PlayerPhotoRef[],
  teamB: PlayerPhotoRef[],
  winnerTeam: "A" | "B",
  baseTime: number,
): QueueEntryView[] {
  const slots = [
    { player: teamA[0], team: "A" as const },
    { player: teamB[0], team: "B" as const },
  ].filter((slot): slot is { player: PlayerPhotoRef; team: "A" | "B" } => Boolean(slot.player));

  return slots.map((slot, index) => {
    const isWinner = slot.team === winnerTeam;
    return {
      _id: `optimistic-singles-requeue-${baseTime}-${index}`,
      queueType: isWinner ? "winner" : "loser",
      playerId: slot.player,
      registeredAt: new Date(baseTime + index).toISOString(),
      lastMatchResult: isWinner ? "win" : "loss",
    };
  });
}

export function applySinglesFillCourtOptimistic(
  payload: SinglesGamePayload,
  courtNumber: number,
): SinglesGamePayload | null {
  const pair = pickSinglesCourtPair(payload.queue, payload.game.matchingType);
  if (!pair) return null;

  const emptyCourt = payload.courts.find(
    (court) => court.courtNumber === courtNumber && court.status === "empty",
  );
  if (!emptyCourt) return null;

  const startedAt = new Date().toISOString();
  const pickedIds = new Set(pair.map((entry) => entry._id));

  return {
    ...payload,
    queue: removeQueueEntriesById(payload.queue, pickedIds),
    courts: payload.courts.map((court) =>
      court.courtNumber === emptyCourt.courtNumber
        ? {
            ...court,
            status: "active",
            startedAt,
            pausedAt: null,
            totalPausedMs: 0,
            isRematch: false,
            teamA: { playerIds: [pair[0].playerId] },
            teamB: { playerIds: [pair[1].playerId] },
          }
        : court,
    ),
  };
}

export function applySinglesEndGameOptimistic(
  payload: SinglesGamePayload,
  input: SinglesEndGameInput,
): SinglesGamePayload | null {
  const court = payload.courts.find((item) => item.courtNumber === input.courtNumber);
  if (!court || court.status !== "active") return null;

  if (input.rematch) {
    return {
      ...payload,
      courts: payload.courts.map((item) =>
        item.courtNumber === input.courtNumber
          ? {
              ...item,
              startedAt: new Date().toISOString(),
              pausedAt: null,
              totalPausedMs: 0,
              isRematch: true,
            }
          : item,
      ),
    };
  }

  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];
  if (teamA.length + teamB.length < SINGLES_PLAYERS_PER_COURT) return null;

  const baseTime = Date.now();
  const requeueEntries = buildSinglesRequeueEntries(teamA, teamB, input.winnerTeam, baseTime);
  let nextQueue = appendRequeueEntriesWithoutDuplicates(payload.queue, requeueEntries);
  if (isSinglesWinnerLoserRotation(payload.game.matchingType)) {
    nextQueue = rebuildSinglesQueueOrder(nextQueue);
  }

  return {
    ...payload,
    queue: nextQueue,
    courts: payload.courts.map((item) =>
      item.courtNumber === input.courtNumber
        ? {
            ...item,
            status: "empty",
            startedAt: null,
            pausedAt: null,
            totalPausedMs: 0,
            isRematch: false,
            teamA: { playerIds: [] },
            teamB: { playerIds: [] },
          }
        : item,
    ),
  };
}

export function applySinglesEndGameWithHistoryOptimistic(
  payload: SinglesGamePayload,
  input: SinglesEndGameInput,
): SinglesGamePayload | null {
  const court = payload.courts.find((item) => item.courtNumber === input.courtNumber);
  if (!court || court.status !== "active") return null;

  const base = applySinglesEndGameOptimistic(payload, input);
  if (!base || input.rematch) return base;

  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];
  const endedAt = new Date();
  const startedAt = court.startedAt ? new Date(court.startedAt) : endedAt;
  const durationSeconds = court.startedAt
    ? Math.max(
        0,
        Math.floor(
          getCourtEffectiveElapsedMs(
            {
              startedAt: court.startedAt,
              pausedAt: null,
              totalPausedMs: court.totalPausedMs ?? 0,
            },
            endedAt.getTime(),
          ) / 1000,
        ),
      )
    : 0;

  const match: MatchHistoryView = {
    _id: `local-singles-match-${nanoid(10)}`,
    courtNumber: input.courtNumber,
    teamAPlayerIds: teamA.map((player) => ({
      _id: resolvePlayerId(player) ?? undefined,
      firstName: player.firstName,
      lastName: player.lastName,
      photoUrl: player.photoUrl,
      photoPublicId: player.photoPublicId,
      personalQrCode: player.personalQrCode,
    })),
    teamBPlayerIds: teamB.map((player) => ({
      _id: resolvePlayerId(player) ?? undefined,
      firstName: player.firstName,
      lastName: player.lastName,
      photoUrl: player.photoUrl,
      photoPublicId: player.photoPublicId,
      personalQrCode: player.personalQrCode,
    })),
    winnerTeam: input.winnerTeam,
    teamAScore: input.teamAScore,
    teamBScore: input.teamBScore,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds,
  };

  let leaderboard = base.leaderboard ?? [];
  for (const player of teamA) {
    leaderboard = bumpLeaderboardRow(leaderboard, player, input.winnerTeam === "A");
  }
  for (const player of teamB) {
    leaderboard = bumpLeaderboardRow(leaderboard, player, input.winnerTeam === "B");
  }

  return {
    ...base,
    matches: [match, ...(base.matches ?? [])],
    leaderboard,
  };
}

export function applySinglesCancelCourtAssignmentOptimistic(
  payload: SinglesGamePayload,
  courtNumber: number,
): SinglesGamePayload | null {
  const court = payload.courts.find(
    (item) => item.courtNumber === courtNumber && item.status === "active",
  );
  if (!court) return null;

  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];
  const courtPlayers = [teamA[0], teamB[0]].filter(Boolean);
  if (courtPlayers.length < SINGLES_PLAYERS_PER_COURT) return null;

  const firstQueuedMs =
    payload.queue.length > 0 ? new Date(payload.queue[0].registeredAt).getTime() : Date.now();
  const startMs = firstQueuedMs - courtPlayers.length * 1000;

  const requeuedEntries: QueueEntryView[] = courtPlayers.map((player, index) => ({
    _id: `optimistic-singles-cancel-court-${startMs}-${index}`,
    queueType: "normal",
    playerId: player,
    registeredAt: new Date(startMs + index * 1000).toISOString(),
    lastMatchResult: "none",
  }));

  return {
    ...payload,
    queue: isSinglesWinnerLoserRotation(payload.game.matchingType)
      ? rebuildSinglesQueueOrder(
          prependRequeueEntriesWithoutDuplicates(payload.queue, requeuedEntries),
        )
      : prependRequeueEntriesWithoutDuplicates(payload.queue, requeuedEntries),
    courts: payload.courts.map((item) =>
      item.courtNumber === courtNumber
        ? {
            ...item,
            status: "empty",
            startedAt: null,
            pausedAt: null,
            totalPausedMs: 0,
            isRematch: false,
            teamA: { playerIds: [] },
            teamB: { playerIds: [] },
          }
        : item,
    ),
  };
}

export function canSinglesFillCourt(payload: SinglesGamePayload, court: CourtView) {
  return (
    court.status === "empty" &&
    canPickSinglesCourtPair(payload.queue, payload.game.matchingType)
  );
}
