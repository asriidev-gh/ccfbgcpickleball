export function getBrandShellClasses(pathname: string) {
  if (pathname.startsWith("/games/")) {
    return {
      pad: "px-4 md:px-6",
      container: "max-w-[1600px]",
    };
  }

  if (pathname === "/" || pathname === "/my-games") {
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
  return pathname.startsWith("/login");
}

/** Public pages: theme picker only (no account / logout). */
export function isPublicAppPath(pathname: string, fromParam: string | null) {
  if (isSpectatorPath(pathname, fromParam)) return true;
  if (pathname.startsWith("/register")) return true;
  return false;
}

const REGISTERED_PLAYERS_HEADER_HIDDEN_PATHS = new Set([
  "/",
  "/users",
  "/my-games",
  "/insights",
]);

/** Dashboard, game, and dedicated pages already expose registered players navigation. */
export function shouldShowRegisteredPlayersHeaderLink(pathname: string) {
  if (REGISTERED_PLAYERS_HEADER_HIDDEN_PATHS.has(pathname)) return false;
  if (pathname.startsWith("/games/")) return false;
  return true;
}
