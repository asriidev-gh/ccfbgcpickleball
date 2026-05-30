import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import {
  GOOGLE_OAUTH_STATE_COOKIE,
  getGoogleOAuthConfig,
  getGoogleRedirectUri,
} from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { clientId } = getGoogleOAuthConfig();
    const redirectUri = getGoogleRedirectUri(request.url);
    const state = randomBytes(16).toString("hex");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("prompt", "select_account");

    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    const origin = new URL(request.url).origin;
    const message = error instanceof Error ? error.message : "Google sign-in is unavailable.";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }
}
