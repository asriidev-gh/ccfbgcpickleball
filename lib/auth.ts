import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

import { runWithDatabase } from "@/lib/db";
import { isUserBlocked } from "@/lib/user-block";
import { User } from "@/models/User";

const AUTH_COOKIE = "ccf_auth";

export type AuthPayload = {
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

export async function readAuthTokenPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}

/** Use inside runWithDatabase so auth shares the same connection as the route handler. */
export async function authorizeAuthPayload(payload: AuthPayload) {
  const user = await User.findById(payload.userId).select("isBlocked").lean();
  if (!user || isUserBlocked(user)) return null;
  return payload;
}

export async function getAuthUserFromCookie() {
  const payload = await readAuthTokenPayload();
  if (!payload) return null;
  try {
    return await runWithDatabase(() => authorizeAuthPayload(payload));
  } catch {
    return null;
  }
}

export function getAuthCookieName() {
  return AUTH_COOKIE;
}

export function authCookieClearOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export async function clearAuthSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(getAuthCookieName(), "", authCookieClearOptions());
}

const IMPERSONATE_PURPOSE = "impersonate";

export function signImpersonationToken(targetUserId: string, adminUserId: string) {
  return jwt.sign(
    { purpose: IMPERSONATE_PURPOSE, targetUserId, adminUserId },
    getJwtSecret(),
    { expiresIn: "5m" },
  );
}

export function verifyImpersonationToken(token: string) {
  const payload = jwt.verify(token, getJwtSecret()) as {
    purpose?: string;
    targetUserId?: string;
    adminUserId?: string;
  };
  if (payload.purpose !== IMPERSONATE_PURPOSE || !payload.targetUserId || !payload.adminUserId) {
    throw new Error("Invalid impersonation link.");
  }
  return { targetUserId: payload.targetUserId, adminUserId: payload.adminUserId };
}

const SUPERADMIN_PLAYER_CHECKIN_PURPOSE = "superadmin_player_checkin";

export function signSuperadminPlayerCheckInToken(
  gameId: string,
  adminUserId: string,
  playerId: string,
) {
  return jwt.sign(
    { purpose: SUPERADMIN_PLAYER_CHECKIN_PURPOSE, gameId, adminUserId, playerId },
    getJwtSecret(),
    { expiresIn: "5m" },
  );
}

export function verifySuperadminPlayerCheckInToken(token: string) {
  const payload = jwt.verify(token, getJwtSecret()) as {
    purpose?: string;
    gameId?: string;
    adminUserId?: string;
    playerId?: string;
  };
  if (
    payload.purpose !== SUPERADMIN_PLAYER_CHECKIN_PURPOSE ||
    !payload.gameId ||
    !payload.adminUserId ||
    !payload.playerId
  ) {
    throw new Error("Invalid player check-in link.");
  }
  return {
    gameId: payload.gameId,
    adminUserId: payload.adminUserId,
    playerId: payload.playerId,
  };
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
