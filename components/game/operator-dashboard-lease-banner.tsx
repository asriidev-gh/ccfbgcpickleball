"use client";

import { Loader2, MonitorSmartphone, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const alertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#22c55e",
  cancelButtonColor: "#64748b",
};

type OperatorDashboardLeaseBannerProps = {
  deviceHint?: string;
  lastSeenAt?: string;
  takenOver?: boolean;
  loading?: boolean;
  checking?: boolean;
  onCheckAgain: () => void;
  onTakeOver: () => void;
  className?: string;
};

export function formatOperatorLeaseLastSeen(value?: string) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function confirmOperatorDashboardTakeover() {
  return Swal.fire({
    ...alertOptions,
    title: "Take over this dashboard?",
    html: "The other tab or device will lose operator control of this game. Only do this if you closed the dashboard there or need to switch.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Take over",
    cancelButtonText: "Cancel",
  });
}

export function OperatorDashboardLeaseBanner({
  deviceHint,
  lastSeenAt,
  takenOver = false,
  loading = false,
  checking = false,
  onCheckAgain,
  onTakeOver,
  className,
}: OperatorDashboardLeaseBannerProps) {
  const lastSeenLabel = formatOperatorLeaseLastSeen(lastSeenAt);

  const handleTakeOver = async () => {
    const result = await confirmOperatorDashboardTakeover();
    if (!result.isConfirmed) return;
    onTakeOver();
  };

  if (loading) {
    return (
      <div
        className={cn(
          "operator-dashboard-lease-banner flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        Connecting operator session…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "operator-dashboard-lease-banner rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 sm:px-4",
        className,
      )}
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200">
            <MonitorSmartphone className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">
              {takenOver ? "Dashboard opened elsewhere" : "Dashboard in use on another tab"}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {takenOver
                ? `${deviceHint ?? "Another tab or device"} took over operator control. Take over here to fill courts from this page.`
                : `${deviceHint ?? "Another tab or device"} is operating this session. Courts are view-only until you take over or close the other dashboard.`}
            </p>
            {lastSeenLabel ? (
              <p className="text-xs text-muted-foreground">Last active: {lastSeenLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button type="button" size="sm" variant="outline" onClick={onCheckAgain} disabled={checking}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", checking && "animate-spin")} aria-hidden />
            Check again
          </Button>
          <Button type="button" size="sm" onClick={() => void handleTakeOver()} disabled={checking}>
            Take over dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
