import { LayoutGrid } from "lucide-react";

import { OwnerHubNav } from "@/components/owner-hub-nav";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MyGamesPageLoading() {
  return (
    <main className="my-games-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="my-games-page-intro flex flex-col gap-4">
          <Skeleton className="h-9 w-40" />
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <LayoutGrid className="h-5 w-5" aria-hidden />
            </span>
            <div className="space-y-2">
              <h1 className="page-title">My Games</h1>
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
        </div>
        <OwnerHubNav />
        <Card className="glass-panel">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="hidden h-9 w-64 rounded-md md:block" />
              <Skeleton className="h-11 min-w-28 rounded-md" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-32 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-36 w-full rounded-2xl" />
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
