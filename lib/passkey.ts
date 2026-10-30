import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { getAuthCookieName, signAuthToken } from "@/lib/auth";

export const PASSKEY_CHALLENGE_COOKIE = "ccf_passkey_challenge";
const CHALLENGE_TTL_SECONDS = 5 * 60;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Please set JWT_SECRET in your environment.");
  return secret;
}

/** Relying-party id and origin come from the request so they match the host the browser used. */
export function getPasskeyRelyingParty(request: Request) {
  const origin = new URL(getAppBaseUrl(request)).origin;
  return { rpID: new URL(origin).hostname, origin };
}

export function setPasskeyChallengeCookie(
  response: NextResponse,
  purpose: "register" | "login",
  challenge: string,
  userId?: string,
) {
  const token = jwt.sign({ purpose, challenge, userId }, getJwtSecret(), {
    expiresIn: CHALLENGE_TTL_SECONDS,
  });
  response.cookies.set(PASSKEY_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/passkey",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
  return response;
}

export function readPasskeyChallenge(request: Request, purpose: "register" | "login") {
  const cookie = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((part) => part.startsWith(`${PASSKEY_CHALLENGE_COOKIE}=`));
  const token = cookie?.slice(PASSKEY_CHALLENGE_COOKIE.length + 1);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      purpose?: string;
      challenge?: string;
      userId?: string;
    };
    if (payload.purpose !== purpose || !payload.challenge) return null;
    return { challenge: payload.challenge, userId: payload.userId };
  } catch {
    return null;
  }
}

export function clearPasskeyChallengeCookie(response: NextResponse) {
  response.cookies.set(PASSKEY_CHALLENGE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/passkey",
    maxAge: 0,
  });
  return response;
}

export function setAuthSessionCookie(
  response: NextResponse,
  user: { _id: { toString(): string }; email: string; name: string },
) {
  const token = signAuthToken({ userId: user._id.toString(), email: user.email, name: user.name });
  response.cookies.set(getAuthCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
