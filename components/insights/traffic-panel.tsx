"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, Globe, Loader2, MousePointerClick, UserRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TrafficInsights, TrafficRange } from "@/lib/traffic-shared";

function RangeCard({ label, range }: { label: string; range: TrafficRange }) {
  return (
    <Card className="glass-panel">
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <UserRound className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-tight tabular-nums">{range.uniqueVisitors}</p>
          <p className="text-sm text-muted-foreground">Unique visitors · {label}</p>
          <p className="text-xs text-muted-foreground/80">{range.pageViews} page views</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DailyVisitorsChart({ daily }: { daily: TrafficInsights["daily"] }) {
  const max = Math.max(...daily.map((day) => day.uniqueVisitors), 1);

  return (
    <div>
      <div className="flex h-44 items-end justify-between gap-1.5 border-b border-border px-1">
        {daily.map((day) => (
          <div
            key={day.day}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            title={`${day.label}: ${day.uniqueVisitors} unique visitors, ${day.pageViews} page views`}
          >
            <span className="mb-1 text-[10px] font-medium tabular-nums text-foreground/80">
              {day.uniqueVisitors}
            </span>
            <div
              className="w-full max-w-8 rounded-t-md bg-primary"
              style={{
                height: `${Math.max((day.uniqueVisitors / max) * 85, day.uniqueVisitors > 0 ? 3 : 0)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-1.5 px-1">
        {daily.map((day, index) => (
          <span
            key={day.day}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground"
          >
            {index % 2 === 0 ? day.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TrafficPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["insights-traffic"],
    queryFn: async () => {
      const response = await fetch("/api/insights/traffic");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload.traffic as TrafficInsights;
    },
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading traffic…
      </p>
    );
  }
  if (isError || !data) {
    return <p className="py-6 text-destructive">Failed to load traffic.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <RangeCard label="today" range={data.today} />
        <RangeCard label="7 days" range={data.last7Days} />
        <RangeCard label="30 days" range={data.last30Days} />
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="section-title flex items-center gap-2 text-xl">
            <Eye className="h-5 w-5 text-primary" aria-hidden />
            Unique visitors per day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DailyVisitorsChart daily={data.daily} />
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="section-title flex items-center gap-2 text-xl">
            <MousePointerClick className="h-5 w-5 text-primary" aria-hidden />
            Top pages (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topPages.length === 0 ? (
            <p className="text-muted-foreground">No visits recorded yet.</p>
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Unique visitors</TableHead>
                  <TableHead className="text-right">Page views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topPages.map((page) => (
                  <TableRow key={page.path}>
                    <TableCell className="font-mono text-xs">{page.path}</TableCell>
                    <TableCell className="text-right tabular-nums">{page.uniqueVisitors}</TableCell>
                    <TableCell className="text-right tabular-nums">{page.pageViews}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="section-title flex items-center gap-2 text-xl">
            <Globe className="h-5 w-5 text-primary" aria-hidden />
            Recent visitors (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentVisitors.length === 0 ? (
            <p className="text-muted-foreground">No visitors recorded yet.</p>
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Last seen</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Last page</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentVisitors.map((visitor) => (
                  <TableRow key={visitor.visitorId}>
                    <TableCell className="whitespace-nowrap text-muted-foreground" suppressHydrationWarning>
                      {new Date(visitor.lastSeenAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{visitor.ip || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{visitor.location || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {visitor.device || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{visitor.lastPath}</TableCell>
                    <TableCell className="text-right tabular-nums">{visitor.pageViews}</TableCell>
                    <TableCell className="text-right tabular-nums">{visitor.pagesVisited}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Location comes from the host&apos;s geo headers and shows &ldquo;—&rdquo; when the host
        doesn&apos;t provide them. Visitors are anonymous browsers (one id per device), so one person on two devices counts
        twice. Days follow Philippine time. Bots and the Insights page itself are excluded.
      </p>
    </div>
  );
}
