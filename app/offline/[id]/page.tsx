"use client";

import { useParams } from "next/navigation";

import { OfflineSandboxDashboardRouter } from "@/components/offline/offline-sandbox-dashboard-router";
import { isOfflineSandboxGame } from "@/lib/offline-sandbox-id";

export default function OfflineSandboxPage() {
  const gameId = String(useParams().id ?? "");

  if (!isOfflineSandboxGame(gameId)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Invalid offline session.</p>
      </main>
    );
  }

  return <OfflineSandboxDashboardRouter />;
}
