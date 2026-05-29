import { getRegistrationFormVariant, type RegistrationFormVariant } from "@/lib/registration-variant";
import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";

export async function resolveGameRegistrationFormVariant(
  gameId: string,
): Promise<RegistrationFormVariant | null> {
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean();
  if (!game) return null;

  const owner = await User.findById(game.ownerId).select("userType").lean();
  const userType =
    owner && typeof owner === "object" && typeof owner.userType === "string"
      ? owner.userType
      : undefined;

  return getRegistrationFormVariant(userType);
}
