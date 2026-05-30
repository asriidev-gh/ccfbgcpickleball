import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { connectToDatabase } from "@/lib/db";
import { createTestGame } from "@/lib/test-game";
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

  // Resolve the demo owner first so all cleanup stays scoped to this account only.
  let owner = await User.findOne({ email: demoEmail });
  if (!owner) {
    owner = await User.create({
      name: "Demo Admin",
      email: demoEmail,
      passwordHash: await bcrypt.hash("password123", 10),
      userType: "ccf",
    });
  }

  // Only remove demo data owned by demo-admin@ccf.local — never touch other accounts.
  const ownedGames = await PickleGame.find({ ownerId: owner._id }).select("gameId");
  const ownedGameIds = ownedGames.map((g: { gameId: string }) => g.gameId);
  await Promise.all([
    PickleGame.deleteMany({ ownerId: owner._id }),
    Court.deleteMany({ gameId: { $in: ownedGameIds } }),
    QueueEntry.deleteMany({ gameId: { $in: ownedGameIds } }),
    Player.deleteMany({ personalQrCode: { $regex: `^${demoQrPrefix}` } }),
  ]);

  const { game, registerUrl, playerCount } = await createTestGame({
    ownerId: owner._id,
    gameId,
    title: "Demo Open Play",
    qrPrefix: demoQrPrefix,
  });

  console.log(`Seeded game ${game.gameId} with ${playerCount} players.`);
  console.log(`Registration URL: ${registerUrl}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
