/** Operator live dashboard: `/games/{id}` without spectator or sub-routes. */
export function isOperatorGameDashboardPath(pathname: string) {
  return /^\/games\/[^/]+$/.test(pathname);
}

/** Owner multi-session courts view (`/my-games/courts-view`). */
export function isOwnerCourtsViewPath(pathname: string) {
  return pathname === "/my-games/courts-view";
}

/** Account / ephemeral quick-play courts view (`/play/{id}/courts-view`). */
export function isPlayCourtsViewPath(pathname: string) {
  return /^\/play\/[^/]+\/courts-view$/.test(pathname);
}

/** Operator surfaces where action toasts are suppressed during live play. */
export function shouldSuppressOperatorDashboardToasts(pathname: string) {
  return (
    isOperatorGameDashboardPath(pathname) ||
    isOwnerCourtsViewPath(pathname) ||
    isPlayCourtsViewPath(pathname)
  );
}
