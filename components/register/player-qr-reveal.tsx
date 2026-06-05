"use client";

import { Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPlayerQrPngFilename,
  isMobileDevice,
  savePlayerQrPng,
} from "@/lib/player-qr-download";

type PlayerQrRevealProps = {
  firstName: string;
  personalQrCode: string;
  personalQrCodeDataUrl?: string;
  gameId: string;
  onContinue: () => void;
};

export function PlayerQrReveal({
  firstName,
  personalQrCode,
  personalQrCodeDataUrl: initialDataUrl,
  gameId,
  onContinue,
}: PlayerQrRevealProps) {
  const [dataUrl, setDataUrl] = useState(initialDataUrl ?? "");
  const [loading, setLoading] = useState(!initialDataUrl);
  const [downloading, setDownloading] = useState(false);
  const isMobile = isMobileDevice();

  useEffect(() => {
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
          `/api/register/player-qr?code=${encodeURIComponent(personalQrCode)}&gameId=${encodeURIComponent(gameId)}`,
        );
        const payload = await response.json();
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
  }, [initialDataUrl, personalQrCode, gameId]);

  const downloadQr = async () => {
    if (!dataUrl) return;

    try {
      setDownloading(true);
      const filename = getPlayerQrPngFilename(firstName, personalQrCode);
      const result = await savePlayerQrPng({ dataUrl, filename });

      if (result === "shared") {
        toast.success("Choose Save image or Photos to store the QR on your phone.");
      } else {
        toast.success("QR saved as PNG. Check your Downloads folder in the Files app.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Failed to save QR.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="register-card border border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="section-title">Your personal QR ID</CardTitle>
      </CardHeader>
      <CardContent className="register-form-compact space-y-4">
        <p className="text-base leading-relaxed text-muted-foreground">
          Save this QR code and show it the next time you play.
          {isMobile
            ? " Tap the button below, then choose Save image or Photos so it is stored on your phone."
            : " You can download it now and keep it on your phone."}
        </p>

        <div className="mx-auto flex w-fit items-center justify-center rounded-xl bg-white p-3 shadow-sm">
          {loading ? (
            <div className="flex size-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : dataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={dataUrl}
              alt={`Personal QR ID for ${firstName}`}
              className="mx-auto block size-64 max-w-[min(280px,calc(100vw-4rem))] object-contain"
            />
          ) : (
            <p className="px-4 py-16 text-sm text-muted-foreground">QR preview unavailable.</p>
          )}
        </div>

        <p className="break-all text-center text-sm text-muted-foreground">{personalQrCode}</p>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!dataUrl || loading || downloading}
            onClick={() => {
              void downloadQr();
            }}
          >
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-2 h-4 w-4" aria-hidden />
            )}
            {downloading
              ? "Saving..."
              : isMobile
                ? "Save QR to phone"
                : "Download QR"}
          </Button>
          <Button type="button" size="lg" className="register-submit w-full" onClick={onContinue}>
            I saved my QR — continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
