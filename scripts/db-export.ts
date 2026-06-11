import "./load-script-env";

import { disconnectFromDatabase } from "@/lib/db";
import { exportDatabase, listMigrationFolders } from "@/lib/db-migration";
import { parseMigrationCliArgs } from "@/scripts/parse-migration-cli";

async function main() {
  const { dbName, positional } = parseMigrationCliArgs(process.argv);
  const label = positional[0]?.trim() || "backup";

  const { folderName, folderPath, manifest } = await exportDatabase(label, { dbName });

  console.log(`Migration export created: ${folderName}`);
  console.log(`Path: ${folderPath}`);
  console.log(`Database: ${manifest.dbName}`);
  console.log("Counts:");
  for (const [collection, count] of Object.entries(manifest.counts)) {
    console.log(`  ${collection}: ${count}`);
  }

  const recent = await listMigrationFolders();
  if (recent.length > 1) {
    console.log("\nOther local migrations:");
    for (const name of recent.slice(0, 5)) {
      if (name !== folderName) console.log(`  - ${name}`);
    }
  }

  console.log(`\nRestore later with:\n  npm run db:restore -- ${folderName} --force`);
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
