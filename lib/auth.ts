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
