import "./load-script-env";

import { disconnectFromDatabase } from "@/lib/db";
import { findMigrationFolder, listMigrationFolders, restoreRawDatabase } from "@/lib/db-migration";
import { parseMigrationCliArgs } from "@/scripts/parse-migration-cli";

function printUsage() {
  console.log("Usage:");
  console.log("  npm run db:restore:database -- <migration-folder-name> [--force] [--db <database-name>]");
  console.log("");
  console.log("Examples:");
  console.log("  npm run db:restore:database -- db_ccfpickleball_backup_2026-06-11_22-30-45 --force");
  console.log("  npm run db:restore:database -- db_ccfpickleball_backup_2026-06-11_22-30-45 --force --db other_db");
  console.log("");
  console.log("Note: the `--` is required so npm forwards --force to the script.");
}

async function main() {
  const { force, dbName, positional } = parseMigrationCliArgs(process.argv);
  const folderId = positional[0]?.trim();

  if (!folderId) {
    printUsage();
    const folders = await listMigrationFolders();
    const databaseFolders = folders.filter((name) => name.startsWith("db_"));
    if (databaseFolders.length > 0) {
      console.log("\nAvailable raw database exports:");
      for (const name of databaseFolders) {
        console.log(`  - ${name}`);
      }
    } else {
      console.log("\nNo raw database exports found. Create one with:");
      console.log("  npm run db:export:database -- <database-name>");
    }
    process.exit(1);
  }

  const resolved = await findMigrationFolder(folderId);
  if (!resolved) {
    console.error(`Migration folder not found for "${folderId}".`);
    process.exit(1);
  }

  const { folderPath, manifest, dbName: targetDbName, restoredCounts, skippedDuplicates } =
    await restoreRawDatabase(folderId, { force, dbName });

  console.log(`Database restored from: ${folderPath}`);
  console.log(`Source export database: ${manifest.dbName}`);
  console.log(`Target database: ${targetDbName}`);
  console.log(`Exported at: ${manifest.exportedAt}`);
  console.log("Restored counts:");
  for (const [collection, count] of Object.entries(restoredCounts)) {
    console.log(`  ${collection}: ${count}`);
  }
  if (skippedDuplicates.length > 0) {
    console.log(`\nSkipped ${skippedDuplicates.length} duplicate/invalid records during restore:`);
    for (const message of skippedDuplicates.slice(0, 20)) {
      console.log(`  - ${message}`);
    }
    if (skippedDuplicates.length > 20) {
      console.log(`  - ...and ${skippedDuplicates.length - 20} more`);
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
