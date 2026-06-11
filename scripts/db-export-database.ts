import "./load-script-env";

import { disconnectFromDatabase } from "@/lib/db";
import { exportRawDatabase, listMigrationFolders } from "@/lib/db-migration";
import { parseMigrationCliArgs } from "@/scripts/parse-migration-cli";

function printUsage() {
  console.log("Usage:");
  console.log("  npm run db:export:database -- <database-name> [label]");
  console.log("");
  console.log("Examples:");
  console.log("  npm run db:export:database -- ccfpickleball");
  console.log("  npm run db:export:database -- analytics_db nightly-backup");
  console.log("");
  console.log("Exports collections that contain data in the named database.");
  console.log("Add --include-empty to also export empty collections.");
}

async function main() {
  const { includeEmpty, positional } = parseMigrationCliArgs(process.argv);
  const databaseName = positional[0]?.trim();
  const label = positional[1]?.trim() || "backup";

  if (!databaseName) {
    printUsage();
    process.exit(1);
  }

  const { folderName, folderPath, manifest, skippedEmptyCollections } = await exportRawDatabase(
    databaseName,
    label,
    { includeEmpty },
  );

  console.log(`Raw database export created: ${folderName}`);
  console.log(`Path: ${folderPath}`);
  console.log(`Database: ${manifest.dbName}`);
  if (Object.keys(manifest.counts).length === 0) {
    console.log("No collections with data were found in this database.");
  } else {
    console.log("Counts:");
    for (const [collection, count] of Object.entries(manifest.counts)) {
      console.log(`  ${collection}: ${count}`);
    }
  }
  if (skippedEmptyCollections.length > 0) {
    console.log(`\nSkipped ${skippedEmptyCollections.length} empty collections:`);
    console.log(`  ${skippedEmptyCollections.join(", ")}`);
  }

  const recent = await listMigrationFolders();
  const related = recent.filter((name) => name.startsWith(`db_${manifest.dbName}`) || name.includes(databaseName));
  if (related.length > 1) {
    console.log("\nOther exports for this database:");
    for (const name of related.slice(0, 5)) {
      if (name !== folderName) console.log(`  - ${name}`);
    }
  }

  console.log(`\nRestore later with:\n  npm run db:restore:database -- ${folderName} --force`);
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
