import { fetchSpectateGame } from "@/lib/fetch-spectate-game";
import { getActiveQueueHighlightPlayerIds, queueEntryPlayerId, removeActiveQueueHighlightPlayerId } from "@/lib/queue-highlight";
import { confirmSelfQueueCheckoutSwal } from "@/lib/swal-theme";
import { formatPlayerDisplayName } from "@/lib/utils";
import type { QueueEntryView } from "@/components/game/queue-entry-row";

function findQueuedEntryForPlayer(queue: QueueEntryView[], playerId: string) {
  return queue.find((entry) => queueEntryPlayerId(entry) === playerId);
}

export async function confirmAndPerformPlayerSelfCheckout(gameId: string, playerId: string) {
  const live = await fetchSpectateGame(gameId, "live");
  if (live.game.status === "ended") {
    throw new Error("Open play has ended.");
  }

  const entry = findQueuedEntryForPlayer(live.queue, playerId);
  if (!entry) {
    throw new Error("You are not in the queue.");
  }

  const playerName = formatPlayerDisplayName(
    entry.playerId.firstName,
    entry.playerId.lastName,
  );

  const confirmed = await confirmSelfQueueCheckoutSwal(playerName);
  if (!confirmed) {
    return { checkedOut: false as const };
  }

  const selfPlayerIds = getActiveQueueHighlightPlayerIds(gameId);
  const response = await fetch(`/api/games/${gameId}/remove-from-queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      queueEntryId: entry._id,
      selfPlayerId: playerId,
      selfPlayerIds,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to check out.");
  }

  removeActiveQueueHighlightPlayerId(gameId, playerId);

  return { checkedOut: true as const, message: payload.message as string };
}
