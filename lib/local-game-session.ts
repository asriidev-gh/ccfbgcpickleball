import { nanoid } from "nanoid";

import type { CourtView } from "@/components/game/court-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import {
  GENERATED_AVATAR_PUBLIC_ID,
  getGeneratedAvatarUrl,
} from "@/lib/player-avatar-url";
import { parsePlayerDisplayName } from "@/lib/parse-player-display-name";
import type { GenderOption } from "@/lib/player-profile-shared";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import {
  getQuickGamePersistence,
} from "@/lib/local-game-id";
import { isDuplicateSessionPlayerName } from "@/lib/session-player-display-names";

export type LocalPreRegisteredPlayer = {
  displayName: string;
  gender: GenderOption;
};

export type CreateLocalLiveQueueSessionInput = {
  gameId: string;
  title: string;
  openPlayType: string;
  openPlayDate: string;
  openPlayTimeRange: string;
  venueName: string;
  venueAddress: string;
  venueGoogleMapEmbedUrl: string;
  courtCount: number;
  expectedPlayers: number;
  allowQrRegistration: boolean;
  allowManualPlayerAdd: boolean;
  players: LocalPreRegisteredPlayer[];
  checkInAllPlayers: boolean;
};

function buildLocalPlayer(
  displayName: string,
  uniqueKey: string,
  gender: GenderOption,
): PlayerPhotoRef {
  const { firstName, lastName } = parsePlayerDisplayName(displayName.trim());
  const personalQrCode = `P-local-${uniqueKey}`;
  const playerId = `local-player-${uniqueKey}`;

  return {
    _id: playerId,
    firstName,
    lastName: lastName.trim() ? lastName.trim() : "",
    photoUrl: getGeneratedAvatarUrl(personalQrCode),
    photoPublicId: GENERATED_AVATAR_PUBLIC_ID,
    personalQrCode,
    gender,
  };
}

function buildQueueEntry(
  player: PlayerPhotoRef,
  registeredAt: string,
  status: "queued" | "checked_out",
): QueueEntryView {
  return {
    _id: `local-entry-${nanoid(10)}`,
    queueType: "normal",
    playerId: player,
    registeredAt,
    lastMatchResult: "none",
    ...(status === "checked_out" ? { checkedOutAt: registeredAt } : {}),
  };
}

function buildCourts(courtCount: number): CourtView[] {
  return Array.from({ length: courtCount }, (_, index) => ({
    _id: `local-court-${index + 1}`,
    courtNumber: index + 1,
    status: "empty" as const,
    startedAt: null,
    pausedAt: null,
    totalPausedMs: 0,
    isRematch: false,
    teamA: { playerIds: [] },
    teamB: { playerIds: [] },
  }));
}

export function createLocalLiveQueueSession(
  input: CreateLocalLiveQueueSessionInput,
): OperatorFullPayload {
  const runId = nanoid(8);
  const trimmedPlayers = input.players
    .map((player) => ({
      displayName: player.displayName.trim(),
      gender: player.gender,
    }))
    .filter((player) => player.displayName.length > 0);
  const baseMs = Date.now();

  const players = trimmedPlayers.map((player, index) =>
    buildLocalPlayer(player.displayName, `${runId}-${index + 1}`, player.gender),
  );
  const queueEntries = players.map((player, index) =>
    buildQueueEntry(
      player,
      new Date(baseMs + index * 1000).toISOString(),
      input.checkInAllPlayers ? "queued" : "checked_out",
    ),
  );

  const queue = input.checkInAllPlayers ? queueEntries : [];
  const checkedOut = input.checkInAllPlayers ? [] : queueEntries;
  const quickGamePersistence = getQuickGamePersistence(input.gameId);

  return {
    game: {
      title: input.title,
      openPlayType: input.openPlayType,
      courtCount: input.courtCount,
      gameId: input.gameId,
      status: "active",
      openPlayDate: input.openPlayDate,
      openPlayTimeRange: input.openPlayTimeRange,
      venueName: input.venueName,
      venueAddress: input.venueAddress,
      venueGoogleMapEmbedUrl: input.venueGoogleMapEmbedUrl,
      allowQrRegistration: input.allowQrRegistration,
      registrationMode: "owner",
      allowManualPlayerAdd: input.allowManualPlayerAdd,
      liveQueue: false,
      ...(quickGamePersistence ? { quickGamePersistence } : {}),
    },
    queue,
    checkedOut,
    courts: buildCourts(input.courtCount),
    leaderboard: [],
    matches: [],
    firstTimerCount: 0,
    birthdayThisMonthCount: 0,
  };
}

export function addLocalManualPlayer(
  payload: OperatorFullPayload,
  displayName: string,
  gender: GenderOption,
): OperatorFullPayload | null {
  const trimmed = displayName.trim();
  if (!trimmed) return null;
  if (isDuplicateSessionPlayerName(payload, trimmed)) return null;

  const uniqueKey = nanoid(10);
  const player = buildLocalPlayer(trimmed, uniqueKey, gender);
  const lastMs =
    payload.queue.length > 0
      ? new Date(payload.queue[payload.queue.length - 1].registeredAt).getTime() + 1000
      : Date.now();
  const entry = buildQueueEntry(player, new Date(lastMs).toISOString(), "queued");

  return {
    ...payload,
    queue: [...payload.queue, entry],
  };
}

export function canEditQuickGameRoster(payload: OperatorFullPayload) {
  if ((payload.matches?.length ?? 0) > 0) return false;
  return payload.courts.every((court) => court.status === "empty");
}

export function extractQuickGamePlayerRoster(
  payload: OperatorFullPayload,
): LocalPreRegisteredPlayer[] {
  const rows = new Map<string, LocalPreRegisteredPlayer>();

  const add = (player: PlayerPhotoRef) => {
    const key = player._id ?? player.personalQrCode ?? "";
    if (!key || rows.has(key)) return;
    const displayName = `${player.firstName} ${player.lastName}`.trim();
    if (!displayName) return;
    rows.set(key, {
      displayName,
      gender: (player.gender as GenderOption | undefined) ?? "prefer_not_to_say",
    });
  };

  for (const entry of payload.queue) add(entry.playerId);
  for (const entry of payload.checkedOut ?? []) add(entry.playerId);
  for (const court of payload.courts) {
    for (const player of [...court.teamA.playerIds, ...court.teamB.playerIds]) {
      add(player);
    }
  }

  return [...rows.values()];
}

export function rebuildQuickGameSetup(
  payload: OperatorFullPayload,
  input: Omit<CreateLocalLiveQueueSessionInput, "gameId" | "expectedPlayers">,
): OperatorFullPayload {
  const next = createLocalLiveQueueSession({
    ...input,
    gameId: payload.game.gameId,
    expectedPlayers: input.players.length,
    allowQrRegistration: false,
  });

  return {
    ...next,
    game: {
      ...next.game,
      status: payload.game.status,
    },
    leaderboard: payload.leaderboard ?? [],
    matches: payload.matches ?? [],
    recap: payload.recap,
  };
}

export function patchQuickGameMetadata(
  payload: OperatorFullPayload,
  fields: {
    title: string;
    openPlayType: string;
    openPlayDate: string;
    openPlayTimeRange: string;
    venueName: string;
    venueAddress: string;
    venueGoogleMapEmbedUrl: string;
    courtCount: number;
    allowManualPlayerAdd: boolean;
  },
): OperatorFullPayload {
  return {
    ...payload,
    game: {
      ...payload.game,
      title: fields.title,
      openPlayType: fields.openPlayType,
      openPlayDate: fields.openPlayDate,
      openPlayTimeRange: fields.openPlayTimeRange,
      venueName: fields.venueName,
      venueAddress: fields.venueAddress,
      venueGoogleMapEmbedUrl: fields.venueGoogleMapEmbedUrl,
      courtCount: fields.courtCount,
      allowManualPlayerAdd: fields.allowManualPlayerAdd,
    },
  };
}
