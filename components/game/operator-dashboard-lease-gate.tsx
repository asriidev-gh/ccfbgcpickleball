"use client";

import { Loader2, MonitorSmartphone, RefreshCw } from "lucide-react";
import Link from "next/link";
import Swal from "sweetalert2";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const alertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#22c55e",
  cancelButtonColor: "#64748b",
};

type OperatorDashboardLeaseGateProps = {
  gameTitle?: string;
  deviceHint?: string;
  lastSeenAt?: string;
  takenOver?: boolean;
  loading?: boolean;
  onCheckAgain: () => void;
  onTakeOver: () => void;
  checking?: boolean;
};

function formatLastSeen(value?: string) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OperatorDashboardLeaseGate({
  gameTitle,
  deviceHint,
  lastSeenAt,
  takenOver = false,
  loading = false,
  onCheckAgain,
  onTakeOver,
  checking = false,
}: OperatorDashboardLeaseGateProps) {
  const handleTakeOver = async () => {
    const result = await Swal.fire({
      ...alertOptions,
      title: "Take over this dashboard?",
      html: "The other device will lose operator control of this game. Only do this if you closed the dashboard there or need to switch devices.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Take over",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    onTakeOver();
  };

  if (loading) {
    return (
      <main className="game-dashboard--operator relative flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-base font-medium text-foreground">Opening game dashboard…</p>
        </div>
      </main>
    );
  }

  const lastSeenLabel = formatLastSeen(lastSeenAt);

  return (
    <main className="game-dashboard--operator flex min-h-screen items-center justify-center p-6">
      <Card className="glass-panel w-full max-w-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <MonitorSmartphone className="h-7 w-7" aria-hidden />
          </div>
          <CardTitle className="section-title text-2xl">
            {takenOver ? "Dashboard opened on another device" : "Dashboard in use on another device"}
          </CardTitle>
          {gameTitle ? <p className="text-sm text-muted-foreground">{gameTitle}</p> : null}
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {takenOver
              ? `${deviceHint ?? "Another device"} took over operator control of this game. Use "Take over dashboard" below if you need control on this device.`
              : `${deviceHint ?? "Another device"} is already operating this game dashboard. Close the dashboard on that device, then open it here again.`}
          </p>
          {lastSeenLabel ? (
            <p className="text-xs text-muted-foreground">Last active: {lastSeenLabel}</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" onClick={onCheckAgain} disabled={checking}>
              <RefreshCw className={cn("mr-2 h-4 w-4", checking && "animate-spin")} aria-hidden />
              Check again
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleTakeOver()} disabled={checking}>
              Take over dashboard
            </Button>
          </div>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Back to My Games
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
