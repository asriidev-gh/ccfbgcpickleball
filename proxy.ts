import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "ccf_auth";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isSpectatorGameRoute = /^\/games\/[^/]+\/spectate(?:\/.*)?$/.test(pathname);
  const isSpectatorLeaderboard =
    pathname.startsWith("/leaderboard/") && searchParams.get("from") === "spectator";
  const isProtectedRoute =
    (pathname === "/" ||
      pathname.startsWith("/games") ||
      pathname.startsWith("/leaderboard") ||
      pathname.startsWith("/insights") ||
      pathname.startsWith("/error-logs") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/users") ||
      pathname.startsWith("/my-games") ||
      pathname.startsWith("/my-club") ||
      pathname.startsWith("/marketplace")) &&
    !isSpectatorGameRoute &&
    !isSpectatorLeaderboard;
  const isAuthRoute = pathname.startsWith("/login");
  const hasAuth = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  if (isProtectedRoute && !hasAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthRoute && hasAuth) {
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
    "/settings/:path*",
    "/users",
    "/my-games",
    "/my-games/:path*",
    "/my-club",
    "/marketplace",
    "/login",
  ],
};
