"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
} from "@/lib/system-log-shared";
import {
  urgencyBadgeClass,
  type SystemLogListItemWithAnalysis,
} from "@/lib/system-log-analysis";
import { buildSystemLogFingerprint } from "@/lib/system-log-fingerprint";
import {
  persistenceStatusBadgeClass,
  type SystemLogPersistenceCheck,
} from "@/lib/system-log-persistence-shared";
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

function SystemLogRow({
  log,
  persistence,
  persistenceLoading,
  resolving,
  onCheckPersistence,
  onResolve,
}: {
  log: SystemLogListItemWithAnalysis;
  persistence?: SystemLogPersistenceCheck;
  persistenceLoading?: boolean;
  resolving?: boolean;
  onCheckPersistence: (log: SystemLogListItemWithAnalysis) => void;
  onResolve: (log: SystemLogListItemWithAnalysis) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell className="w-10">
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
        </TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground" suppressHydrationWarning>
          {formatLogTime(log.occurredAt)}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={cn("uppercase", levelBadgeClass(log.level))}>
            {log.level}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn("whitespace-nowrap", urgencyBadgeClass(log.analysis.urgency))}
            title={log.analysis.category}
          >
            {log.analysis.label}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">{log.source}</TableCell>
        <TableCell className="max-w-[14rem]">
          <p className="truncate font-medium" title={formatSystemLogUserLabel(log)}>
            {formatSystemLogUserLabel(log)}
          </p>
        </TableCell>
        <TableCell className="max-w-[28rem]">
          <div className="flex flex-col gap-1">
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
            {persistence ? (
              <Badge
                variant="outline"
                className={cn("w-fit", persistenceStatusBadgeClass(persistence.status))}
                title={persistence.summary}
              >
                {persistence.label}
              </Badge>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="w-[7.5rem] text-right">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={resolving}
            onClick={() => onResolve(log)}
          >
            {resolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                Resolved
              </>
            )}
          </Button>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30">
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-md border border-border/70 bg-background/80 p-3">
                <p className="font-medium text-foreground">Developer analysis</p>
                <p className="mt-1 text-muted-foreground">
                  <span className="font-medium text-foreground">Category:</span>{" "}
                  {log.analysis.category}
                </p>
                <p className="mt-1 text-muted-foreground">{log.analysis.summary}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                  {log.analysis.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-border/70 bg-background/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">Fix status</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={persistenceLoading}
                    onClick={() => onCheckPersistence(log)}
                  >
                    {persistenceLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                        Checking…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Check if still occurring
                      </>
                    )}
                  </Button>
                </div>
                {persistence ? (
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <Badge
                      variant="outline"
                      className={cn(persistenceStatusBadgeClass(persistence.status))}
                    >
                      {persistence.label}
                    </Badge>
                    <p>{persistence.summary}</p>
                    <p>
                      48h: {persistence.matchCount48h} · 7d: {persistence.matchCount7d} · 30d:{" "}
                      {persistence.matchCount30d}
                      {persistence.lastSeenAt
                        ? ` · Last seen ${formatLogTime(persistence.lastSeenAt)}`
                        : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-muted-foreground">
                    Compares this error pattern against logs from the last 30 days.
                  </p>
                )}
              </div>
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

export function SystemLogsPanel({
  title = "System Logs",
  description = "Server and client errors from production. Logs are kept for about 30 days.",
  queryKey = "insights-system-logs",
  defaultLevelFilter = "all",
}: {
  title?: string;
  description?: string;
  queryKey?: string;
  defaultLevelFilter?: "all" | SystemLogLevel;
} = {}) {
  const [levelFilter, setLevelFilter] = useState<"all" | SystemLogLevel>(defaultLevelFilter);
  const [extraLogs, setExtraLogs] = useState<SystemLogListItemWithAnalysis[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [persistenceByFingerprint, setPersistenceByFingerprint] = useState<
    Record<string, SystemLogPersistenceCheck>
  >({});
  const [checkingFingerprints, setCheckingFingerprints] = useState<Set<string>>(new Set());
  const [checkingAll, setCheckingAll] = useState(false);
  const [resolvingLogIds, setResolvingLogIds] = useState<Set<string>>(new Set());
  const [hiddenFingerprints, setHiddenFingerprints] = useState<Set<string>>(new Set());

  const persistenceKeyForLog = (log: SystemLogListItemWithAnalysis) =>
    buildSystemLogFingerprint(log.source, log.message);

  const requestPersistenceChecks = async (logIds: string[]) => {
    const response = await fetch("/api/insights/system-logs/persistence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logIds }),
    });
    const payload = (await response.json()) as {
      checks?: Record<string, SystemLogPersistenceCheck | null>;
      message?: string;
    };
    if (!response.ok) {
      throw new Error(payload.message ?? "Failed to check error persistence.");
    }
    return payload.checks ?? {};
  };

  const applyPersistenceChecks = (
    checks: Record<string, SystemLogPersistenceCheck | null>,
    logsToMap: SystemLogListItemWithAnalysis[],
  ) => {
    setPersistenceByFingerprint((current) => {
      const next = { ...current };
      for (const log of logsToMap) {
        const check = checks[log.id];
        if (check) {
          next[persistenceKeyForLog(log)] = check;
        }
      }
      return next;
    });
  };

  const checkPersistenceForLog = async (log: SystemLogListItemWithAnalysis) => {
    const fingerprint = persistenceKeyForLog(log);
    setCheckingFingerprints((current) => new Set(current).add(fingerprint));
    try {
      const checks = await requestPersistenceChecks([log.id]);
      applyPersistenceChecks(checks, [log]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check error status.");
    } finally {
      setCheckingFingerprints((current) => {
        const next = new Set(current);
        next.delete(fingerprint);
        return next;
      });
    }
  };

  const checkAllVisiblePersistence = async () => {
    const uniqueByFingerprint = new Map<string, SystemLogListItemWithAnalysis>();
    for (const log of filteredLogs) {
      const key = persistenceKeyForLog(log);
      if (!uniqueByFingerprint.has(key)) {
        uniqueByFingerprint.set(key, log);
      }
    }
    const logsToCheck = [...uniqueByFingerprint.values()];
    if (logsToCheck.length === 0) return;

    setCheckingAll(true);
    try {
      const checks = await requestPersistenceChecks(logsToCheck.map((log) => log.id));
      applyPersistenceChecks(checks, logsToCheck);
      toast.success(`Checked ${logsToCheck.length} error pattern(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check visible errors.");
    } finally {
      setCheckingAll(false);
    }
  };

  const levelQuery = levelFilter === "all" ? "" : `&level=${levelFilter}`;

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [queryKey, levelFilter],
    queryFn: async () => {
      const response = await fetch(`/api/insights/system-logs?limit=50${levelQuery}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { count: number; logs: SystemLogListItemWithAnalysis[] };
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

  const filteredLogs = useMemo(() => {
    return [...logs]
      .filter((log) => !hiddenFingerprints.has(persistenceKeyForLog(log)))
      .sort((a, b) => {
      const rank = { critical: 4, high: 3, low: 2, informational: 1 };
      const byUrgency = rank[b.analysis.urgency] - rank[a.analysis.urgency];
      if (byUrgency !== 0) return byUrgency;
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    });
  }, [logs, hiddenFingerprints]);

  const resolveLog = async (log: SystemLogListItemWithAnalysis) => {
    const fingerprint = persistenceKeyForLog(log);
    setResolvingLogIds((current) => new Set(current).add(log.id));
    try {
      const response = await fetch("/api/insights/system-logs/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id }),
      });
      const payload = (await response.json()) as {
        resolvedCount?: number;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to mark log as resolved.");
      }

      setHiddenFingerprints((current) => new Set(current).add(fingerprint));
      toast.success(
        payload.resolvedCount && payload.resolvedCount > 1
          ? `Marked ${payload.resolvedCount} matching errors as resolved.`
          : "Marked as resolved.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark as resolved.");
    } finally {
      setResolvingLogIds((current) => {
        const next = new Set(current);
        next.delete(log.id);
        return next;
      });
    }
  };

  const handleRefresh = async () => {
    setExtraLogs([]);
    setHiddenFingerprints(new Set());
    await refetch();
  };

  const handleLoadMore = async () => {
    const oldest = logs.at(-1);
    if (!oldest || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/insights/system-logs?limit=50&before=${encodeURIComponent(oldest.occurredAt)}${levelQuery}`,
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      const next = payload as { logs: SystemLogListItemWithAnalysis[] };
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
            <CardTitle className="section-title text-xl">{title}</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={levelFilter}
              onValueChange={(value) => {
                setExtraLogs([]);
                setLevelFilter(value as "all" | SystemLogLevel);
              }}
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
              onClick={() => void checkAllVisiblePersistence()}
              disabled={checkingAll || isFetching || filteredLogs.length === 0}
            >
              {checkingAll ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden />
              )}
              Check visible errors
            </Button>
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
        <p className="text-sm text-muted-foreground">{description}</p>
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
                  <TableHead>Priority</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const fingerprint = persistenceKeyForLog(log);
                  return (
                    <SystemLogRow
                      key={log.id}
                      log={log}
                      persistence={persistenceByFingerprint[fingerprint]}
                      persistenceLoading={checkingFingerprints.has(fingerprint) || checkingAll}
                      resolving={resolvingLogIds.has(log.id)}
                      onCheckPersistence={(entry) => void checkPersistenceForLog(entry)}
                      onResolve={(entry) => void resolveLog(entry)}
                    />
                  );
                })}
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
