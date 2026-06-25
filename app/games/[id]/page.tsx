"use client";

import { useParams } from "next/navigation";

import { LiveGameDashboardRouter } from "@/components/game/live-game-dashboard-router";
import { QuickPlayDashboardRouter } from "@/components/play/quick-play-dashboard-router";
import { isQuickGame } from "@/lib/local-game-id";

export default function GameDashboardPage() {
  const gameId = String(useParams().id ?? "");

  if (isQuickGame(gameId)) {
    return <QuickPlayDashboardRouter quickGameSurface="account" />;
  }

  return <LiveGameDashboardRouter />;
}
