"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PlayerQrDialog } from "@/components/game/player-qr-dialog";
import { Button } from "@/components/ui/button";

type PlayerQrPayload = {
  firstName: string;
  personalQrCode: string;
  personalQrCodeDataUrl: string;
  message?: string;
};

export function PlayerProfileQrSection({
  playerId,
  displayName,
  email,
  enabled,
  disabled = false,
}: {
  playerId: string;
  displayName: string;
  email?: string;
  enabled: boolean;
  disabled?: boolean;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEmailSent, setQrEmailSent] = useState(false);

  const qrQuery = useQuery({
    queryKey: ["owner-player-qr", playerId],
    enabled: enabled && Boolean(playerId),
    queryFn: async () => {
      const response = await fetch(
        `/api/owner/registered-players/${encodeURIComponent(playerId)}/qr`,
      );
      const payload = (await response.json()) as PlayerQrPayload;
      if (!response.ok) throw new Error(payload.message ?? "Failed to load player QR code.");
      return payload;
    },
    retry: false,
  });

  useEffect(() => {
    if (!enabled) setQrEmailSent(false);
  }, [enabled, playerId]);

  const resendQrEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/owner/registered-players/${encodeURIComponent(playerId)}/welcome-email`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { message?: string; emailSent?: boolean };
      if (!response.ok) throw new Error(payload.message ?? "Failed to resend QR code email.");
      if (!payload.emailSent) {
        throw new Error(payload.message ?? "QR code email could not be sent.");
      }
      return payload;
    },
    onSuccess: (payload) => {
      setQrEmailSent(true);
      toast.success(payload.message ?? "QR code email sent.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to resend QR code email.");
    },
  });

  const copyQrCode = async () => {
    const code = qrQuery.data?.personalQrCode?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Personal QR ID copied.");
    } catch {
      toast.error("Could not copy QR ID.");
    }
  };

  if (qrQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (qrQuery.isError) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        {qrQuery.error instanceof Error ? qrQuery.error.message : "QR code unavailable."}
      </p>
    );
  }

  if (!qrQuery.data?.personalQrCodeDataUrl) {
    return <p className="py-6 text-sm text-muted-foreground">No personal QR code on file.</p>;
  }

  return (
    <>
      <div className="mx-auto flex max-w-sm flex-col gap-3">
        <button
          type="button"
          className="player-profile-view-qr mx-auto flex w-fit cursor-pointer items-center justify-center rounded-xl bg-white p-3 shadow-sm outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View full QR code for ${displayName}`}
          onClick={() => setQrOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrQuery.data.personalQrCodeDataUrl}
            alt={`Personal QR for ${displayName}`}
            className="mx-auto block size-48 max-w-full object-contain"
          />
        </button>
        <p className="break-all text-center text-sm text-muted-foreground">
          {qrQuery.data.personalQrCode}
        </p>
        <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={copyQrCode}>
          <Copy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          Copy QR ID
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={
            disabled ||
            qrEmailSent ||
            resendQrEmailMutation.isPending ||
            !email?.trim()
          }
          onClick={() => resendQrEmailMutation.mutate()}
        >
          {resendQrEmailMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
              Sending…
            </>
          ) : qrEmailSent ? (
            "QR successfully sent!"
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Resend QR code
            </>
          )}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Tap the QR code to zoom in, copy the personal QR ID, or email it to the player.
        </p>
      </div>
      <PlayerQrDialog
        displayName={displayName}
        personalQrCode={qrQuery.data.personalQrCode}
        personalQrCodeDataUrl={qrQuery.data.personalQrCodeDataUrl}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    </>
  );
}
