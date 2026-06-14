import { Users } from "lucide-react";

import { OwnerHubNav } from "@/components/owner-hub-nav";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function OwnerHubPageLoading() {
  return (
    <main className="registered-players-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="registered-players-page-intro flex flex-col gap-4">
          <Skeleton className="h-9 w-40" />
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div className="space-y-2">
              <h1 className="page-title">Registered Players</h1>
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
        </div>
        <OwnerHubNav />
        <Card className="glass-panel">
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
