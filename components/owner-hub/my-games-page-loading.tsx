import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MyGamesPageLoading() {
  return (
    <main className="min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <Card className="glass-panel">
          <CardContent className="flex flex-wrap gap-4 p-6">
            <Skeleton className="h-11 min-w-44 rounded-md" />
            <Skeleton className="h-11 min-w-44 rounded-md" />
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-9 w-40 rounded-md" />
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
