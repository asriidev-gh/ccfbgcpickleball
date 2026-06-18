import "dotenv/config";

import { runWithDatabase } from "@/lib/db";
import { listSystemLogs } from "@/lib/system-log";

async function main() {
  const logs = await runWithDatabase(() => listSystemLogs({ limit: 100 }));
  const errors = logs.filter((log) => log.level === "error");
  const groups = new Map<string, (typeof errors)[number][]>();

  for (const log of errors) {
    const key = `${log.source} | ${log.message.slice(0, 160)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(log);
    groups.set(key, bucket);
  }

  console.log(JSON.stringify({
    totalLogs: logs.length,
    errorLogs: errors.length,
    uniqueErrorGroups: groups.size,
    groups: [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, items]) => {
        const latest = items[0]!;
        return {
          count: items.length,
          key,
          source: latest.source,
          message: latest.message,
          route: latest.route,
          lastOccurredAt: latest.occurredAt,
          stackHead: latest.stack?.split("\n").slice(0, 4),
        };
      }),
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
