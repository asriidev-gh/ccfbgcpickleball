import { nanoid } from "nanoid";

import type { CourtView } from "@/components/game/court-card";
import type { MatchHistoryView } from "@/components/game/match-history-list";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { resolvePlayerId, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { getCourtEffectiveElapsedMs } from "@/lib/court-cancel-grace";
import type { LeaderboardGamesPlayedRow } from "@/lib/games-played-map";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import { queueEntryPlayerId } from "@/lib/queue-highlight";
import { shouldUseRotationRequeue } from "@/lib/rotation-requeue-shared";
import {
  appendDoublesRequeueEntries,
  buildDoublesWinnerLoserRequeueEntries,
  canPickDoublesCourtFoursome,
  DOUBLES_PLAYERS_PER_COURT,
  isDoublesWinnerLoserRotation,
  pickDoublesCourtFoursome,
  rebuildDoublesQueueOrder,
  removeQueueEntriesById,
  resolveDoublesRotationQueue,
} from "@/lib/doubles/doubles-queue-fill";

export type GamePayload = OperatorFullPayload;

export type EndGameMutationInput = {
  courtNumber: number;
  winnerTeam: "A" | "B";
  teamAScore: number;
  teamBScore: number;
  rematch: boolean;
};

export type ReplaceQueueMutationInput = {
  sourceIndex: number;
  targetIndex: number;
};

export type ReplaceCourtMutationInput = {
  courtNumber: number;
  team: "A" | "B";
  slotIndex: number;
  targetIndex: number;
};

function countActivePlayersForRotation(payload: GamePayload) {
  const onCourt = payload.courts
    .filter((court) => court.status === "active")
    .reduce(
      (sum, court) =>
        sum + (court.teamA?.playerIds?.length ?? 0) + (court.teamB?.playerIds?.length ?? 0),
      0,
    );
  return payload.queue.length + onCourt;
}

function shouldUseRotationRequeuePayload(payload: GamePayload) {
  return shouldUseRotationRequeue(countActivePlayersForRotation(payload));
}

function buildRotationOptimisticRequeueEntries(
  teamA: PlayerPhotoRef[],
  teamB: PlayerPhotoRef[],
  winnerTeam: "A" | "B",
  baseTime: number,
): QueueEntryView[] {
  const buildEntry = (player: PlayerPhotoRef, team: "A" | "B", index: number): QueueEntryView => {
    const isWinner = team === winnerTeam;
    return {
      _id: `optimistic-rotation-${baseTime}-${team}-${index}`,
      queueType: "normal",
      playerId: player,
      registeredAt: new Date(baseTime + index).toISOString(),
      lastMatchResult: isWinner ? "win" : "loss",
    };
  };

  return [
    buildEntry(teamA[0], "A", 0),
    buildEntry(teamA[1], "A", 1),
    buildEntry(teamB[0], "B", 2),
    buildEntry(teamB[1], "B", 3),
  ];
}

function buildOptimisticRequeueEntries(
  teamA: PlayerPhotoRef[],
  teamB: PlayerPhotoRef[],
  winnerTeam: "A" | "B",
  baseTime: number,
): QueueEntryView[] {
  const slots = [
    { player: teamA[0], team: "A" as const },
    { player: teamB[0], team: "B" as const },
    { player: teamA[1], team: "A" as const },
    { player: teamB[1], team: "B" as const },
  ].filter((slot): slot is { player: PlayerPhotoRef; team: "A" | "B" } => Boolean(slot.player));

  return slots.map((slot, index) => {
    const isWinner = slot.team === winnerTeam;
    return {
      _id: `optimistic-requeue-${baseTime}-${index}`,
      queueType: isWinner ? "winner" : "loser",
      playerId: slot.player,
      registeredAt: new Date(baseTime + index).toISOString(),
      lastMatchResult: isWinner ? "win" : "loss",
    };
  });
}

function shuffleSlots<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function teamKeyFromPlayers(players: PlayerPhotoRef[]): string {
  return players
    .map((player) => resolvePlayerId(player) ?? "")
    .filter(Boolean)
    .sort()
    .join(",");
}

function shuffleIntoNewHalves(
  items: QueueEntryView[],
): { firstHalf: QueueEntryView[]; secondHalf: QueueEntryView[] } {
  const half = Math.floor(items.length / 2);
  const currentKey = teamKeyFromPlayers(items.slice(0, half).map((entry) => entry.playerId));

  let shuffled = items;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    shuffled = shuffleSlots(items);
    if (teamKeyFromPlayers(shuffled.slice(0, half).map((entry) => entry.playerId)) !== currentKey) {
      break;
    }
  }

  return { firstHalf: shuffled.slice(0, half), secondHalf: shuffled.slice(half) };
}

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

function swapQueueEntriesAt(
  queue: QueueEntryView[],
  sourceIndex: number,
  targetIndex: number,
): QueueEntryView[] {
  const next = [...queue];
  const sourceRegisteredAt = next[sourceIndex].registeredAt;
  const targetRegisteredAt = next[targetIndex].registeredAt;
  [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
  next[sourceIndex] = { ...next[sourceIndex], registeredAt: sourceRegisteredAt };
  next[targetIndex] = { ...next[targetIndex], registeredAt: targetRegisteredAt };
  return next;
}

export function applyFillNextCourtOptimistic(
  payload: GamePayload,
  courtNumber: number,
): GamePayload | null {
  const queue = resolveDoublesRotationQueue(payload.queue, payload.game.matchingType);
  const nextFour = queue.slice(0, DOUBLES_PLAYERS_PER_COURT);
  if (nextFour.length < DOUBLES_PLAYERS_PER_COURT) return null;

  const emptyCourt = payload.courts.find(
    (court) => court.courtNumber === courtNumber && court.status === "empty",
  );
  if (!emptyCourt) return null;

  const pickedIds = new Set(nextFour.map((entry) => entry._id));
  const startedAt = new Date().toISOString();

  return {
    ...payload,
    queue: removeQueueEntriesById(queue, pickedIds),
    courts: payload.courts.map((court) =>
      court.courtNumber === emptyCourt.courtNumber
        ? {
            ...court,
            status: "active",
            startedAt,
            pausedAt: null,
            totalPausedMs: 0,
            isRematch: false,
            teamA: { playerIds: nextFour.slice(0, 2).map((entry) => entry.playerId) },
            teamB: { playerIds: nextFour.slice(2, 4).map((entry) => entry.playerId) },
          }
        : court,
    ),
  };
}

export function applyEndGameOptimistic(
  payload: GamePayload,
  input: EndGameMutationInput,
): GamePayload | null {
  const court = payload.courts.find((c) => c.courtNumber === input.courtNumber);
  if (!court || court.status !== "active") return null;

  if (input.rematch) {
    return {
      ...payload,
      courts: payload.courts.map((c) =>
        c.courtNumber === input.courtNumber
          ? {
              ...c,
              startedAt: new Date().toISOString(),
              pausedAt: null,
              totalPausedMs: 0,
              isRematch: true,
            }
          : c,
      ),
    };
  }

  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];
  if (teamA.length + teamB.length < 4) return null;

  const baseTime = Date.now();

  if (isDoublesWinnerLoserRotation(payload.game.matchingType)) {
    const requeueEntries = buildDoublesWinnerLoserRequeueEntries(
      teamA,
      teamB,
      input.winnerTeam,
      baseTime,
    );
    const nextQueue = appendDoublesRequeueEntries(payload.queue, requeueEntries);

    return {
      ...payload,
      queue: nextQueue,
      courts: payload.courts.map((c) =>
        c.courtNumber === input.courtNumber
          ? {
              ...c,
              status: "empty",
              startedAt: null,
              pausedAt: null,
              totalPausedMs: 0,
              isRematch: false,
              teamA: { playerIds: [] },
              teamB: { playerIds: [] },
            }
          : c,
      ),
    };
  }

  if (
    shouldUseRotationRequeuePayload(payload) &&
    payload.queue.length >= 2 &&
    teamA.length === 2 &&
    teamB.length === 2
  ) {
    const withoutLastTwo = payload.queue.slice(0, -2);
    const lastTwo = payload.queue.slice(-2);
    const rotationEntries = buildRotationOptimisticRequeueEntries(
      teamA,
      teamB,
      input.winnerTeam,
      baseTime,
    );
    const pairAEntries = rotationEntries.slice(0, 2);
    const pairBEntries = rotationEntries.slice(2, 4);
    const mergedQueue = [...withoutLastTwo, ...pairAEntries, ...lastTwo, ...pairBEntries].map(
      (entry, index) => ({
        ...entry,
        registeredAt: new Date(baseTime + index).toISOString(),
      }),
    );

    return {
      ...payload,
      queue: mergedQueue,
      courts: payload.courts.map((c) =>
        c.courtNumber === input.courtNumber
          ? {
              ...c,
              status: "empty",
              startedAt: null,
              pausedAt: null,
              totalPausedMs: 0,
              isRematch: false,
              teamA: { playerIds: [] },
              teamB: { playerIds: [] },
            }
          : c,
      ),
    };
  }

  const requeueEntries = buildOptimisticRequeueEntries(teamA, teamB, input.winnerTeam, baseTime);

  return {
    ...payload,
    queue: [...payload.queue, ...requeueEntries],
    courts: payload.courts.map((c) =>
      c.courtNumber === input.courtNumber
        ? {
            ...c,
            status: "empty",
            startedAt: null,
            pausedAt: null,
            totalPausedMs: 0,
            isRematch: false,
            teamA: { playerIds: [] },
            teamB: { playerIds: [] },
          }
        : c,
    ),
  };
}

/** End game with match history and leaderboard updates (local live-queue mode). */
export function applyEndGameWithHistoryOptimistic(
  payload: GamePayload,
  input: EndGameMutationInput,
): GamePayload | null {
  const court = payload.courts.find((c) => c.courtNumber === input.courtNumber);
  if (!court || court.status !== "active") return null;

  const base = applyEndGameOptimistic(payload, input);
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
    _id: `local-match-${nanoid(10)}`,
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

export function applyCourtPauseOptimistic(
  payload: GamePayload,
  courtNumber: number,
  paused: boolean,
): GamePayload | null {
  const court = payload.courts.find(
    (item) => item.courtNumber === courtNumber && item.status === "active",
  );
  if (!court) return null;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  return {
    ...payload,
    courts: payload.courts.map((item) => {
      if (item.courtNumber !== courtNumber) return item;

      if (paused) {
        return { ...item, pausedAt: nowIso };
      }

      const pauseStart = item.pausedAt ? new Date(item.pausedAt).getTime() : null;
      const addedPause =
        pauseStart != null && !Number.isNaN(pauseStart) ? Math.max(0, now - pauseStart) : 0;

      return {
        ...item,
        pausedAt: null,
        totalPausedMs: (item.totalPausedMs ?? 0) + addedPause,
      };
    }),
  };
}

export function applyAllCourtsPauseOptimistic(
  payload: GamePayload,
  paused: boolean,
): GamePayload | null {
  const hasActive = payload.courts.some((item) => item.status === "active");
  if (!hasActive) return null;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  return {
    ...payload,
    courts: payload.courts.map((item) => {
      if (item.status !== "active") return item;

      if (paused) {
        if (item.pausedAt) return item;
        return { ...item, pausedAt: nowIso };
      }

      if (!item.pausedAt) return item;

      const pauseStart = new Date(item.pausedAt).getTime();
      const addedPause = !Number.isNaN(pauseStart) ? Math.max(0, now - pauseStart) : 0;

      return {
        ...item,
        pausedAt: null,
        totalPausedMs: (item.totalPausedMs ?? 0) + addedPause,
      };
    }),
  };
}

function isPlayerOnActiveCourt(courts: CourtView[], playerId: string): boolean {
  return courts.some(
    (court) =>
      court.status === "active" &&
      [...(court.teamA?.playerIds ?? []), ...(court.teamB?.playerIds ?? [])].some(
        (player) => resolvePlayerId(player) === playerId,
      ),
  );
}

export function applyCheckoutOptimistic(
  payload: GamePayload,
  queueEntryId: string,
): GamePayload | null {
  const entry = payload.queue.find((item) => item._id === queueEntryId);
  if (!entry) return null;

  const checkedOutAt = new Date().toISOString();
  return {
    ...payload,
    queue: payload.queue.filter((item) => item._id !== queueEntryId),
    checkedOut: [{ ...entry, checkedOutAt }, ...(payload.checkedOut ?? [])],
  };
}

export function applyCheckBackInOptimistic(
  payload: GamePayload,
  queueEntryId: string,
): GamePayload | null {
  const entry = (payload.checkedOut ?? []).find((item) => item._id === queueEntryId);
  if (!entry) return null;

  const registeredAt = new Date().toISOString();
  const { checkedOutAt: _checkedOutAt, ...rest } = entry;

  return {
    ...payload,
    checkedOut: (payload.checkedOut ?? []).filter((item) => item._id !== queueEntryId),
    queue: [
      ...payload.queue,
      {
        ...rest,
        registeredAt,
        lastMatchResult: entry.lastMatchResult ?? "none",
      },
    ],
  };
}

export function applyRemovePlayerOptimistic(
  payload: GamePayload,
  playerId: string,
): GamePayload | null {
  if (isPlayerOnActiveCourt(payload.courts, playerId)) return null;

  const withoutPlayer = (entries: QueueEntryView[]) =>
    entries.filter((entry) => queueEntryPlayerId(entry) !== playerId);

  const matchIncludesPlayer = (match: MatchHistoryView) =>
    match.teamAPlayerIds.some((player) => player._id === playerId) ||
    match.teamBPlayerIds.some((player) => player._id === playerId);

  return {
    ...payload,
    queue: withoutPlayer(payload.queue),
    checkedOut: withoutPlayer(payload.checkedOut ?? []),
    courts: payload.courts.map((court) => ({
      ...court,
      teamA: {
        playerIds: court.teamA.playerIds.filter(
          (player) => resolvePlayerId(player) !== playerId,
        ),
      },
      teamB: {
        playerIds: court.teamB.playerIds.filter(
          (player) => resolvePlayerId(player) !== playerId,
        ),
      },
    })),
    matches: payload.matches.filter((match) => !matchIncludesPlayer(match)),
    leaderboard: payload.leaderboard?.filter(
      (row) => leaderboardRowPlayerId(row) !== playerId,
    ),
  };
}

export function applyQueueReorderOptimistic(
  payload: GamePayload,
  orderedEntryIds: string[],
): GamePayload | null {
  if (orderedEntryIds.length !== payload.queue.length) return null;

  const byId = new Map(payload.queue.map((entry) => [entry._id, entry]));
  const seen = new Set<string>();
  const reordered: QueueEntryView[] = [];

  for (const entryId of orderedEntryIds) {
    if (seen.has(entryId)) return null;
    seen.add(entryId);
    const entry = byId.get(entryId);
    if (!entry) return null;
    reordered.push(entry);
  }

  const baseTime =
    reordered.length > 0 ? new Date(reordered[0].registeredAt).getTime() : Date.now();

  return {
    ...payload,
    queue: reordered.map((entry, index) => ({
      ...entry,
      registeredAt: new Date(baseTime + index * 1000).toISOString(),
    })),
  };
}

export function applyQueueSwapByIndexOptimistic(
  payload: GamePayload,
  sourceIndex: number,
  targetIndex: number,
): GamePayload | null {
  if (sourceIndex < 0 || targetIndex < 0) return null;
  if (sourceIndex >= payload.queue.length || targetIndex >= payload.queue.length) return null;
  if (sourceIndex === targetIndex) return null;

  return {
    ...payload,
    queue: swapQueueEntriesAt(payload.queue, sourceIndex, targetIndex),
  };
}

export function applyQueueSwapOptimistic(
  payload: GamePayload,
  input: ReplaceQueueMutationInput,
  nextUpCount = 4,
): GamePayload | null {
  const { sourceIndex, targetIndex } = input;
  if (sourceIndex < 0 || sourceIndex >= nextUpCount) return null;
  if (targetIndex < nextUpCount || targetIndex >= payload.queue.length) return null;
  if (sourceIndex === targetIndex) return null;

  return applyQueueSwapByIndexOptimistic(payload, sourceIndex, targetIndex);
}

export function applyCourtReplaceOptimistic(
  payload: GamePayload,
  input: ReplaceCourtMutationInput,
): GamePayload | null {
  const { courtNumber, team, slotIndex, targetIndex } = input;
  if (slotIndex < 0 || slotIndex > 1) return null;

  const court = payload.courts.find(
    (item) => item.courtNumber === courtNumber && item.status === "active",
  );
  if (!court) return null;
  if (targetIndex < 0 || targetIndex >= payload.queue.length) return null;

  const teamPlayers = team === "A" ? court.teamA.playerIds : court.teamB.playerIds;
  if (slotIndex >= teamPlayers.length) return null;

  const courtPlayer = teamPlayers[slotIndex];
  const queuedEntry = payload.queue[targetIndex];
  if (!courtPlayer || !queuedEntry) return null;

  const requeuedEntry: QueueEntryView = {
    _id: `optimistic-court-replace-${Date.now()}`,
    queueType: "normal",
    playerId: courtPlayer,
    registeredAt: queuedEntry.registeredAt,
    lastMatchResult: "none",
  };

  return {
    ...payload,
    queue: payload.queue.map((entry, index) =>
      index === targetIndex ? requeuedEntry : entry,
    ),
    courts: payload.courts.map((item) => {
      if (item.courtNumber !== courtNumber) return item;
      if (team === "A") {
        const playerIds = [...item.teamA.playerIds];
        playerIds[slotIndex] = queuedEntry.playerId;
        return { ...item, teamA: { playerIds } };
      }
      const playerIds = [...item.teamB.playerIds];
      playerIds[slotIndex] = queuedEntry.playerId;
      return { ...item, teamB: { playerIds } };
    }),
  };
}

export function applyCancelCourtAssignmentOptimistic(
  payload: GamePayload,
  courtNumber: number,
): GamePayload | null {
  const court = payload.courts.find(
    (item) => item.courtNumber === courtNumber && item.status === "active",
  );
  if (!court) return null;

  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];
  const courtPlayers = [teamA[0], teamA[1], teamB[0], teamB[1]].filter(Boolean);
  if (courtPlayers.length < 4) return null;

  const firstQueuedMs =
    payload.queue.length > 0 ? new Date(payload.queue[0].registeredAt).getTime() : Date.now();
  const startMs = firstQueuedMs - courtPlayers.length * 1000;

  const requeuedEntries: QueueEntryView[] = courtPlayers.map((player, index) => ({
    _id: `optimistic-cancel-court-${startMs}-${index}`,
    queueType: "normal",
    playerId: player,
    registeredAt: new Date(startMs + index * 1000).toISOString(),
    lastMatchResult: "none",
  }));

  const nextQueue = isDoublesWinnerLoserRotation(payload.game.matchingType)
    ? rebuildDoublesQueueOrder([...requeuedEntries, ...payload.queue])
    : [...requeuedEntries, ...payload.queue];

  return {
    ...payload,
    queue: nextQueue,
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

export function applyCancelRematchOptimistic(
  payload: GamePayload,
  courtNumber: number,
): GamePayload | null {
  const court = payload.courts.find(
    (item) => item.courtNumber === courtNumber && item.status === "active" && item.isRematch,
  );
  if (!court) return null;

  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];
  const courtPlayers = [teamA[0], teamA[1], teamB[0], teamB[1]].filter(Boolean);
  if (courtPlayers.length < 4) return null;

  const baseMs =
    payload.queue.length > 0
      ? new Date(payload.queue[payload.queue.length - 1].registeredAt).getTime() + 1000
      : Date.now();

  const requeuedEntries: QueueEntryView[] = courtPlayers.map((player, index) => ({
    _id: `optimistic-cancel-rematch-${baseMs}-${index}`,
    queueType: "normal",
    playerId: player,
    registeredAt: new Date(baseMs + index * 1000).toISOString(),
    lastMatchResult: "none",
  }));

  return {
    ...payload,
    queue: [...payload.queue, ...requeuedEntries],
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

export function applyShuffleNextOptimistic(payload: GamePayload): GamePayload | null {
  const ordered = resolveDoublesRotationQueue(payload.queue, payload.game.matchingType);
  const nextUp = ordered.slice(0, DOUBLES_PLAYERS_PER_COURT);
  if (nextUp.length < DOUBLES_PLAYERS_PER_COURT) return null;

  const pickedIds = new Set(nextUp.map((entry) => entry._id));
  const insertAt = ordered.findIndex((entry) => pickedIds.has(entry._id));
  const without = ordered.filter((entry) => !pickedIds.has(entry._id));
  const { firstHalf, secondHalf } = shuffleIntoNewHalves(nextUp);

  const baseTime = new Date(nextUp[0].registeredAt).getTime();
  const shuffled = [...firstHalf, ...secondHalf].map((entry, index) => ({
    ...entry,
    registeredAt: new Date(baseTime + index * 1000).toISOString(),
  }));

  return {
    ...payload,
    queue: [...without.slice(0, insertAt), ...shuffled, ...without.slice(insertAt)],
  };
}

export function canFillDoublesCourt(
  payload: GamePayload,
  court: CourtView,
): boolean {
  return (
    court.status === "empty" &&
    canPickDoublesCourtFoursome(payload.queue, payload.game.matchingType)
  );
}

export function applySwapCourtTeamsOptimistic(
  payload: GamePayload,
  courtNumber: number,
): GamePayload | null {
  const court = payload.courts.find(
    (item) => item.courtNumber === courtNumber && item.status === "active",
  );
  if (!court) return null;

  const slots = [...court.teamA.playerIds, ...court.teamB.playerIds];
  if (slots.length < 4) return null;

  const asEntries: QueueEntryView[] = slots.map((player, index) => ({
    _id: `swap-slot-${index}`,
    queueType: "normal",
    playerId: player,
    registeredAt: new Date().toISOString(),
    lastMatchResult: "none",
  }));

  const { firstHalf, secondHalf } = shuffleIntoNewHalves(asEntries);

  return {
    ...payload,
    courts: payload.courts.map((item) =>
      item.courtNumber === courtNumber
        ? {
            ...item,
            teamA: { playerIds: firstHalf.map((entry) => entry.playerId) },
            teamB: { playerIds: secondHalf.map((entry) => entry.playerId) },
          }
        : item,
    ),
  };
}

export function applyEndOpenPlayOptimistic(payload: GamePayload): GamePayload {
  return {
    ...payload,
    game: { ...payload.game, status: "ended" },
  };
}
