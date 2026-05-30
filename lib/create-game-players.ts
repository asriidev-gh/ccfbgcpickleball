import { nanoid } from "nanoid";

import {
  GENERATED_AVATAR_PUBLIC_ID,
  getGeneratedAvatarUrl,
} from "@/lib/player-avatar-url";
import { parsePlayerDisplayName } from "@/lib/parse-player-display-name";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

type CreatePreRegisteredPlayersOptions = {
  gameId: string;
  names: string[];
};

/** Creates queue entries for names the game owner entered at setup (Dice Bear avatars). */
export async function createPreRegisteredPlayers({
  gameId,
  names,
}: CreatePreRegisteredPlayersOptions) {
  const trimmed = names.map((name) => name.trim()).filter(Boolean);
  if (trimmed.length === 0) return 0;

  const runId = nanoid(8);
  const players = await Player.create(
    trimmed.map((displayName, index) => {
      const { firstName, lastName } = parsePlayerDisplayName(displayName);
      const personalQrCode = `P-owner-${runId}-${index + 1}`;
      return {
        firstName,
        // Omit empty lastName so Mongoose applies schema default (single-name entries).
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
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

  await QueueEntry.create(
    players.map((player, index) => ({
      gameId,
      playerId: player._id,
      registeredAt: new Date(Date.now() + index * 1000),
    })),
  );

  return players.length;
}
