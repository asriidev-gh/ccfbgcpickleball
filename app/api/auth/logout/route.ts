import { NextResponse } from "next/server";

import { authCookieClearOptions, getAuthCookieName } from "@/lib/auth";

function logoutResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAuthCookieName(), "", authCookieClearOptions());
  return response;
}

export async function POST() {
  return logoutResponse();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectParam = url.searchParams.get("redirect") ?? "/login";
  const destination =
    redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/login";
  const loginUrl = new URL(destination, url.origin);
  loginUrl.searchParams.set("loggedOut", "1");

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(getAuthCookieName(), "", authCookieClearOptions());
  return response;
}
