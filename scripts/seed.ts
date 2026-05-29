import { Types } from "mongoose";
import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { connectToDatabase } from "@/lib/db";
import { Court } from "@/models/Court";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";

async function seed() {
  await connectToDatabase();

  const gameId = "demo-queue";
  const demoQrPrefix = "P-demo-";
  const demoEmail = "demo-admin@ccf.local";
  await Promise.all([
    PickleGame.deleteMany({ gameId }),
    Court.deleteMany({ gameId }),
    QueueEntry.deleteMany({ gameId }),
    Player.deleteMany({ personalQrCode: { $regex: `^${demoQrPrefix}` } }),
  ]);

  let owner = await User.findOne({ email: demoEmail });
  if (!owner) {
    owner = await User.create({
      name: "Demo Admin",
      email: demoEmail,
      passwordHash: await bcrypt.hash("password123", 10),
    });
  }

  const initialPlayersCount = 18;

  const game = await PickleGame.create({
    title: "Demo Open Play",
    gameId,
    ownerId: owner._id,
    openPlayType: "Intermediate",
    courtCount: 3,
    expectedPlayers: initialPlayersCount,
    publicQrCodeDataUrl: "data:image/png;base64,demo",
  });

  await Court.create([{ gameId, courtNumber: 1 }, { gameId, courtNumber: 2 }, { gameId, courtNumber: 3 }]);

  const players = await Player.create(
    Array.from({ length: initialPlayersCount }, (_, index) => ({
      firstName: "Rank",
      lastName: String(index + 1),
      mobileNumber: `091700000${index}`,
      email: `player${index + 1}@example.com`,
      personalQrCode: `${demoQrPrefix}${index + 1}`,
      firstTimeSportsMinistry: false,
      isPartOfDgroup: index % 2 === 0,
      attendedEvents: ["Sunday Service"],
    }))
  );

  await QueueEntry.create(
    players.map((player: { _id: Types.ObjectId }, index: number) => ({
      gameId,
      playerId: player._id,
      registeredAt: new Date(Date.now() + index * 1000),
    }))
  );

  console.log(`Seeded game ${game.gameId} with ${players.length} players.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
