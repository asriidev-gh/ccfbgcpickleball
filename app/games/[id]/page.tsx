"use client";

import { useParams } from "next/navigation";

import { GameDashboard } from "@/components/game/game-dashboard";
import { QuickPlayDashboardRouter } from "@/components/play/quick-play-dashboard-router";
import { isQuickGame } from "@/lib/local-game-id";

export default function GameDashboardPage() {
  const gameId = String(useParams().id ?? "");

  if (isQuickGame(gameId)) {
    return <QuickPlayDashboardRouter quickGameSurface="account" />;
  }

  return <GameDashboard mode="operator" />;
}
