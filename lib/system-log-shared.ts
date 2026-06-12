export type SystemLogLevel = "error" | "warn" | "info";

export type SystemLogListItem = {
  id: string;
  level: SystemLogLevel;
  source: string;
  message: string;
  stack?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userEmail?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};

export function formatSystemLogUserLabel(
  log: Pick<SystemLogListItem, "userName" | "userEmail" | "userId">,
) {
  if (log.userName && log.userEmail) return `${log.userName} (${log.userEmail})`;
  if (log.userEmail) return log.userEmail;
  if (log.userName) return log.userName;
  if (log.userId) return `User ${log.userId}`;
  return "Not signed in";
}
