import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const AUTH_COOKIE = "ccf_auth";

type AuthPayload = {
  userId: string;
  email: string;
  name: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Please set JWT_SECRET in your environment.");
  return secret;
}

export function signAuthToken(payload: AuthPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): AuthPayload {
  return jwt.verify(token, getJwtSecret()) as AuthPayload;
}

export async function getAuthUserFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}

export function getAuthCookieName() {
  return AUTH_COOKIE;
}

export const GOOGLE_OAUTH_STATE_COOKIE = "ccf_google_state";

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment."
    );
  }
  return { clientId, clientSecret };
}

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Builds the OAuth callback URL from the incoming request origin so it stays
 * consistent across the start and callback routes. An explicit
 * GOOGLE_REDIRECT_URI env var takes precedence when set.
 */
export function getGoogleRedirectUri(requestUrl: string) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const origin = new URL(requestUrl).origin;
  return `${origin}/api/auth/google/callback`;
}
