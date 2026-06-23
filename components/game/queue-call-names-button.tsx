"use client";

import { useCallback, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import { Button } from "@/components/ui/button";
import {
  announceNextCourtPlayers,
  cancelCallNamesSpeech,
  isCallNamesSpeechSupported,
} from "@/lib/call-names-speech";
import { cn } from "@/lib/utils";

type QueueCallNamesButtonProps = {
  teamA: PlayerPhotoRef[];
  teamB: PlayerPhotoRef[];
  courtNumber?: number | null;
  size?: "sm" | "default";
  className?: string;
};

export function QueueCallNamesButton({
  teamA,
  teamB,
  courtNumber = null,
  size = "sm",
  className,
}: QueueCallNamesButtonProps) {
  const [callingNames, setCallingNames] = useState(false);
  const callNamesRunIdRef = useRef(0);
  const canCall = teamA.length > 0 || teamB.length > 0;

  const cancelPlayerAnnouncement = useCallback(() => {
    callNamesRunIdRef.current += 1;
    cancelCallNamesSpeech();
    setCallingNames(false);
  }, []);

  const handleClick = useCallback(() => {
    if (callingNames) {
      cancelPlayerAnnouncement();
      return;
    }

    if (!isCallNamesSpeechSupported()) {
      toast.error("Text-to-speech is not available in this browser.");
      return;
    }

    if (!canCall) return;

    const runId = callNamesRunIdRef.current + 1;
    callNamesRunIdRef.current = runId;
    setCallingNames(true);
    void announceNextCourtPlayers(teamA, teamB, {
      courtNumber: courtNumber ?? undefined,
      onComplete: () => {
        if (callNamesRunIdRef.current !== runId) return;
        setCallingNames(false);
      },
    }).then((started) => {
      if (callNamesRunIdRef.current !== runId) return;
      if (!started) {
        setCallingNames(false);
        toast.error("Text-to-speech is not available in this browser.");
      }
    });
  }, [callingNames, cancelPlayerAnnouncement, canCall, courtNumber, teamA, teamB]);

  if (!isCallNamesSpeechSupported()) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn(
        "call-names-btn shrink-0",
        courtNumber != null && !callingNames && "call-names-btn--glow",
        callingNames && "call-names-btn--calling call-names-btn--cancel",
        className,
      )}
      disabled={!canCall && !callingNames}
      onClick={handleClick}
      aria-label={callingNames ? "Cancel call names" : "Call player names aloud"}
    >
      {callingNames ? (
        <VolumeX className="call-names-btn-icon mr-1.5 h-4 w-4" aria-hidden />
      ) : (
        <Volume2 className="call-names-btn-icon mr-1.5 h-4 w-4" aria-hidden />
      )}
      {callingNames ? "Cancel" : "Call Names"}
    </Button>
  );
}
