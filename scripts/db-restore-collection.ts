import "./load-script-env";

import { disconnectFromDatabase } from "@/lib/db";
import {
  findMigrationFolder,
  listMigrationFolders,
  MIGRATION_COLLECTION_KEYS,
  restoreCollection,
} from "@/lib/db-migration";

function printUsage() {
  console.log("Usage:");
  console.log("  npm run db:restore:collection -- <migration-folder-name> [--force]");
  console.log("");
  console.log("Example:");
  console.log("  npm run db:restore:collection -- players_roster-backup_2026-06-11_22-30-45 --force");
  console.log("");
  console.log("Note: the `--` is required so npm forwards --force to the script.");
  console.log("");
  console.log("Valid collections:");
  for (const key of MIGRATION_COLLECTION_KEYS) {
    console.log(`  - ${key}`);
  }
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const force = args.includes("--force");
  const folderId = args.find((arg) => arg !== "--force")?.trim();

  if (!folderId) {
    printUsage();
    const folders = await listMigrationFolders();
    const collectionFolders = folders.filter((name) =>
      MIGRATION_COLLECTION_KEYS.some((key) => name.startsWith(`${key}_`)),
    );
    if (collectionFolders.length > 0) {
      console.log("\nAvailable collection exports:");
      for (const name of collectionFolders) {
        console.log(`  - ${name}`);
      }
    } else {
      console.log("\nNo collection exports found. Create one with:");
      console.log("  npm run db:export:collection -- players");
    }
    process.exit(1);
  }

  const resolved = await findMigrationFolder(folderId);
  if (!resolved) {
    const folders = await listMigrationFolders();
    console.error(`Migration folder not found for "${folderId}".`);
    if (folders.length > 0) {
      console.error("\nAvailable migrations:");
      for (const name of folders) {
        console.error(`  - ${name}`);
      }
    }
    process.exit(1);
  }

  const { folderPath, manifest, restoredCount, skippedDocuments } = await restoreCollection(
    folderId,
    { force },
  );

  console.log(`Collection restored from: ${folderPath}`);
  console.log(`Collection: ${manifest.collection}`);
  console.log(`Exported at: ${manifest.exportedAt}`);
  console.log(`Database: ${manifest.dbName}`);
  console.log(`Restored documents: ${restoredCount}`);
  if (skippedDocuments.length > 0) {
    console.log("\nSkipped invalid records:");
    for (const message of skippedDocuments) {
      console.log(`  - ${message}`);
    }
  }
}

main()
  .then(async () => {
    await disconnectFromDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await disconnectFromDatabase().catch(() => {});
    process.exit(1);
  });
