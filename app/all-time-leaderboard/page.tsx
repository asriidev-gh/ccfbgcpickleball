"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink, Trophy } from "lucide-react";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import { OwnerHubNav } from "@/components/owner-hub-nav";
import { AllTimeLeaderboardView } from "@/components/leaderboard/all-time-leaderboard-view";

export default function AllTimeLeaderboardPage() {
  return (
    <main className="all-time-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Trophy className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="page-title">All-time Leaderboard</h1>
            <p className="caption mt-0.5 max-w-xl">
              Every player ranked across all of your sessions, best record first.
            </p>
            <Link
              href="/standings"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open the public page players can see
            </Link>
          </div>
        </div>

        <OwnerHubNav />

        <Suspense fallback={null}>
          <AllTimeLeaderboardView />
        </Suspense>
      </section>
      <HomeMobileNav />
    </main>
  );
}
