"use client";

import { Eye, Loader2, QrCode } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchGameRegistrationStatus } from "@/components/game/registration-capacity-prompt";
import { RegisterAnotherPlayerButton } from "@/components/register/register-another-player-button";
import { useNavigateToSpectate } from "@/components/register/use-navigate-to-spectate";
import { Button } from "@/components/ui/button";
import { isQrIdRegistrationEnabled } from "@/lib/registration-feature";

export function RegisterSuccessActions({ gameId }: { gameId: string }) {
  const { navigateToSpectate, navigating } = useNavigateToSpectate(gameId);
  const [qrIdEnabled, setQrIdEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const status = await fetchGameRegistrationStatus(gameId);
        if (!cancelled) {
          setQrIdEnabled(isQrIdRegistrationEnabled(status.registrationFeature));
        }
      } catch {
        if (!cancelled) setQrIdEnabled(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
        className="register-submit w-full"
        disabled={navigating}
        onClick={() => void navigateToSpectate()}
      >
        {navigating ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Eye className="mr-2 h-5 w-5" aria-hidden />
        )}
        {navigating ? "Loading queue…" : "Proceed to the Game Queue!"}
      </Button>
      <RegisterAnotherPlayerButton gameId={gameId} />
      {qrIdEnabled ? (
        <Link href={`/register/${gameId}?mode=upload-qr`}>
          <Button size="lg" variant="outline" className="w-full">
            <QrCode className="mr-2 h-5 w-5" aria-hidden />
            Upload QR ID
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
