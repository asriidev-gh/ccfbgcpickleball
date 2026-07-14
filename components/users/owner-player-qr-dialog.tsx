"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPlayerQrPngFilename,
  isMobileDevice,
  savePlayerQrPng,
} from "@/lib/player-qr-download";
import { ownerHubQueryOptions } from "@/lib/owner-hub-query-options";

type OwnerPlayerQrResponse = {
  firstName: string;
  personalQrCode: string;
  personalQrCodeDataUrl: string;
  message?: string;
};

export function OwnerPlayerQrDialog({
  player,
  onClose,
}: {
  player: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const isMobile = isMobileDevice();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["owner-player-qr", player?.id],
    enabled: Boolean(player),
    queryFn: async () => {
      const response = await fetch(
        `/api/owner/registered-players/${encodeURIComponent(player!.id)}/qr`,
      );
      const payload = (await response.json()) as OwnerPlayerQrResponse;
      if (!response.ok) throw new Error(payload.message ?? "Failed to load QR code.");
      return payload;
    },
    ...ownerHubQueryOptions,
  });

  const downloadQr = async () => {
    if (!data?.personalQrCodeDataUrl || !data.personalQrCode) return;

    try {
      setDownloading(true);
      const filename = getPlayerQrPngFilename(data.firstName || player?.name || "Player", data.personalQrCode);
      await savePlayerQrPng({
        dataUrl: data.personalQrCodeDataUrl,
        filename,
      });
      toast.success("QR saved to Downloads.");
    } catch (downloadError) {
      if (downloadError instanceof Error && downloadError.name === "AbortError") return;
      toast.error(
        downloadError instanceof Error ? downloadError.message : "Failed to save QR.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={Boolean(player)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{player?.name ?? "Player"} · QR code</DialogTitle>
          <DialogDescription>
            Personal QR ID for quick registration at your open play sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="mx-auto flex w-fit items-center justify-center rounded-xl bg-white p-3 shadow-sm">
            {isLoading ? (
              <div className="flex size-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : isError ? (
              <p className="px-4 py-16 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load QR code."}
              </p>
            ) : data?.personalQrCodeDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={data.personalQrCodeDataUrl}
                alt={`Personal QR ID for ${player?.name ?? "player"}`}
                className="mx-auto block size-64 max-w-[min(280px,calc(100vw-4rem))] object-contain"
              />
            ) : (
              <p className="px-4 py-16 text-sm text-muted-foreground">QR preview unavailable.</p>
            )}
          </div>

          {data?.personalQrCode ? (
            <p className="break-all text-center text-sm text-muted-foreground">
              {data.personalQrCode}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!data?.personalQrCodeDataUrl || isLoading || downloading}
            onClick={() => {
              void downloadQr();
            }}
          >
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-2 h-4 w-4" aria-hidden />
            )}
            {downloading ? "Saving…" : isMobile ? "Save QR to phone" : "Download QR"}
          </Button>
          <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
