import "./load-script-env";

import { disconnectFromDatabase } from "@/lib/db";
import {
  exportCollection,
  listMigrationFolders,
  MIGRATION_COLLECTION_KEYS,
} from "@/lib/db-migration";
import { parseMigrationCliArgs } from "@/scripts/parse-migration-cli";

function printUsage() {
  console.log("Usage:");
  console.log("  npm run db:export:collection -- <collection> [label]");
  console.log("");
  console.log("Examples:");
  console.log("  npm run db:export:collection -- players");
  console.log("  npm run db:export:collection -- players roster-backup");
  console.log("");
  console.log("Valid collections:");
  for (const key of MIGRATION_COLLECTION_KEYS) {
    console.log(`  - ${key}`);
  }
}

async function main() {
  const { dbName, positional } = parseMigrationCliArgs(process.argv);
  const collectionKey = positional[0]?.trim();
  const label = positional[1]?.trim() || "backup";

  if (!collectionKey) {
    printUsage();
    process.exit(1);
  }

  const { folderName, folderPath, manifest } = await exportCollection(collectionKey, label, {
    dbName,
  });

  console.log(`Collection export created: ${folderName}`);
  console.log(`Path: ${folderPath}`);
  console.log(`Collection: ${manifest.collection}`);
  console.log(`Database: ${manifest.dbName}`);
  console.log(`Documents: ${manifest.count}`);

  const recent = await listMigrationFolders();
  const related = recent.filter((name) => name.startsWith(`${manifest.collection}_`));
  if (related.length > 1) {
    console.log("\nOther exports for this collection:");
    for (const name of related.slice(0, 5)) {
      if (name !== folderName) console.log(`  - ${name}`);
    }
  }

  console.log(`\nRestore later with:\n  npm run db:restore:collection -- ${folderName} --force`);
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
