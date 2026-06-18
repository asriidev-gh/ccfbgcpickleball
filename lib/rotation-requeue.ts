import { QueueEntry } from "@/models/QueueEntry";

export {
  buildRotationRequeuePlayerOrder,
  isRotationQueueState,
  shouldUseRotationRequeue,
  type RotationCourtPlayers,
} from "@/lib/rotation-requeue-shared";

export async function countActiveRotationPlayers(gameId: string) {
  const playerIds = await QueueEntry.distinct("playerId", {
    gameId,
    status: { $in: ["queued", "on_court"] },
  });
  return playerIds.length;
}
