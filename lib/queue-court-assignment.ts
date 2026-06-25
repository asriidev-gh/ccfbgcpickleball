import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Types } from "mongoose";
import { randomMixedDoublesTeamSplit } from "@/lib/doubles/mixed-doubles-shuffle";
import { pickDoublesCourtFoursome } from "@/lib/doubles/doubles-queue-fill";
import {
  type GameFormatSettings,
  playersPerCourtForGameMode,
  resolveGameFormatSettings,
} from "@/lib/game-format-settings";
import { isMixedDoublesMatching } from "@/lib/quick-play-wizard-shared";
import { pickSinglesCourtPair } from "@/lib/singles/singles-queue-fill";

export type QueueEntryLike = {
  _id: { toString(): string } | string | Types.ObjectId;
  playerId: unknown;
  queueType?: QueueEntryView["queueType"];
  registeredAt?: Date | string;
  lastMatchResult?: QueueEntryView["lastMatchResult"];
  winStreak?: number;
};

export function toQueueEntryViewForPick(entry: QueueEntryLike): QueueEntryView {
  const player = entry.playerId as QueueEntryView["playerId"];
  const playerId =
    typeof player === "object" && player != null
      ? {
          ...player,
          _id:
            player._id != null
              ? String(player._id)
              : undefined,
        }
      : player;

  return {
    _id: String(entry._id),
    queueType: entry.queueType ?? "normal",
    playerId,
    registeredAt:
      entry.registeredAt instanceof Date
        ? entry.registeredAt.toISOString()
        : typeof entry.registeredAt === "string"
          ? entry.registeredAt
          : new Date().toISOString(),
    lastMatchResult: entry.lastMatchResult ?? "none",
  };
}

export type CourtTeamAssignment<T extends QueueEntryLike = QueueEntryLike> = {
  teamA: T[];
  teamB: T[];
  picked: T[];
};

export function pickCourtPlayersFromQueue<T extends QueueEntryLike>(
  queue: T[],
  format: GameFormatSettings,
): T[] | null {
  const views = queue.map(toQueueEntryViewForPick);
  if (format.gameMode === "singles") {
    const pair = pickSinglesCourtPair(views, format.matchingType);
    if (!pair) return null;
    const pickedIds = new Set(pair.map((entry) => entry._id));
    return queue.filter((entry) => pickedIds.has(String(entry._id)));
  }

  const foursome = pickDoublesCourtFoursome(views, format.matchingType);
  if (!foursome) return null;
  const pickedIds = new Set(foursome.map((entry) => entry._id));
  return queue.filter((entry) => pickedIds.has(String(entry._id)));
}

export function assignCourtTeams<T extends QueueEntryLike>(
  picked: T[],
  format: GameFormatSettings,
): CourtTeamAssignment<T> | null {
  const required = playersPerCourtForGameMode(format.gameMode);
  if (picked.length < required) return null;

  if (format.gameMode === "singles") {
    return {
      picked,
      teamA: [picked[0]!],
      teamB: [picked[1]!],
    };
  }

  if (isMixedDoublesMatching(format.matchingType)) {
    const views = picked.map(toQueueEntryViewForPick);
    const split = randomMixedDoublesTeamSplit(views, (entry) => entry.playerId.gender);
    if (!split) return null;

    const viewById = new Map(views.map((entry) => [entry._id, entry]));
    const teamA = split.firstHalf
      .map((entry) => picked.find((raw) => String(raw._id) === entry._id))
      .filter((entry): entry is T => entry != null);
    const teamB = split.secondHalf
      .map((entry) => picked.find((raw) => String(raw._id) === entry._id))
      .filter((entry): entry is T => entry != null);

    if (teamA.length !== 2 || teamB.length !== 2) return null;
    return { picked, teamA, teamB };
  }

  return {
    picked,
    teamA: picked.slice(0, 2),
    teamB: picked.slice(2, 4),
  };
}

export function resolveCourtAssignmentFromQueue<T extends QueueEntryLike>(
  queue: T[],
  formatInput?: { gameMode?: string | null; matchingType?: string | null },
): CourtTeamAssignment<T> | null {
  const format = resolveGameFormatSettings(formatInput);
  const picked = pickCourtPlayersFromQueue(queue, format);
  if (!picked) return null;
  return assignCourtTeams(picked, format);
}
