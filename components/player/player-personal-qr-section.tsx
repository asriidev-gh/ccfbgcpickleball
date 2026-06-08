"use client";

import { Copy, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PlayerQrDialog } from "@/components/game/player-qr-dialog";
import { Button } from "@/components/ui/button";
import {
  getPlayerQrPngFilename,
  isMobileDevice,
  savePlayerQrPng,
} from "@/lib/player-qr-download";
import { formatPlayerDisplayName } from "@/lib/utils";

type PlayerPersonalQrSectionProps = {
  firstName: string;
  lastName?: string;
  personalQrCode: string;
  gameId: string;
  personalQrCodeDataUrl?: string;
  className?: string;
  compact?: boolean;
};

export function PlayerPersonalQrSection({
  firstName,
  lastName = "",
  personalQrCode,
  gameId,
  personalQrCodeDataUrl: initialDataUrl,
  className,
  compact = false,
}: PlayerPersonalQrSectionProps) {
  const [dataUrl, setDataUrl] = useState(initialDataUrl ?? "");
  const [loading, setLoading] = useState(!initialDataUrl && Boolean(personalQrCode));
  const [downloading, setDownloading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const isMobile = isMobileDevice();
  const displayName = formatPlayerDisplayName(firstName, lastName) || firstName || "Player";
  const code = personalQrCode.trim();

  useEffect(() => {
    if (!code) {
      setDataUrl("");
      setLoading(false);
      return;
    }

    if (initialDataUrl) {
      setDataUrl(initialDataUrl);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/register/player-qr?code=${encodeURIComponent(code)}&gameId=${encodeURIComponent(gameId)}`,
        );
        const payload = (await response.json()) as {
          personalQrCodeDataUrl?: string;
          message?: string;
        };
        if (!response.ok) throw new Error(payload.message ?? "Failed to load QR code.");
        if (!cancelled) setDataUrl(payload.personalQrCodeDataUrl ?? "");
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load QR code.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [code, gameId, initialDataUrl]);

  const copyQrCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Personal QR ID copied.");
    } catch {
      toast.error("Could not copy QR ID.");
    }
  };

  const downloadQr = async () => {
    if (!dataUrl || !code) return;

    try {
      setDownloading(true);
      const filename = getPlayerQrPngFilename(firstName, code);
      const result = await savePlayerQrPng({ dataUrl, filename });

      if (result === "shared") {
        toast.success("Choose Save image or Photos to store the QR on your phone.");
      } else {
        toast.success("QR saved as PNG.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Failed to save QR.");
    } finally {
      setDownloading(false);
    }
  };

  if (!code) {
    return (
      <section
        className={
          className ??
          (compact
            ? "space-y-2 border-t border-border/60 pt-4"
            : "space-y-3 border-t border-border/60 pt-6")
        }
      >
        <h3 className="text-sm font-semibold text-foreground">Personal QR code</h3>
        <p className="text-sm text-muted-foreground">No personal QR code on file.</p>
      </section>
    );
  }

  return (
    <section
      className={
        className ??
        (compact
          ? "space-y-2 border-t border-border/60 pt-4"
          : "space-y-3 border-t border-border/60 pt-6")
      }
    >
      <h3 className="text-sm font-semibold text-foreground">Personal QR code</h3>
      <p className="text-sm text-muted-foreground">
        Show this QR at future open play sessions for quick check-in.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : dataUrl ? (
        <div className={compact ? "space-y-2" : "space-y-3"}>
          <button
            type="button"
            className="player-personal-qr-preview mx-auto flex w-fit cursor-pointer items-center justify-center rounded-xl bg-white shadow-sm outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            style={{ padding: compact ? 8 : 12 }}
            aria-label={`View full QR code for ${displayName}`}
            onClick={() => setQrOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt={`Personal QR for ${displayName}`}
              className={compact ? "mx-auto block size-40 max-w-full object-contain" : "mx-auto block size-48 max-w-full object-contain"}
            />
          </button>
          <p className="break-all text-center text-sm text-muted-foreground">{code}</p>
          <div className={compact ? "flex flex-col gap-1 sm:flex-row" : "flex flex-col gap-2 sm:flex-row"}>
            <Button type="button" variant="outline" className="flex-1" onClick={copyQrCode}>
              <Copy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Copy QR ID
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={downloading}
              onClick={() => {
                void downloadQr();
              }}
            >
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              )}
              {downloading ? "Saving…" : isMobile ? "Save QR to phone" : "Download QR"}
            </Button>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Tap the QR code to zoom in, or use the buttons to copy or save it.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">QR preview unavailable.</p>
      )}

      {dataUrl ? (
        <PlayerQrDialog
          displayName={displayName}
          personalQrCode={code}
          personalQrCodeDataUrl={dataUrl}
          open={qrOpen}
          onOpenChange={setQrOpen}
        />
      ) : null}
    </section>
  );
}
