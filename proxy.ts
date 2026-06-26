import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isQuickGame } from "@/lib/local-game-id";

const AUTH_COOKIE = "ccf_auth";

function leaderboardGameId(pathname: string) {
  return pathname.match(/^\/leaderboard\/([^/]+)/)?.[1] ?? null;
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isSpectatorGameRoute = /^\/games\/[^/]+\/spectate(?:\/.*)?$/.test(pathname);
  const isSpectatorLeaderboard =
    pathname.startsWith("/leaderboard/") && searchParams.get("from") === "spectator";
  const isQuickGameLeaderboard = isQuickGame(leaderboardGameId(pathname));
  const isProtectedRoute =
    (pathname === "/" ||
      pathname.startsWith("/games") ||
      pathname.startsWith("/leaderboard") ||
      pathname.startsWith("/insights") ||
      pathname.startsWith("/error-logs") ||
      pathname.startsWith("/feature-controls") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/users") ||
      pathname.startsWith("/my-games") ||
      pathname.startsWith("/my-club") ||
      pathname.startsWith("/marketplace")) &&
    !isSpectatorGameRoute &&
    !isSpectatorLeaderboard &&
    !isQuickGameLeaderboard;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/signin");
  const hasAuth = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  if (isProtectedRoute && !hasAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthRoute && hasAuth) {
    if (pathname.startsWith("/login") && searchParams.get("loggedOut") === "1") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/games/:path*",
    "/leaderboard/:path*",
    "/insights/:path*",
    "/error-logs",
    "/feature-controls",
    "/settings/:path*",
    "/users",
    "/my-games",
    "/my-games/:path*",
    "/my-club",
    "/marketplace",
    "/login",
    "/signup",
    "/signin",
    "/quick-game",
  ],
};
