import type { Types } from "mongoose";
import { nanoid } from "nanoid";

import type { OpenPlayType } from "@/lib/open-play-types";
import { buildGameRegistrationQr } from "@/lib/game-qr";
import { Court } from "@/models/Court";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

const FIRST_NAMES = [
  "James", "Maria", "John", "Anna", "Michael", "Grace", "David", "Sophia",
  "Daniel", "Olivia", "Joshua", "Hannah", "Mark", "Bianca", "Paul", "Isabella",
  "Carlo", "Patricia", "Miguel", "Andrea", "Rafael", "Camille", "Nathan", "Diana",
  "Gabriel", "Trisha", "Vincent", "Angelica", "Christian", "Nicole", "Joseph", "Kaye",
];

const LAST_NAMES = [
  "Santos", "Reyes", "Cruz", "Garcia", "Mendoza", "Torres", "Flores", "Ramos",
  "Gonzales", "Bautista", "Villanueva", "Aquino", "Castillo", "Navarro", "Salazar",
  "Domingo", "Fernandez", "Pascual", "Delos Reyes", "Tan", "Lim", "Sy", "Co", "Ong",
  "Rivera", "Aguilar", "Velasco", "Mercado", "Galang", "Soriano", "Espiritu", "Manalo",
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generatePlayerNames(count: number) {
  const firstNames = shuffle(FIRST_NAMES);
  const lastNames = shuffle(LAST_NAMES);
  const usedNames = new Set<string>();
  const usedEmails = new Set<string>();
  const result: { firstName: string; lastName: string; email: string }[] = [];

  let attempts = 0;
  while (result.length < count) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${firstName} ${lastName}`;
    attempts += 1;

    if (usedNames.has(fullName) && attempts < count * 20) continue;
    usedNames.add(fullName);

    const base = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, "");
    let email = `${base}@example.com`;
    let suffix = 2;
    while (usedEmails.has(email)) {
      email = `${base}${suffix}@example.com`;
      suffix += 1;
    }
    usedEmails.add(email);

    result.push({ firstName, lastName, email });
  }

  return result;
}

type CreateTestGameOptions = {
  ownerId: string | Types.ObjectId;
  gameId?: string;
  title?: string;
  openPlayType?: OpenPlayType;
  courtCount?: number;
  playerCount?: number;
  qrPrefix?: string;
};

/**
 * Creates a fully populated demo/test game (game, courts, players, queue) for the
 * given owner. Used by both the seed script and the in-app "Generate Test Game"
 * button. Player QR codes embed a unique run id so repeat runs never collide.
 */
export async function createTestGame(options: CreateTestGameOptions) {
  const gameId = options.gameId ?? nanoid(10);
  const title = options.title ?? "Test Open Play";
  const openPlayType = options.openPlayType ?? "Intermediate";
  const courtCount = options.courtCount ?? 3;
  const playerCount = options.playerCount ?? 18;
  const qrPrefix = options.qrPrefix ?? "P-test-";
  const runId = nanoid(8);

  const { registerUrl, publicQrCodeDataUrl } = await buildGameRegistrationQr(gameId);

  const game = await PickleGame.create({
    title,
    gameId,
    ownerId: options.ownerId,
    openPlayType,
    courtCount,
    expectedPlayers: playerCount,
    registerUrl,
    publicQrCodeDataUrl,
  });

  await Court.create(
    Array.from({ length: courtCount }, (_, index) => ({
      gameId,
      courtNumber: index + 1,
    })),
  );

  const names = generatePlayerNames(playerCount);
  const players = await Player.create(
    names.map((person, index) => ({
      firstName: person.firstName,
      lastName: person.lastName,
      mobileNumber: `09170${String(index).padStart(6, "0")}`,
      email: person.email,
      personalQrCode: `${qrPrefix}${runId}-${index + 1}`,
      firstTimeSportsMinistry: false,
      isPartOfDgroup: index % 2 === 0,
      attendedEvents: ["Sunday Service"],
    })),
  );

  await QueueEntry.create(
    players.map((player: { _id: Types.ObjectId }, index: number) => ({
      gameId,
      playerId: player._id,
      registeredAt: new Date(Date.now() + index * 1000),
    })),
  );

  return { game, registerUrl, playerCount: players.length };
}
