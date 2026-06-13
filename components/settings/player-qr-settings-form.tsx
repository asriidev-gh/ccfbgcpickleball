"use client";

import Link from "next/link";

import { PlayerQrSettingsPanel } from "@/components/settings/player-qr-settings-panel";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** @deprecated Use Settings dialog (Account menu → Settings). Kept for direct imports. */
export function PlayerQrSettingsForm() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-xl">Player QR download</CardTitle>
      </CardHeader>
      <CardContent>
        <PlayerQrSettingsPanel />
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}>
          Back to home
        </Link>
      </CardContent>
    </Card>
  );
}
