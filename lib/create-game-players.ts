import { nanoid } from "nanoid";

import {
  GENERATED_AVATAR_PUBLIC_ID,
  getGeneratedAvatarUrl,
} from "@/lib/player-avatar-url";
import { parsePlayerDisplayName } from "@/lib/parse-player-display-name";
import type { PlayerOpenPlayLevel } from "@/lib/open-play-types";
import { openPlayLevelToPickleballLevel } from "@/lib/open-play-types";
import type { GenderOption } from "@/lib/player-profile-shared";
import { assertPlayerDisplayName } from "@/lib/player-profile-shared";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

type PreRegisteredPlayerInput =
  | string
  | {
      displayName: string;
      gender?: GenderOption;
      openPlayLevel?: PlayerOpenPlayLevel;
    };

type CreatePreRegisteredPlayersOptions = {
  gameId: string;
  names: PreRegisteredPlayerInput[];
  /** When true, new entries are timestamped after the current queued tail. */
  appendToEnd?: boolean;
  /** When false, players start on the checkout list instead of the active queue. */
  checkInAllPlayers?: boolean;
};

function normalizePreRegisteredPlayers(names: PreRegisteredPlayerInput[]) {
  return names
    .map((entry) =>
      typeof entry === "string"
        ? { displayName: entry.trim(), gender: undefined as GenderOption | undefined }
        : {
            displayName: entry.displayName.trim(),
            gender: entry.gender,
            openPlayLevel: entry.openPlayLevel,
          },
    )
    .filter((entry) => entry.displayName.length > 0)
    .map((entry) => {
      assertPlayerDisplayName(entry.displayName);
      return entry;
    });
}

/** Creates queue entries for names the game owner entered at setup (Dice Bear avatars). */
export async function createPreRegisteredPlayers({
  gameId,
  names,
  appendToEnd = false,
  checkInAllPlayers = true,
}: CreatePreRegisteredPlayersOptions) {
  const trimmed = normalizePreRegisteredPlayers(names);
  if (trimmed.length === 0) return 0;

  const runId = nanoid(8);
  const players = await Player.create(
    trimmed.map((entry, index) => {
      const { firstName, lastName } = parsePlayerDisplayName(entry.displayName);
      const personalQrCode = `P-owner-${runId}-${index + 1}`;
      return {
        firstName,
        // Omit empty lastName so Mongoose applies schema default (single-name entries).
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(entry.gender ? { gender: entry.gender } : {}),
        ...(entry.openPlayLevel
          ? { pickleballLevel: openPlayLevelToPickleballLevel(entry.openPlayLevel) }
          : {}),
        mobileNumber: `090000${String(index + 1).padStart(5, "0")}`,
        email: `owner-${gameId}-${runId}-${index + 1}@paddleflow.local`,
        personalQrCode,
        photoUrl: getGeneratedAvatarUrl(personalQrCode),
        photoPublicId: GENERATED_AVATAR_PUBLIC_ID,
        firstTimeSportsMinistry: false,
        isPartOfDgroup: false,
        attendedEvents: [],
        attendedEventsOther: "",
        lastAttendedAt: new Date(),
      };
    }),
  );

  let baseMs = Date.now();
  if (appendToEnd) {
    const lastQueued = await QueueEntry.findOne({ gameId, status: "queued" })
      .sort({ registeredAt: -1 })
      .select("registeredAt")
      .lean<{ registeredAt?: Date } | null>();
    baseMs = (lastQueued?.registeredAt ? new Date(lastQueued.registeredAt).getTime() : Date.now()) + 1000;
  }

  const entryStatus = checkInAllPlayers ? ("queued" as const) : ("checked_out" as const);

  await QueueEntry.insertMany(
    players.map((player, index) => ({
      gameId,
      playerId: player._id,
      status: entryStatus,
      registeredAt: new Date(baseMs + index * 1000),
    })),
  );

  return players.length;
}
