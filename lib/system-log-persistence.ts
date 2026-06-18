import { buildSystemLogFingerprint } from "@/lib/system-log-fingerprint";
import {
  persistenceStatusLabel,
  type SystemLogPersistenceCheck,
  type SystemLogPersistenceStatus,
} from "@/lib/system-log-persistence-shared";
import { SystemLog } from "@/models/SystemLog";

const HOURS_48_MS = 48 * 60 * 60 * 1000;
const DAYS_7_MS = 7 * 24 * 60 * 60 * 1000;
const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

function resolvePersistenceStatus(matchCount48h: number, matchCount7d: number): SystemLogPersistenceStatus {
  if (matchCount48h > 0) return "active";
  if (matchCount7d > 0) return "quiet";
  return "likely_fixed";
}

function buildPersistenceSummary(
  status: SystemLogPersistenceStatus,
  input: {
    matchCount48h: number;
    matchCount7d: number;
    matchCount30d: number;
    lastSeenAt: Date | null;
  },
) {
  if (status === "active") {
    return `This error pattern appeared ${input.matchCount48h} time(s) in the last 48 hours. It is still happening and is not fixed yet.`;
  }
  if (status === "quiet") {
    return `No matches in the last 48 hours, but ${input.matchCount7d} occurrence(s) in the last 7 days. Monitor it, but it may be improving.`;
  }
  if (status === "likely_fixed") {
    const lastSeen = input.lastSeenAt
      ? ` Last seen ${input.lastSeenAt.toISOString().slice(0, 10)}.`
      : "";
    return `No matches in the last 7 days (${input.matchCount30d} total in 30 days). This issue is likely fixed.${lastSeen}`;
  }
  return "No matching error pattern was found in the last 30 days.";
}

export async function checkSystemLogPersistence(input: {
  source: string;
  message: string;
}): Promise<SystemLogPersistenceCheck> {
  const fingerprint = buildSystemLogFingerprint(input.source, input.message);
  const checkedAt = new Date();
  const since30d = new Date(checkedAt.getTime() - DAYS_30_MS);

  const rows = await SystemLog.find({
    source: input.source.trim(),
    level: "error",
    occurredAt: { $gte: since30d },
    $or: [{ resolvedAt: null }, { resolvedAt: { $exists: false } }],
  })
    .select("message occurredAt")
    .sort({ occurredAt: -1 })
    .lean();

  const matches = rows.filter(
    (row) => buildSystemLogFingerprint(input.source, row.message) === fingerprint,
  );

  if (matches.length === 0) {
    return {
      status: "not_found",
      label: persistenceStatusLabel("not_found"),
      summary: "No matching error pattern was found in the last 30 days.",
      fingerprint,
      checkedAt: checkedAt.toISOString(),
      lastSeenAt: null,
      matchCount30d: 0,
      matchCount7d: 0,
      matchCount48h: 0,
    };
  }

  const lastSeenAt = matches[0]!.occurredAt;
  const since48h = checkedAt.getTime() - HOURS_48_MS;
  const since7d = checkedAt.getTime() - DAYS_7_MS;

  const matchCount48h = matches.filter((row) => row.occurredAt.getTime() >= since48h).length;
  const matchCount7d = matches.filter((row) => row.occurredAt.getTime() >= since7d).length;
  const status = resolvePersistenceStatus(matchCount48h, matchCount7d);

  return {
    status,
    label: persistenceStatusLabel(status),
    summary: buildPersistenceSummary(status, {
      matchCount48h,
      matchCount7d,
      matchCount30d: matches.length,
      lastSeenAt,
    }),
    fingerprint,
    checkedAt: checkedAt.toISOString(),
    lastSeenAt: lastSeenAt.toISOString(),
    matchCount30d: matches.length,
    matchCount7d,
    matchCount48h,
  };
}

export async function checkSystemLogPersistenceById(logId: string) {
  const row = await SystemLog.findById(logId).select("source message").lean();
  if (!row) return null;
  return checkSystemLogPersistence({
    source: row.source,
    message: row.message,
  });
}
