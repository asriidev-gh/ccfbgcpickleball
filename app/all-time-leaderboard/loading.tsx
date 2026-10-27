import { Trophy } from "lucide-react";

import { OwnerHubNav } from "@/components/owner-hub-nav";
import { Skeleton } from "@/components/ui/skeleton";

export default function AllTimeLeaderboardLoading() {
  return (
    <main className="all-time-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Trophy className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-2">
            <h1 className="page-title">All-time Leaderboard</h1>
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
        <OwnerHubNav />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </section>
    </main>
  );
}
