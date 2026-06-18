/** Matches in-app demo titles ("Test Open Play N") and seed ("Demo Open Play"). */
export const DEMO_OPEN_PLAY_TITLE = /^(test|demo) open play/i;

export const DEMO_OPEN_PLAY_MAX_ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export function isDemoOpenPlayTitle(title: string) {
  return DEMO_OPEN_PLAY_TITLE.test(title.trim());
}

export function canCreateDemoOpenPlay({
  accountCreatedAt,
  isSuperAdmin,
}: {
  accountCreatedAt: Date | string | null | undefined;
  isSuperAdmin: boolean;
}) {
  if (isSuperAdmin) return true;
  if (!accountCreatedAt) return false;

  const createdMs = new Date(accountCreatedAt).getTime();
  if (Number.isNaN(createdMs)) return false;

  return Date.now() - createdMs <= DEMO_OPEN_PLAY_MAX_ACCOUNT_AGE_MS;
}
