"use client";

import { GameDashboard } from "@/components/game/game-dashboard";

export default function EphemeralQuickPlayDashboardPage() {
  return <GameDashboard mode="operator" quickGameSurface="ephemeral" />;
}
