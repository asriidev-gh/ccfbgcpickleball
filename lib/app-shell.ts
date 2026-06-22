export function getGameIdFromGamesPath(pathname: string) {
  const match = pathname.match(/^\/games\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isGameDashboardPath(pathname: string) {
  return pathname.startsWith("/games/") || /^\/play\/[^/]+$/.test(pathname);
}

export function getQuickPlayGameIdFromPath(pathname: string) {
  const match = pathname.match(/^\/play\/([^/]+)/);
  return match?.[1] ?? null;
}

export function getBrandShellClasses(pathname: string) {
  if (pathname.startsWith("/games/")) {
    return {
      pad: "px-4 md:px-6",
      container: "max-w-[1600px]",
    };
  }

  if (pathname === "/" || pathname === "/my-games" || pathname.startsWith("/my-games/") || pathname === "/my-club" || pathname === "/marketplace" || pathname === "/play" || pathname.startsWith("/play/") || pathname === "/quick-game") {
    return {
      pad: "px-6 lg:px-10",
      container: "max-w-7xl",
    };
  }

  return {
    pad: "px-6",
    container: "max-w-7xl",
  };
}

export function isSpectatorPath(pathname: string, fromParam: string | null) {
  if (/^\/games\/[^/]+\/spectate(?:\/.*)?$/.test(pathname)) return true;
  if (pathname.startsWith("/leaderboard/") && fromParam === "spectator") return true;
  return false;
}

/** Auth screens use a minimal shell with no top brand bar. */
export function shouldHideAppBrandBar(pathname: string) {
  return pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/signin");
}

/** Public pages: theme picker only (no account / logout). */
export function isPublicAppPath(pathname: string, fromParam: string | null) {
  if (isSpectatorPath(pathname, fromParam)) return true;
  if (pathname.startsWith("/register")) return true;
  if (pathname.startsWith("/signup") || pathname.startsWith("/signin")) return true;
  if (pathname === "/play" || pathname.startsWith("/play/")) return true;
  return false;
}

const OWNER_HUB_PATHS = new Set(["/my-games", "/users", "/my-club", "/marketplace"]);

function isOwnerHubPath(pathname: string) {
  return OWNER_HUB_PATHS.has(pathname) || pathname.startsWith("/my-games/");
}

const OWNER_DASHBOARD_NAV_HIDDEN_PATHS = new Set([
  "/",
  "/users",
  "/my-club",
  "/my-games",
  "/marketplace",
  "/insights",
]);

/** Owner hub sub-pages link back to the home dashboard from the header. */
export function shouldShowDashboardHeaderLink(pathname: string) {
  return isOwnerHubPath(pathname);
}

/** Greeting is hidden on owner hub sub-pages where the dashboard button is shown. */
export function shouldShowUserHeaderGreeting(pathname: string) {
  return !isOwnerHubPath(pathname);
}

/** Dashboard and dedicated pages already expose owner navigation in-page. */
export function shouldShowOwnerDashboardNavLinks(pathname: string) {
  if (OWNER_DASHBOARD_NAV_HIDDEN_PATHS.has(pathname)) return false;
  if (pathname.startsWith("/my-games/")) return false;
  if (pathname.startsWith("/games/")) return false;
  if (pathname === "/play" || pathname.startsWith("/play/")) return false;
  if (pathname.startsWith("/leaderboard/")) return false;
  return true;
}

/** @deprecated Use shouldShowOwnerDashboardNavLinks */
export function shouldShowRegisteredPlayersHeaderLink(pathname: string) {
  return shouldShowOwnerDashboardNavLinks(pathname);
}
