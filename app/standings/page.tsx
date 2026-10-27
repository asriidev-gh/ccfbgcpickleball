import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";

import { PublicAllTimeLeaderboardView } from "@/components/leaderboard/all-time-leaderboard-view";
import { APP_NAME } from "@/lib/app-config";

export const metadata: Metadata = {
  title: `All-time Leaderboard — ${APP_NAME}`,
  description: "Every player ranked across all open play sessions, best record first.",
};

export default function PublicStandingsPage() {
  return (
    <main className="all-time-page min-h-screen px-6 py-6 lg:px-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Trophy className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="page-title">All-time Leaderboard</h1>
            <p className="caption mt-0.5 max-w-xl">
              Every player ranked across all open play sessions, best record first.
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <PublicAllTimeLeaderboardView />
        </Suspense>

        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
      </section>
    </main>
  );
}
