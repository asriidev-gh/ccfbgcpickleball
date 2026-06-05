"use client";

import { Eye, QrCode } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchGameRegistrationStatus } from "@/components/game/registration-capacity-prompt";
import { RegisterAnotherPlayerButton } from "@/components/register/register-another-player-button";
import { Button } from "@/components/ui/button";
import { isQrIdRegistrationEnabled } from "@/lib/registration-feature";
import {
  getActiveQueueHighlightPlayerId,
  setQueueHighlightPlayerId,
} from "@/lib/queue-highlight";

export function RegisterSuccessActions({ gameId }: { gameId: string }) {
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

  const handleProceedToQueue = () => {
    const activePlayerId = getActiveQueueHighlightPlayerId(gameId);
    if (activePlayerId) {
      setQueueHighlightPlayerId(gameId, activePlayerId);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Link href={`/games/${gameId}/spectate`} onClick={handleProceedToQueue}>
        <Button size="lg" className="register-submit w-full">
          <Eye className="mr-2 h-5 w-5" />
          Proceed to the Game Queue!
        </Button>
      </Link>
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
