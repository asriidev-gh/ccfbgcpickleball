"use client";

import { Bell, Camera, ImageIcon, Loader2, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";

import { Button } from "@/components/ui/button";
import { decodeQrCodeFromImageFile } from "@/lib/decode-qr-from-image";
import {
  formatZodError,
  getFirstZodErrorField,
  getZodFieldErrors,
} from "@/lib/format-zod-error";
import {
  persistActiveQueueHighlight,
  setQueueHighlightPlayerId,
} from "@/lib/queue-highlight";
import { QR_UPLOAD_REGISTRATION_SOURCE } from "@/lib/registration-feature";
import type { RegistrationFormVariant } from "@/lib/registration-variant";
import {
  ALREADY_REGISTERED_MESSAGE,
  CHECKED_OUT_RE_REGISTER_MESSAGE,
} from "@/lib/registration-messages";
import { genericExistingPlayerSchema } from "@/lib/validations";

type UploadQrIdFlowProps = {
  gameId: string;
  formVariant: RegistrationFormVariant;
  onBack: () => void;
};

type PlayerQueueStatus = "active" | "checked_out" | null;

type LookupPlayer = {
  firstName: string;
  lastName: string;
  personalQrCode: string;
  queueStatus: PlayerQueueStatus;
};

type FieldErrors = Record<string, string>;

export function UploadQrIdFlow({ gameId, formVariant: _formVariant, onBack }: UploadQrIdFlowProps) {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [player, setPlayer] = useState<LookupPlayer | null>(null);

  const showValidationErrors = (error: ZodError) => {
    const errors = getZodFieldErrors(error);
    const firstField = getFirstZodErrorField(error);
    setFieldErrors(errors);
    toast.error((firstField && errors[firstField]) || formatZodError(error));
  };

  const lookupPlayer = async (personalQrCode: string) => {
    setLookupLoading(true);
    try {
      const response = await fetch("/api/register/qr-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalQrCode, gameId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Player QR not found.");

      const queueStatus: PlayerQueueStatus =
        data.queueStatus === "checked_out" || data.queueStatus === "active"
          ? data.queueStatus
          : null;

      setPlayer({
        firstName: data.firstName,
        lastName: data.lastName,
        personalQrCode: data.personalQrCode,
        queueStatus,
      });
      setFieldErrors({});

      if (queueStatus === "checked_out") {
        toast.error(CHECKED_OUT_RE_REGISTER_MESSAGE);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read QR ID.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLookupLoading(true);
    try {
      const code = await decodeQrCodeFromImageFile(file);
      await lookupPlayer(code);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read QR from image.");
      setLookupLoading(false);
    }
  };

  const finishRegistrationSuccess = (registeredPlayerId: unknown) => {
    if (registeredPlayerId != null) {
      const id = String(registeredPlayerId);
      setQueueHighlightPlayerId(gameId, id);
      persistActiveQueueHighlight(gameId, id);
    }
    router.push(`/register/${gameId}/success`);
  };

  const submit = async () => {
    if (!player) {
      toast.error("Scan or upload your personal QR first.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        gameId,
        personalQrCode: player.personalQrCode,
        registrationSource: QR_UPLOAD_REGISTRATION_SOURCE,
      };

      const validation = genericExistingPlayerSchema.safeParse(payload);

      if (!validation.success) {
        showValidationErrors(validation.error);
        setSubmitting(false);
        return;
      }

      setFieldErrors({});

      const response = await fetch("/api/register/existing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.alreadyRegistered) {
          const message =
            typeof data.message === "string"
              ? data.message
              : data.checkedOut
                ? CHECKED_OUT_RE_REGISTER_MESSAGE
                : ALREADY_REGISTERED_MESSAGE;
          toast.error(message);
          if (data.checkedOut) {
            setPlayer((current) =>
              current ? { ...current, queueStatus: "checked_out" } : current,
            );
            setSubmitting(false);
            return;
          }
          finishRegistrationSuccess(data?.player?._id);
          return;
        }
        toast.error(typeof data.message === "string" ? data.message : "Check-in failed.");
        setSubmitting(false);
        return;
      }

      finishRegistrationSuccess(data?.player?._id);
    } catch {
      toast.error("Check-in failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      {lookupLoading || submitting ? (
        <div
          className="register-loading-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="register-loading-overlay-content">
            <Loader2 className="register-loading-spinner" aria-hidden />
            <p className="register-loading-title">
              {submitting ? "Adding you to the queue…" : "Reading QR ID…"}
            </p>
            <p className="register-loading-caption">Please wait a moment.</p>
          </div>
        </div>
      ) : null}

      <Button type="button" variant="outline" size="sm" className="register-back" onClick={onBack}>
        ← Back
      </Button>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose a saved QR image from your gallery or take a new photo to check in quickly.
        </p>

        {!player ? (
          <>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                disabled={lookupLoading}
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImageIcon className="mr-2 h-4 w-4" aria-hidden />
                Choose from gallery
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                disabled={lookupLoading}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" aria-hidden />
                Take photo
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
              Welcome back,{" "}
              <span className="font-medium">
                {player.firstName}
                {player.lastName ? ` ${player.lastName}` : ""}
              </span>
              !
            </div>

            {player.queueStatus === "checked_out" ? (
              <div className="register-checked-out-alert" role="alert">
                <span className="register-checked-out-alert__badge" aria-hidden />
                <div className="register-checked-out-alert__icon" aria-hidden>
                  <Bell className="h-3.5 w-3.5" />
                </div>
                <p className="register-checked-out-alert__text">
                  <span className="register-checked-out-alert__label">Notification</span>
                  <span className="register-checked-out-alert__separator" aria-hidden>
                    ·
                  </span>
                  <span className="register-checked-out-alert__message">
                    {CHECKED_OUT_RE_REGISTER_MESSAGE}
                  </span>
                </p>
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full border-2 border-dashed"
              onClick={() => setPlayer(null)}
            >
              <QrCode className="mr-2 h-5 w-5" aria-hidden />
              Use a different QR
            </Button>

            <Button
              type="button"
              size="lg"
              className="register-submit w-full"
              disabled={submitting || player.queueStatus === "checked_out"}
              onClick={() => void submit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Please wait..
                </>
              ) : (
                "Check in with QR ID"
              )}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
