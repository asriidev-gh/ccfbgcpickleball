"use client";

import { useQuery } from "@tanstack/react-query";

export type AuthMeUser = {
  name: string;
  email?: string;
  isSuperAdmin?: boolean;
  emailVerified?: boolean;
};

export type AuthMePayload = {
  user: AuthMeUser | null;
};

export function authMeQueryKey() {
  return ["auth-me"] as const;
}

export async function fetchAuthMe(): Promise<AuthMePayload | null> {
  const response = await fetch("/api/auth/me");
  if (!response.ok) return null;
  return (await response.json()) as AuthMePayload;
}

export function useAuthMe() {
  return useQuery({
    queryKey: authMeQueryKey(),
    queryFn: fetchAuthMe,
    staleTime: 5 * 60_000,
  });
}
