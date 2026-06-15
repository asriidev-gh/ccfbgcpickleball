"use client";

import { useQuery } from "@tanstack/react-query";

export function UserHeaderGreeting() {
  const { data } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return null;
      return (await response.json()) as { user: { name: string } | null };
    },
    staleTime: 60_000,
  });

  const userName = data?.user?.name?.trim();
  if (!userName) return null;

  return (
    <p className="max-w-[10rem] truncate text-sm font-semibold text-foreground sm:max-w-[14rem] sm:text-base">
      Hi, {userName}
    </p>
  );
}
