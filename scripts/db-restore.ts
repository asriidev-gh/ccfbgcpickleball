import "./load-script-env";

import { disconnectFromDatabase } from "@/lib/db";
import { findMigrationFolder, listMigrationFolders, restoreDatabase } from "@/lib/db-migration";
import { parseMigrationCliArgs } from "@/scripts/parse-migration-cli";

function printUsage() {
  console.log("Usage:");
  console.log("  npm run db:restore -- <migration-folder-name> [--force] [--db <database-name>]");
  console.log("");
  console.log("Examples:");
  console.log("  npm run db:restore -- ccf_2026-06-11_22-30-45 --force");
  console.log("  npm run db:restore -- ccf_2026-06-11_22-30-45 --force --db other_database");
  console.log("");
  console.log("Note: the `--` is required so npm forwards --force to the script.");
}

async function main() {
  const { force, dbName, positional } = parseMigrationCliArgs(process.argv);
  const folderId = positional[0]?.trim();

  if (!folderId) {
    printUsage();
    const folders = await listMigrationFolders();
    if (folders.length > 0) {
      console.log("\nAvailable migrations:");
      for (const name of folders) {
        console.log(`  - ${name}`);
      }
    } else {
      console.log("\nNo migrations found. Create one with:\n  npm run db:export [label]");
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

  const { folderPath, manifest, restoredCounts, skippedDocuments } = await restoreDatabase(
    folderId,
    { force, dbName },
  );

  console.log(`Database restored from: ${folderPath}`);
  console.log(`Exported at: ${manifest.exportedAt}`);
  console.log(`Database: ${manifest.dbName}`);
  console.log("Restored counts:");
  for (const [collection, count] of Object.entries(restoredCounts)) {
    console.log(`  ${collection}: ${count}`);
  }
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
