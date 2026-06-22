"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { APP_NAME, APP_VERSION } from "@/lib/app-config";

async function fetchAuthMe() {
  const response = await fetch("/api/auth/me");
  if (!response.ok) return null;
  const payload = (await response.json()) as { user: { name: string } | null };
  return payload;
}

export function AppFooter() {
  const { data: authData, isPending } = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchAuthMe,
    staleTime: 60_000,
  });
  const showQuickPlayNote = !isPending && !authData?.user;

  return (
    <footer className="app-footer mt-auto border-t border-border/60 bg-muted/20 px-6 py-4 text-center text-xs text-muted-foreground">
      <p>
        {APP_NAME} v{APP_VERSION}
      </p>
      {showQuickPlayNote ? (
        <p className="mt-2">
          <Link href="/play" className="underline-offset-4 hover:underline">
            Quick Play
          </Link>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <span>No account — runs in your browser only</span>
        </p>
      ) : null}
    </footer>
  );
}
