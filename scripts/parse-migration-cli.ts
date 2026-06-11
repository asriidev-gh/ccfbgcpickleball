export function parseMigrationCliArgs(argv: string[]) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const force = args.includes("--force");
  const includeEmpty = args.includes("--include-empty");

  let dbName: string | undefined;
  const cleaned: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force" || arg === "--include-empty") continue;
    if (arg === "--db") {
      dbName = args[index + 1]?.trim();
      index += 1;
      continue;
    }
    cleaned.push(arg);
  }

  return {
    force,
    includeEmpty,
    dbName: dbName || undefined,
    positional: cleaned,
  };
}
