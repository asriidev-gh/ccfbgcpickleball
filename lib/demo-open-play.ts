/** Matches in-app demo titles ("Test Open Play N") and seed ("Demo Open Play"). */
export const DEMO_OPEN_PLAY_TITLE = /^(test|demo) open play/i;

export const DEMO_OPEN_PLAY_MAX_ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export const DEMO_OPEN_PLAY_PLAYER_COUNTS = [12, 18, 22] as const;

export type DemoOpenPlayPlayerCount = (typeof DEMO_OPEN_PLAY_PLAYER_COUNTS)[number];

export const DEMO_OPEN_PLAY_DEFAULT_COURT_COUNT = 2;

export const DEMO_OPEN_PLAY_DEFAULT_PLAYER_COUNT: DemoOpenPlayPlayerCount = 18;

export function getDemoOpenPlayMaxCourts(playerCount: DemoOpenPlayPlayerCount): number {
  if (playerCount === 12) return 2;
  return 3;
}

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
