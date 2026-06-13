import { connectToDatabase } from "@/lib/db";
import { isCcfUserType, USER_TYPE_DEFAULT } from "@/lib/registration-variant";
import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";

export class CcfMinistryFeaturesError extends Error {
  status: number;

  constructor(
    message = "D-group and prayer requests are only available for CCF accounts.",
    status = 403,
  ) {
    super(message);
    this.status = status;
  }
}

export async function getOwnerUserType(ownerId: string) {
  await connectToDatabase();
  const owner = await User.findById(ownerId).select("userType").lean<{ userType?: string }>();
  return typeof owner?.userType === "string" ? owner.userType : USER_TYPE_DEFAULT;
}

export async function ownerHasCcfMinistryFeatures(ownerId: string) {
  return isCcfUserType(await getOwnerUserType(ownerId));
}

export async function assertOwnerHasCcfMinistryFeatures(ownerId: string) {
  if (!(await ownerHasCcfMinistryFeatures(ownerId))) {
    throw new CcfMinistryFeaturesError();
  }
}

export async function resolveGameShowsCcfMinistryFeatures(gameId: string) {
  await connectToDatabase();
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean<{ ownerId?: { toString(): string } }>();
  if (!game?.ownerId) return false;
  return ownerHasCcfMinistryFeatures(String(game.ownerId));
}

export async function assertGameShowsCcfMinistryFeatures(gameId: string) {
  if (!(await resolveGameShowsCcfMinistryFeatures(gameId))) {
    throw new CcfMinistryFeaturesError(
      "D-group and prayer requests are not available for this open play.",
    );
  }
}
