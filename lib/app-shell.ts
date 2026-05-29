export function getBrandShellClasses(pathname: string) {
  if (pathname.startsWith("/games/")) {
    return {
      pad: "px-4 md:px-6",
      container: "max-w-[1600px]",
    };
  }

  if (pathname === "/") {
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
  if (pathname.endsWith("/spectate")) return true;
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
