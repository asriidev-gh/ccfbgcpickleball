export const BLOCKED_LOGIN_MESSAGE =
  "Your account has been blocked. Please contact an administrator.";

export function isUserBlocked(user: { isBlocked?: boolean | null } | null | undefined) {
  return Boolean(user?.isBlocked);
}
