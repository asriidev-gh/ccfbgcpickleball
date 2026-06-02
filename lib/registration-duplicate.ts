import { capitalizeNameWords } from "@/lib/utils";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

export type RegistrationIdentity = {
  firstName: string;
  lastName: string;
  email: string;
};

export function normalizeRegistrationIdentity(identity: RegistrationIdentity) {
  return {
    firstName: capitalizeNameWords(identity.firstName.trim()),
    lastName: capitalizeNameWords(identity.lastName.trim()),
    email: identity.email.trim().toLowerCase(),
  };
}

/** Player already in this game's queue with the same name and email. */
export async function findPlayerAlreadyRegisteredForGame(
  gameId: string,
  identity: RegistrationIdentity,
) {
  const { firstName, lastName, email } = normalizeRegistrationIdentity(identity);

  const player = await Player.findOne({ firstName, lastName, email }).select("_id");
  if (!player) return null;

  const hasEntry = await QueueEntry.exists({
    gameId,
    playerId: player._id,
  });
  if (!hasEntry) return null;

  return player;
}
