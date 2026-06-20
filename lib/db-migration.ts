import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Types, type Model } from "mongoose";

import mongoose from "mongoose";

import { connectToDatabase, resolveDatabaseName } from "@/lib/db";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { OrganizerBlockedPlayer } from "@/models/OrganizerBlockedPlayer";
import { OrganizerNotification } from "@/models/OrganizerNotification";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";
import { Volunteer } from "@/models/Volunteer";

export const MIGRATIONS_DIR = "migrations";

export const MIGRATION_MANIFEST_FILE = "manifest.json";

export const MIGRATION_FORMAT_VERSION = 1;

type MigrationCollection = {
  key: string;
  model: Model<unknown>;
};

/** Insert order respects ObjectId / game references between collections. */
export const MIGRATION_COLLECTIONS: MigrationCollection[] = [
  { key: "users", model: User as Model<unknown> },
  { key: "players", model: Player as Model<unknown> },
  { key: "picklegames", model: PickleGame as Model<unknown> },
  { key: "queueentries", model: QueueEntry as Model<unknown> },
  { key: "courts", model: Court as Model<unknown> },
  { key: "matchhistories", model: MatchHistory as Model<unknown> },
  { key: "leaderboardstats", model: LeaderboardStats as Model<unknown> },
  { key: "volunteers", model: Volunteer as Model<unknown> },
  { key: "organizernotifications", model: OrganizerNotification as Model<unknown> },
  { key: "organizerblockedplayers", model: OrganizerBlockedPlayer as Model<unknown> },
];

export type MigrationScope = "database" | "collection" | "database-raw";

export type MigrationManifest = {
  formatVersion: number;
  scope: MigrationScope;
  label: string;
  exportedAt: string;
  dbName: string;
  counts: Record<string, number>;
};

export type CollectionMigrationManifest = {
  formatVersion: number;
  scope: "collection";
  collection: string;
  label: string;
  exportedAt: string;
  dbName: string;
  count: number;
};

export type RawDatabaseMigrationManifest = {
  formatVersion: number;
  scope: "database-raw";
  label: string;
  exportedAt: string;
  dbName: string;
  counts: Record<string, number>;
};

export const MIGRATION_COLLECTION_KEYS = MIGRATION_COLLECTIONS.map((entry) => entry.key);

export function getMigrationCollection(collectionKey: string) {
  const normalized = collectionKey.trim().toLowerCase();
  const entry = MIGRATION_COLLECTIONS.find((item) => item.key === normalized);
  if (!entry) {
    throw new Error(
      `Unknown collection "${collectionKey}". Valid collections:\n${MIGRATION_COLLECTION_KEYS.map((key) => `  - ${key}`).join("\n")}`,
    );
  }
  return entry;
}

export function buildCollectionMigrationFolderName(collectionKey: string, label: string, date = new Date()) {
  return `${getMigrationCollection(collectionKey).key}_${buildMigrationFolderName(label, date)}`;
}

export function sanitizeDatabaseNameForPath(dbName: string) {
  const sanitized = dbName
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return sanitized.slice(0, 48) || "database";
}

export function buildRawDatabaseFolderName(dbName: string, label: string, date = new Date()) {
  return `db_${sanitizeDatabaseNameForPath(dbName)}_${buildMigrationFolderName(label, date)}`;
}

function isSystemCollectionName(name: string) {
  return name.startsWith("system.");
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatMigrationTimestamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export function sanitizeMigrationLabel(label: string) {
  const trimmed = label.trim().replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return trimmed.replace(/^-|-$/g, "").slice(0, 48) || "backup";
}

export function buildMigrationFolderName(label: string, date = new Date()) {
  return `${sanitizeMigrationLabel(label)}_${formatMigrationTimestamp(date)}`;
}

export function getMigrationsRoot() {
  return path.join(process.cwd(), MIGRATIONS_DIR);
}

export function resolveMigrationDirectory(id: string) {
  const root = getMigrationsRoot();
  const exact = path.join(root, id);
  if (exact.includes("..")) {
    throw new Error("Invalid migration id.");
  }

  return {
    root,
    exact,
    collectionFile: (key: string) => path.join(exact, `${key}.json`),
    manifestFile: path.join(exact, MIGRATION_MANIFEST_FILE),
  };
}

export async function listMigrationFolders() {
  const root = getMigrationsRoot();
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

export async function findMigrationFolder(id: string) {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const { exact } = resolveMigrationDirectory(trimmed);
  try {
    await readFile(path.join(exact, MIGRATION_MANIFEST_FILE), "utf8");
    return exact;
  } catch {
    // fall through
  }

  const folders = await listMigrationFolders();
  const matches = folders.filter(
    (folder) => folder === trimmed || folder.startsWith(`${trimmed}_`) || folder.includes(trimmed),
  );

  if (matches.length === 1) return path.join(getMigrationsRoot(), matches[0]);
  if (matches.length > 1) {
    throw new Error(
      `Multiple migration folders match "${trimmed}". Use the full folder name:\n${matches.map((name) => `  - ${name}`).join("\n")}`,
    );
  }

  return null;
}

function migrationReviver(_key: string, value: unknown) {
  if (value && typeof value === "object" && "$oid" in value) {
    return new Types.ObjectId(String((value as { $oid: string }).$oid));
  }
  if (value && typeof value === "object" && "$date" in value) {
    return new Date(String((value as { $date: string }).$date));
  }
  return value;
}

function toMigrationJsonValue(value: unknown): unknown {
  if (value instanceof Types.ObjectId) {
    return { $oid: value.toString() };
  }
  if (value instanceof Date) {
    return { $date: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toMigrationJsonValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toMigrationJsonValue(entry),
      ]),
    );
  }
  return value;
}

export function coerceMigrationObjectId(value: unknown): Types.ObjectId | null {
  if (value == null || value === "") return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === "string" && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  if (value && typeof value === "object" && "$oid" in value) {
    const id = String((value as { $oid: string }).$oid);
    return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
  }
  return null;
}

function coerceMigrationObjectIdArray(value: unknown): Types.ObjectId[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => coerceMigrationObjectId(entry))
    .filter((entry): entry is Types.ObjectId => entry != null);
}

function assignObjectIdField(doc: Record<string, unknown>, field: string) {
  const id = coerceMigrationObjectId(doc[field]);
  if (id) {
    doc[field] = id;
    return true;
  }
  delete doc[field];
  return false;
}

function normalizeCourtTeam(team: unknown) {
  if (!team || typeof team !== "object") {
    return { playerIds: [], queueEntryIds: [] };
  }

  const value = team as Record<string, unknown>;
  return {
    ...value,
    playerIds: coerceMigrationObjectIdArray(value.playerIds),
    queueEntryIds: coerceMigrationObjectIdArray(value.queueEntryIds),
  };
}

type PrepareResult = {
  documents: Record<string, unknown>[];
  skipped: string[];
};

function prepareMigrationDocuments(key: string, documents: Record<string, unknown>[]): PrepareResult {
  const skipped: string[] = [];

  const prepared = documents.flatMap((document, index) => {
    const doc = { ...document };

    switch (key) {
      case "users":
      case "players":
        assignObjectIdField(doc, "_id");
        break;
      case "picklegames": {
        assignObjectIdField(doc, "_id");
        const hasOwner = assignObjectIdField(doc, "ownerId");
        doc.allowQrRegistration ??= true;
        doc.allowManualPlayerAdd ??= false;
        doc.strictPlayerCount ??= false;
        doc.registrationMode ??= "self";
        doc.status ??= "active";
        if (!hasOwner) {
          skipped.push(
            `picklegames[${index}] gameId=${String(doc.gameId ?? "unknown")} missing ownerId`,
          );
          return [];
        }
        break;
      }
      case "queueentries":
        assignObjectIdField(doc, "_id");
        if (!assignObjectIdField(doc, "playerId")) {
          skipped.push(`queueentries[${index}] missing playerId`);
          return [];
        }
        doc.status ??= "queued";
        doc.queueType ??= "normal";
        doc.lastMatchResult ??= "none";
        break;
      case "courts":
        assignObjectIdField(doc, "_id");
        doc.teamA = normalizeCourtTeam(doc.teamA);
        doc.teamB = normalizeCourtTeam(doc.teamB);
        doc.status ??= "empty";
        doc.isRematch ??= false;
        break;
      case "matchhistories":
        assignObjectIdField(doc, "_id");
        doc.teamAPlayerIds = coerceMigrationObjectIdArray(doc.teamAPlayerIds);
        doc.teamBPlayerIds = coerceMigrationObjectIdArray(doc.teamBPlayerIds);
        break;
      case "leaderboardstats":
        assignObjectIdField(doc, "_id");
        if (!assignObjectIdField(doc, "playerId")) {
          skipped.push(`leaderboardstats[${index}] missing playerId`);
          return [];
        }
        break;
      case "volunteers":
        assignObjectIdField(doc, "_id");
        if (!assignObjectIdField(doc, "playerId")) {
          skipped.push(`volunteers[${index}] missing playerId`);
          return [];
        }
        break;
      case "organizernotifications":
        assignObjectIdField(doc, "_id");
        if (!assignObjectIdField(doc, "playerId")) {
          skipped.push(`organizernotifications[${index}] missing playerId`);
          return [];
        }
        break;
      case "organizerblockedplayers":
        assignObjectIdField(doc, "_id");
        if (!assignObjectIdField(doc, "ownerId")) {
          skipped.push(`organizerblockedplayers[${index}] missing ownerId`);
          return [];
        }
        break;
      default:
        assignObjectIdField(doc, "_id");
        break;
    }

    return [doc];
  });

  return { documents: prepared, skipped };
}

export function serializeMigrationDocuments(documents: Record<string, unknown>[]) {
  return JSON.stringify(documents.map((document) => toMigrationJsonValue(document)), null, 2);
}

export function parseMigrationDocuments(raw: string) {
  return JSON.parse(raw, migrationReviver) as Record<string, unknown>[];
}

export async function exportDatabase(label: string, options?: { dbName?: string }) {
  const dbName = resolveDatabaseName(options?.dbName);
  await connectToDatabase(dbName);

  const folderName = buildMigrationFolderName(label);
  const folderPath = path.join(getMigrationsRoot(), folderName);
  await mkdir(folderPath, { recursive: true });

  const counts: Record<string, number> = {};
  for (const { key, model } of MIGRATION_COLLECTIONS) {
    const documents = await model.find().lean();
    counts[key] = documents.length;
    const filePath = path.join(folderPath, `${key}.json`);
    await writeFile(filePath, serializeMigrationDocuments(documents), "utf8");
  }

  const manifest: MigrationManifest = {
    formatVersion: MIGRATION_FORMAT_VERSION,
    scope: "database",
    label: sanitizeMigrationLabel(label),
    exportedAt: new Date().toISOString(),
    dbName,
    counts,
  };

  await writeFile(
    path.join(folderPath, MIGRATION_MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return { folderName, folderPath, manifest };
}

async function countAllDocuments() {
  const counts = await Promise.all(
    MIGRATION_COLLECTIONS.map(async ({ model }) => model.countDocuments()),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

export async function restoreDatabase(
  folderId: string,
  options?: { force?: boolean; dbName?: string },
) {
  const folderPath = await findMigrationFolder(folderId);
  if (!folderPath) {
    throw new Error(`Migration folder not found for "${folderId}".`);
  }

  const manifestRaw = await readFile(path.join(folderPath, MIGRATION_MANIFEST_FILE), "utf8");
  const manifest = JSON.parse(manifestRaw) as MigrationManifest | RawDatabaseMigrationManifest;

  if (manifest.formatVersion !== MIGRATION_FORMAT_VERSION) {
    throw new Error(
      `Unsupported migration format version ${manifest.formatVersion}. Expected ${MIGRATION_FORMAT_VERSION}.`,
    );
  }

  if (manifest.scope === "collection") {
    throw new Error(
      `This backup is a single-collection export. Use:\n  npm run db:restore:collection -- ${folderId} --force`,
    );
  }

  if (manifest.scope === "database-raw") {
    throw new Error(
      `This backup is a raw database export. Use:\n  npm run db:restore:database -- ${folderId} --force`,
    );
  }

  const dbName = resolveDatabaseName(options?.dbName ?? manifest.dbName);
  await connectToDatabase(dbName);

  const existingDocuments = await countAllDocuments();
  if (existingDocuments > 0 && !options?.force) {
    throw new Error(
      `Target database is not empty (${existingDocuments} documents). Re-run with --force to replace all data.`,
    );
  }

  for (const { key, model } of [...MIGRATION_COLLECTIONS].reverse()) {
    await model.deleteMany({});
  }

  const restoredCounts: Record<string, number> = {};
  const skippedDocuments: string[] = [];
  for (const { key, model } of MIGRATION_COLLECTIONS) {
    const filePath = path.join(folderPath, `${key}.json`);
    const raw = await readFile(filePath, "utf8");
    const parsed = parseMigrationDocuments(raw);
    const { documents, skipped } = prepareMigrationDocuments(key, parsed);
    skippedDocuments.push(...skipped);
    if (documents.length > 0) {
      await model.insertMany(documents, { ordered: true });
    }
    restoredCounts[key] = documents.length;
  }

  return { folderPath, manifest, restoredCounts, skippedDocuments };
}

export async function exportCollection(
  collectionKey: string,
  label = "backup",
  options?: { dbName?: string },
) {
  const dbName = resolveDatabaseName(options?.dbName);
  await connectToDatabase(dbName);

  const { key, model } = getMigrationCollection(collectionKey);
  const folderName = buildCollectionMigrationFolderName(key, label);
  const folderPath = path.join(getMigrationsRoot(), folderName);
  await mkdir(folderPath, { recursive: true });

  const documents = await model.find().lean();
  await writeFile(
    path.join(folderPath, `${key}.json`),
    serializeMigrationDocuments(documents),
    "utf8",
  );

  const manifest: CollectionMigrationManifest = {
    formatVersion: MIGRATION_FORMAT_VERSION,
    scope: "collection",
    collection: key,
    label: sanitizeMigrationLabel(label),
    exportedAt: new Date().toISOString(),
    dbName,
    count: documents.length,
  };

  await writeFile(
    path.join(folderPath, MIGRATION_MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return { folderName, folderPath, manifest };
}

export async function exportRawDatabase(
  dbNameInput: string,
  label = "backup",
  options?: { includeEmpty?: boolean },
) {
  const dbName = resolveDatabaseName(dbNameInput);
  await connectToDatabase(dbName);

  const db = mongoose.connection.getClient().db(dbName);
  const folderName = buildRawDatabaseFolderName(dbName, label);
  const folderPath = path.join(getMigrationsRoot(), folderName);
  await mkdir(folderPath, { recursive: true });

  const counts: Record<string, number> = {};
  const skippedEmptyCollections: string[] = [];
  const collectionInfos = await db.listCollections().toArray();

  for (const info of collectionInfos) {
    const collectionName = info.name;
    if (isSystemCollectionName(collectionName)) continue;

    const documentCount = await db.collection(collectionName).countDocuments();
    if (documentCount === 0 && !options?.includeEmpty) {
      skippedEmptyCollections.push(collectionName);
      continue;
    }

    const documents =
      documentCount === 0
        ? []
        : await db.collection(collectionName).find().toArray();
    counts[collectionName] = documents.length;
    await writeFile(
      path.join(folderPath, `${collectionName}.json`),
      serializeMigrationDocuments(documents as Record<string, unknown>[]),
      "utf8",
    );
  }

  const manifest: RawDatabaseMigrationManifest = {
    formatVersion: MIGRATION_FORMAT_VERSION,
    scope: "database-raw",
    label: sanitizeMigrationLabel(label),
    exportedAt: new Date().toISOString(),
    dbName,
    counts,
  };

  await writeFile(
    path.join(folderPath, MIGRATION_MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return { folderName, folderPath, manifest, skippedEmptyCollections };
}

export async function restoreCollection(folderId: string, options?: { force?: boolean }) {
  const folderPath = await findMigrationFolder(folderId);
  if (!folderPath) {
    throw new Error(`Migration folder not found for "${folderId}".`);
  }

  const manifestRaw = await readFile(path.join(folderPath, MIGRATION_MANIFEST_FILE), "utf8");
  const manifest = JSON.parse(manifestRaw) as CollectionMigrationManifest | MigrationManifest;

  if (manifest.formatVersion !== MIGRATION_FORMAT_VERSION) {
    throw new Error(
      `Unsupported migration format version ${manifest.formatVersion}. Expected ${MIGRATION_FORMAT_VERSION}.`,
    );
  }

  if (manifest.scope !== "collection") {
    throw new Error(
      `This backup is a full-database export. Use:\n  npm run db:restore -- ${folderId} --force`,
    );
  }

  const collectionManifest = manifest as CollectionMigrationManifest;
  const { key, model } = getMigrationCollection(collectionManifest.collection);
  await connectToDatabase();

  const existingDocuments = await model.countDocuments();
  if (existingDocuments > 0 && !options?.force) {
    throw new Error(
      `Target collection "${key}" is not empty (${existingDocuments} documents). Re-run with --force to replace it.`,
    );
  }

  await model.deleteMany({});

  const filePath = path.join(folderPath, `${key}.json`);
  const raw = await readFile(filePath, "utf8");
  const parsed = parseMigrationDocuments(raw);
  const { documents, skipped } = prepareMigrationDocuments(key, parsed);

  if (documents.length > 0) {
    await model.insertMany(documents, { ordered: true });
  }

  return {
    folderPath,
    manifest: collectionManifest,
    restoredCount: documents.length,
    skippedDocuments: skipped,
  };
}

async function countRawDatabaseDocuments(dbName: string, collectionNames: string[]) {
  const db = mongoose.connection.getClient().db(dbName);
  const counts = await Promise.all(
    collectionNames.map((name) => db.collection(name).countDocuments()),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

function documentSortTime(doc: Record<string, unknown>) {
  const value = doc.updatedAt ?? doc.createdAt;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function dedupeRawDocuments(collectionName: string, documents: Record<string, unknown>[]) {
  const skippedDuplicates: string[] = [];

  if (collectionName === "users") {
    const byEmail = new Map<string, Record<string, unknown>>();
    for (const doc of documents) {
      const email = String(doc.email ?? "")
        .trim()
        .toLowerCase();
      if (!email) {
        skippedDuplicates.push(`users missing email (_id ${String(doc._id ?? "unknown")})`);
        continue;
      }

      const existing = byEmail.get(email);
      if (!existing) {
        byEmail.set(email, doc);
        continue;
      }

      const keepCurrent = documentSortTime(doc) >= documentSortTime(existing);
      const droppedId = String((keepCurrent ? existing : doc)._id ?? "unknown");
      skippedDuplicates.push(`users duplicate email ${email} (dropped _id ${droppedId})`);
      byEmail.set(email, keepCurrent ? doc : existing);
    }

    return { documents: [...byEmail.values()], skippedDuplicates };
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const doc of documents) {
    const id = String(doc._id ?? "");
    if (!id) {
      skippedDuplicates.push(`${collectionName} missing _id`);
      continue;
    }
    if (byId.has(id)) {
      skippedDuplicates.push(`${collectionName} duplicate _id ${id}`);
      continue;
    }
    byId.set(id, doc);
  }

  return { documents: [...byId.values()], skippedDuplicates };
}

export async function restoreRawDatabase(
  folderId: string,
  options?: { force?: boolean; dbName?: string },
) {
  const folderPath = await findMigrationFolder(folderId);
  if (!folderPath) {
    throw new Error(`Migration folder not found for "${folderId}".`);
  }

  const manifestRaw = await readFile(path.join(folderPath, MIGRATION_MANIFEST_FILE), "utf8");
  const manifest = JSON.parse(manifestRaw) as RawDatabaseMigrationManifest | MigrationManifest;

  if (manifest.formatVersion !== MIGRATION_FORMAT_VERSION) {
    throw new Error(
      `Unsupported migration format version ${manifest.formatVersion}. Expected ${MIGRATION_FORMAT_VERSION}.`,
    );
  }

  if (manifest.scope !== "database-raw") {
    throw new Error(
      `This backup is not a raw database export. Use db:restore or db:restore:collection instead.`,
    );
  }

  const rawManifest = manifest as RawDatabaseMigrationManifest;
  const dbName = resolveDatabaseName(options?.dbName ?? rawManifest.dbName);
  await connectToDatabase(dbName);

  const db = mongoose.connection.getClient().db(dbName);

  const collectionNames = Object.keys(rawManifest.counts);
  const existingDocuments = await countRawDatabaseDocuments(dbName, collectionNames);
  if (existingDocuments > 0 && !options?.force) {
    throw new Error(
      `Target database "${dbName}" already has ${existingDocuments} documents in exported collections. Re-run with --force to replace them.`,
    );
  }

  const restoredCounts: Record<string, number> = {};
  const skippedDuplicates: string[] = [];
  for (const collectionName of collectionNames) {
    await db.collection(collectionName).deleteMany({});
    const filePath = path.join(folderPath, `${collectionName}.json`);
    const raw = await readFile(filePath, "utf8");
    const parsed = parseMigrationDocuments(raw);
    const { documents, skippedDuplicates: collectionSkipped } = dedupeRawDocuments(
      collectionName,
      parsed,
    );
    skippedDuplicates.push(...collectionSkipped);

    if (documents.length > 0) {
      await db.collection(collectionName).insertMany(documents, { ordered: true });
    }
    restoredCounts[collectionName] = documents.length;
  }

  return {
    folderPath,
    manifest: rawManifest,
    dbName,
    restoredCounts,
    skippedDuplicates,
  };
}
