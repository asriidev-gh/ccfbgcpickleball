import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";

export type QrUploadGameContext = {
  gameOwnerUserType: string | null;
  isPlayerGameOwner: boolean;
};

export async function resolveQrUploadGameContext(
  gameId: string,
  playerEmail: string,
): Promise<QrUploadGameContext> {
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean();
  if (!game?.ownerId) {
    return { gameOwnerUserType: null, isPlayerGameOwner: false };
  }

  const owner = await User.findById(game.ownerId).select("email userType").lean();
  const normalizedPlayerEmail = playerEmail.trim().toLowerCase();
  return {
    gameOwnerUserType: owner?.userType ?? null,
    isPlayerGameOwner: owner?.email === normalizedPlayerEmail,
  };
}
