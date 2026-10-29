import type {
  SpectatePlayerEndorsementReceived,
  SpectatePlayerEndorsementSummary,
} from "@/lib/spectate-player-endorsement";
import type { PlayerEndorsementBadge } from "@/lib/player-endorsement-shared";

export function spectatePlayerEndorsementsQueryKey(gameId: string, endorserPlayerId: string) {
  return ["spectate-player-endorsements", gameId, endorserPlayerId] as const;
}

export function spectateGameEndorsementCountsQueryKey(gameId: string) {
  return ["spectate-game-endorsement-counts", gameId] as const;
}

export function spectatePlayerEndorsementsReceivedQueryKey(
  gameId: string,
  endorsedPlayerId: string,
) {
  return ["spectate-player-endorsements-received", gameId, endorsedPlayerId] as const;
}

export async function fetchSpectatePlayerEndorsements(gameId: string, endorserPlayerId: string) {
  const response = await fetch(
    `/api/games/${gameId}/spectate/player/endorsement?endorserPlayerId=${encodeURIComponent(endorserPlayerId)}`,
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to load endorsements.");
  }
  return (data.endorsements ?? []) as SpectatePlayerEndorsementSummary[];
}

export function spectateEndorsedIdentitiesQueryKey(gameId: string, endorserPlayerId: string) {
  return ["spectate-endorsed-identities", gameId, endorserPlayerId] as const;
}

/** Identity keys of everyone this player has endorsed in any session, not just this one. */
export async function fetchSpectateEndorsedIdentities(gameId: string, endorserPlayerId: string) {
  const response = await fetch(
    `/api/games/${gameId}/spectate/player/endorsement?endorserPlayerId=${encodeURIComponent(endorserPlayerId)}&endorsedIdentities=1`,
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to load endorsements.");
  }
  return (data.identityKeys ?? []) as string[];
}

export async function fetchSpectateGameEndorsementCounts(gameId: string) {
  const response = await fetch(`/api/games/${gameId}/spectate/player/endorsement?counts=1`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to load endorsement counts.");
  }
  return (data.counts ?? {}) as Record<string, number>;
}

export async function fetchSpectatePlayerEndorsementsReceived(
  gameId: string,
  endorsedPlayerId: string,
) {
  const response = await fetch(
    `/api/games/${gameId}/spectate/player/endorsement?endorsedPlayerId=${encodeURIComponent(endorsedPlayerId)}&received=1`,
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to load endorsements.");
  }
  return (data.endorsements ?? []) as SpectatePlayerEndorsementReceived[];
}

export async function submitSpectatePlayerEndorsement(input: {
  gameId: string;
  endorserPlayerId: string;
  endorsedPlayerId: string;
  badges: PlayerEndorsementBadge[];
  notes?: string;
}) {
  const response = await fetch(`/api/games/${input.gameId}/spectate/player/endorsement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to submit endorsement.");
  }
  return data as { message: string };
}
