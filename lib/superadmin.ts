/**
 * Superadmins are designated via the SUPERADMIN_EMAILS env var (comma-separated).
 * This keeps elevation server-controlled with no DB migration required.
 */
export function getSuperAdminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.trim().toLowerCase());
}
