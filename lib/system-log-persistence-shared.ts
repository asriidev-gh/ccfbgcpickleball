export const SYSTEM_LOG_PERSISTENCE_STATUSES = [
  "active",
  "quiet",
  "likely_fixed",
  "not_found",
] as const;

export type SystemLogPersistenceStatus = (typeof SYSTEM_LOG_PERSISTENCE_STATUSES)[number];

export type SystemLogPersistenceCheck = {
  status: SystemLogPersistenceStatus;
  label: string;
  summary: string;
  fingerprint: string;
  checkedAt: string;
  lastSeenAt: string | null;
  matchCount30d: number;
  matchCount7d: number;
  matchCount48h: number;
};

export function persistenceStatusBadgeClass(status: SystemLogPersistenceStatus) {
  if (status === "active") {
    return "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300";
  }
  if (status === "quiet") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300";
  }
  if (status === "likely_fixed") {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function persistenceStatusLabel(status: SystemLogPersistenceStatus) {
  if (status === "active") return "Still occurring";
  if (status === "quiet") return "Quiet lately";
  if (status === "likely_fixed") return "Likely fixed";
  return "Not found";
}
