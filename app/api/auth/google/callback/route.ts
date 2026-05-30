import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { USER_TYPE_DEFAULT } from "@/lib/registration-variant";
import { User } from "@/models/User";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  getAuthCookieName,
  getGoogleOAuthConfig,
  getGoogleRedirectUri,
  signAuthToken,
} from "@/lib/auth";

type GoogleProfile = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const loginRedirect = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) return loginRedirect("Google sign-in was cancelled.");
    if (!code || !state) return loginRedirect("Missing authorization code from Google.");

    const storedState = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${GOOGLE_OAUTH_STATE_COOKIE}=`))
      ?.split("=")[1];

    if (!storedState || storedState !== state) {
      return loginRedirect("Invalid sign-in state. Please try again.");
    }

    const { clientId, clientSecret } = getGoogleOAuthConfig();
    const redirectUri = getGoogleRedirectUri(request.url);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return loginRedirect("Failed to exchange Google authorization code.");
    }

    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) return loginRedirect("Google did not return an access token.");

    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!profileResponse.ok) return loginRedirect("Failed to load your Google profile.");

    const profile = (await profileResponse.json()) as GoogleProfile;
    const email = profile.email?.trim().toLowerCase();
    if (!email || profile.email_verified === false) {
      return loginRedirect("Your Google account has no verified email.");
    }

    await connectToDatabase();

    let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email }] });
    if (!user) {
      user = await User.create({
        name: profile.name || email.split("@")[0],
        email,
        googleId: profile.sub,
        image: profile.picture,
        userType: USER_TYPE_DEFAULT,
      });
    } else if (!user.googleId) {
      // Link Google to an existing local account on first Google sign-in.
      user.googleId = profile.sub;
      if (!user.image && profile.picture) user.image = profile.picture;
      await user.save();
    }

    const token = signAuthToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.redirect(`${origin}/`);
    response.cookies.set(getAuthCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return loginRedirect(
      error instanceof Error ? error.message : "Google sign-in failed."
    );
  }
}
