import { Types } from "mongoose";

import { deleteRegistrationPhotos } from "@/lib/cloudinary";
import { connectToDatabase } from "@/lib/db";
import { isUploadedPlayerPhoto } from "@/lib/player-avatar-url";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

async function getSiblingPlayerIds(playerId: string): Promise<Types.ObjectId[] | null> {
  const player = await Player.findById(playerId)
    .select("firstName lastName email")
    .lean<{ firstName?: string; lastName?: string; email?: string } | null>();
  if (!player) return null;

  const siblings = await Player.find({
    firstName: player.firstName,
    lastName: player.lastName,
    email: player.email,
  })
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();

  return siblings.map((doc) => doc._id);
}

/** Permanently removes a player (and same name/email records) plus all related data. */
export async function deletePlayerAndRelatedData(playerId: string): Promise<boolean> {
  await connectToDatabase();

  const playerObjectIds = await getSiblingPlayerIds(playerId);
  if (!playerObjectIds || playerObjectIds.length === 0) return false;

  const siblingDocs = await Player.find({ _id: { $in: playerObjectIds } })
    .select("photoUrl photoPublicId")
    .lean<Array<{ photoUrl?: string; photoPublicId?: string }>>();

  const cloudinaryPublicIds = siblingDocs
    .filter((doc) => isUploadedPlayerPhoto(doc))
    .map((doc) => doc.photoPublicId!.trim());

  const queueEntries = await QueueEntry.find({ playerId: { $in: playerObjectIds } }).select("_id");
  const queueEntryIds = queueEntries.map((entry) => entry._id);

  await Promise.all([
    QueueEntry.deleteMany({ playerId: { $in: playerObjectIds } }),
    LeaderboardStats.deleteMany({ playerId: { $in: playerObjectIds } }),
    Volunteer.deleteMany({ playerId: { $in: playerObjectIds } }),
    MatchHistory.deleteMany({
      $or: [
        { teamAPlayerIds: { $in: playerObjectIds } },
        { teamBPlayerIds: { $in: playerObjectIds } },
      ],
    }),
    Court.updateMany(
      {},
      {
        $pull: {
          "teamA.playerIds": { $in: playerObjectIds },
          "teamB.playerIds": { $in: playerObjectIds },
          "teamA.queueEntryIds": { $in: queueEntryIds },
          "teamB.queueEntryIds": { $in: queueEntryIds },
        },
      },
    ),
    Player.deleteMany({ _id: { $in: playerObjectIds } }),
  ]);

  await deleteRegistrationPhotos(cloudinaryPublicIds);

  return true;
}
