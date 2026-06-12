"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, RefreshCw, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatSystemLogUserLabel,
  type SystemLogLevel,
  type SystemLogListItem,
} from "@/lib/system-log-shared";
import { cn } from "@/lib/utils";

function formatLogTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function levelBadgeClass(level: SystemLogLevel) {
  if (level === "error") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  if (level === "warn") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "border-border bg-muted text-muted-foreground";
}

function SystemLogRow({ log }: { log: SystemLogListItem }) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(log.stack || log.metadata);

  return (
    <>
      <TableRow>
        <TableCell className="w-10">
          {hasDetails ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label={open ? "Hide log details" : "Show log details"}
            >
              {open ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )}
            </Button>
          ) : null}
        </TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground" suppressHydrationWarning>
          {formatLogTime(log.occurredAt)}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={cn("uppercase", levelBadgeClass(log.level))}>
            {log.level}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">{log.source}</TableCell>
        <TableCell className="max-w-[14rem]">
          <p className="truncate font-medium" title={formatSystemLogUserLabel(log)}>
            {formatSystemLogUserLabel(log)}
          </p>
        </TableCell>
        <TableCell className="max-w-[28rem]">
          <p className="truncate font-medium" title={log.message}>
            {log.message}
          </p>
          {log.route ? (
            <p className="caption truncate text-muted-foreground">
              {log.method ? `${log.method} ` : ""}
              {log.route}
              {log.statusCode ? ` · ${log.statusCode}` : ""}
            </p>
          ) : null}
        </TableCell>
      </TableRow>
      {open && hasDetails ? (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30">
            <div className="space-y-3 py-2 text-xs">
              {log.userId ? (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">User ID:</span> {log.userId}
                </p>
              ) : null}
              {log.stack ? (
                <pre className="overflow-x-auto rounded-md border bg-background/80 p-3 font-mono whitespace-pre-wrap text-muted-foreground">
                  {log.stack}
                </pre>
              ) : null}
              {log.metadata ? (
                <pre className="overflow-x-auto rounded-md border bg-background/80 p-3 font-mono whitespace-pre-wrap text-muted-foreground">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function SystemLogsPanel() {
  const [levelFilter, setLevelFilter] = useState<"all" | SystemLogLevel>("all");
  const [extraLogs, setExtraLogs] = useState<SystemLogListItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["insights-system-logs"],
    queryFn: async () => {
      const response = await fetch("/api/insights/system-logs?limit=50");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { count: number; logs: SystemLogListItem[] };
    },
    refetchOnWindowFocus: false,
  });

  const logs = useMemo(() => {
    const combined = [...(data?.logs ?? []), ...extraLogs];
    const seen = new Set<string>();
    return combined.filter((log) => {
      if (seen.has(log.id)) return false;
      seen.add(log.id);
      return true;
    });
  }, [data?.logs, extraLogs]);

  const filteredLogs = useMemo(
    () => (levelFilter === "all" ? logs : logs.filter((log) => log.level === levelFilter)),
    [levelFilter, logs],
  );

  const handleRefresh = async () => {
    setExtraLogs([]);
    await refetch();
  };

  const handleLoadMore = async () => {
    const oldest = logs.at(-1);
    if (!oldest || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/insights/system-logs?limit=50&before=${encodeURIComponent(oldest.occurredAt)}`,
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      const next = payload as { logs: SystemLogListItem[] };
      setExtraLogs((current) => [...current, ...next.logs]);
    } finally {
      setLoadingMore(false);
    }
  };

  const canLoadMore = (data?.logs.length ?? 0) > 0 || extraLogs.length > 0;

  return (
    <Card className="glass-panel">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle className="section-title text-xl">System Logs</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={levelFilter}
              onValueChange={(value) => setLevelFilter(value as "all" | SystemLogLevel)}
            >
              <SelectTrigger className="h-9 w-[9.5rem]">
                <SelectValue placeholder="Filter level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="warn">Warnings</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} aria-hidden />
              Refresh
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Server errors and database issues from production. Logs are kept for about 30 days.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading system logs…
          </p>
        ) : isError ? (
          <p className="flex items-center gap-2 py-6 text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Failed to load system logs.
          </p>
        ) : filteredLogs.length === 0 ? (
          <p className="py-6 text-muted-foreground">No logs match this filter yet.</p>
        ) : (
          <div className="space-y-4">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Time</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <SystemLogRow key={log.id} log={log} />
                ))}
              </TableBody>
            </Table>
            {canLoadMore ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                      Loading…
                    </>
                  ) : (
                    "Load older logs"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
