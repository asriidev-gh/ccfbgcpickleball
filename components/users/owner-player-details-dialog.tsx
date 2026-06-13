"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";

import { PlayerQrDialog } from "@/components/game/player-qr-dialog";
import { CcfQuestionnaireSection } from "@/components/register/ccf-questionnaire-section";
import { RegistrationPhotoField } from "@/components/register/registration-photo-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CCF_ATTENDED_NOT_YET } from "@/lib/ccf-registration";
import {
  formatZodError,
  getFirstZodErrorField,
  getZodFieldErrors,
} from "@/lib/format-zod-error";
import type { OwnerPlayerProfile } from "@/lib/owner-registered-players-shared";
import {
  GENDER_OPTIONS,
  PICKLEBALL_LEVELS,
  type GenderOption,
  type PickleballLevel,
} from "@/lib/player-profile-shared";
import { profileCcfFieldsSchema, ownerProfileBaseSchema } from "@/lib/validations";

type CcfEventsBeforeAnswer = "yes" | "not_yet";
type FieldErrors = Record<string, string>;

type PlayerQrPayload = {
  firstName: string;
  personalQrCode: string;
  personalQrCodeDataUrl: string;
  message?: string;
};

function formatMobileNumberInput(value: string, forcePrefix = false): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!forcePrefix && digits.length === 0) return "";

  const tail = digits.startsWith("09")
    ? digits.slice(2)
    : digits.startsWith("9")
      ? digits.slice(1)
      : digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  const normalized = `09${tail}`.slice(0, 11);
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

function ProfileSelectField({
  id,
  placeholder,
  value,
  options,
  disabled,
  invalid,
  onChange,
}: {
  id: string;
  placeholder: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || null}
      disabled={disabled}
      onValueChange={(next) => onChange(next ?? "")}
    >
      <SelectTrigger
        id={id}
        aria-invalid={invalid}
        className="h-8 w-full bg-background text-foreground"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover text-popover-foreground">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OwnerPlayerDetailsDialog({
  player,
  onClose,
}: {
  player: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const playerId = player?.id ?? "";
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [mobileTouched, setMobileTouched] = useState(false);
  const [ccfEventsBefore, setCcfEventsBefore] = useState<CcfEventsBeforeAnswer | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobileNumber: "",
    email: "",
    gender: "" as GenderOption | "",
    birthdate: "",
    biography: "",
    pickleballLevel: "" as PickleballLevel | "",
    isPartOfDgroup: null as boolean | null,
    wantsToJoinDgroup: null as boolean | null,
    attendedEvents: [] as string[],
    attendedEventsOther: "",
  });
  const [showCcf, setShowCcf] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEmailSent, setQrEmailSent] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["owner-player-profile", playerId],
    enabled: Boolean(player),
    queryFn: async () => {
      const response = await fetch(
        `/api/owner/registered-players/${encodeURIComponent(playerId)}/profile`,
      );
      const payload = (await response.json()) as OwnerPlayerProfile & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load player profile.");
      return payload;
    },
  });

  const qrQuery = useQuery({
    queryKey: ["owner-player-qr", playerId],
    enabled: Boolean(player),
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
    if (!data) return;
    setShowCcf(data.showCcfQuestionnaire);
    setCcfEventsBefore(data.ccfEventsBefore);
    setPhotoUrl(data.photoUrl);
    setIsBlocked(data.isBlocked);
    setPhotoFile(null);
    setFieldErrors({});
    setQrEmailSent(false);
    setForm({
      firstName: data.firstName,
      lastName: data.lastName,
      mobileNumber: data.mobileNumber,
      email: data.email,
      gender: data.gender,
      birthdate: data.birthdate,
      biography: data.biography,
      pickleballLevel: data.pickleballLevel,
      isPartOfDgroup: data.isPartOfDgroup,
      wantsToJoinDgroup: data.wantsToJoinDgroup,
      attendedEvents: data.attendedEvents,
      attendedEventsOther: data.attendedEventsOther,
    });
  }, [data]);

  useEffect(() => {
    if (!player) {
      setQrEmailSent(false);
    }
  }, [player]);

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

  const clearFieldError = (name: string) => {
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const renderFieldError = (name: string) =>
    fieldErrors[name] ? (
      <p id={`${name}-error`} className="text-sm text-destructive" role="alert">
        {fieldErrors[name]}
      </p>
    ) : null;

  const showValidationErrors = (validationError: ZodError) => {
    const errors = getZodFieldErrors(validationError);
    setFieldErrors(errors);
    const firstField = getFirstZodErrorField(validationError);
    toast.error((firstField && errors[firstField]) || formatZodError(validationError));
  };

  const buildCcfPayload = () => {
    if (ccfEventsBefore === "not_yet") {
      return {
        isPartOfDgroup: false,
        wantsToJoinDgroup: null as boolean | null,
        attendedEvents: [CCF_ATTENDED_NOT_YET],
        attendedEventsOther: "",
      };
    }

    if (ccfEventsBefore === "yes") {
      return {
        isPartOfDgroup: form.isPartOfDgroup ?? false,
        wantsToJoinDgroup: form.isPartOfDgroup === true ? null : form.wantsToJoinDgroup,
        attendedEvents: form.attendedEvents,
        attendedEventsOther: form.attendedEventsOther,
      };
    }

    return {
      isPartOfDgroup: false,
      wantsToJoinDgroup: null as boolean | null,
      attendedEvents: [] as string[],
      attendedEventsOther: "",
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const basePayload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        mobileNumber: form.mobileNumber,
        gender: form.gender,
        birthdate: form.birthdate,
        biography: form.biography,
        pickleballLevel: form.pickleballLevel,
      };

      const baseValidation = ownerProfileBaseSchema.safeParse(basePayload);
      if (!baseValidation.success) {
        showValidationErrors(baseValidation.error);
        throw new Error("validation");
      }

      let ccfPayload: ReturnType<typeof buildCcfPayload> | null = null;
      if (showCcf) {
        ccfPayload = buildCcfPayload();
        const ccfValidation = profileCcfFieldsSchema.safeParse(ccfPayload);
        if (!ccfValidation.success) {
          showValidationErrors(ccfValidation.error);
          throw new Error("validation");
        }
      }

      setFieldErrors({});

      const body = new FormData();
      body.append("firstName", basePayload.firstName);
      body.append("lastName", basePayload.lastName);
      body.append("email", basePayload.email);
      body.append("mobileNumber", basePayload.mobileNumber);
      body.append("gender", basePayload.gender);
      body.append("birthdate", basePayload.birthdate);
      body.append("biography", basePayload.biography);
      body.append("pickleballLevel", basePayload.pickleballLevel);

      if (showCcf && ccfPayload) {
        body.append("isPartOfDgroup", String(ccfPayload.isPartOfDgroup));
        body.append(
          "wantsToJoinDgroup",
          ccfPayload.wantsToJoinDgroup === null ? "null" : String(ccfPayload.wantsToJoinDgroup),
        );
        body.append("attendedEvents", JSON.stringify(ccfPayload.attendedEvents));
        body.append("attendedEventsOther", ccfPayload.attendedEventsOther);
      }

      if (photoFile) body.append("photo", photoFile);

      const response = await fetch(
        `/api/owner/registered-players/${encodeURIComponent(playerId)}/profile`,
        { method: "PATCH", body },
      );
      const payload = (await response.json()) as {
        message?: string;
        profile: OwnerPlayerProfile;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update player profile.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Player profile updated.");
      queryClient.setQueryData(["owner-player-profile", playerId], payload.profile);
      queryClient.invalidateQueries({ queryKey: ["owner-registered-players"] });
      onClose();
    },
    onError: (saveError) => {
      if (saveError instanceof Error && saveError.message === "validation") return;
      toast.error(
        saveError instanceof Error ? saveError.message : "Failed to update player profile.",
      );
    },
  });

  const selectCcfEventsBefore = (answer: CcfEventsBeforeAnswer) => {
    clearFieldError("attendedEvents");
    clearFieldError("isPartOfDgroup");
    clearFieldError("wantsToJoinDgroup");
    setCcfEventsBefore(answer);
    if (answer === "not_yet") {
      setForm((prev) => ({
        ...prev,
        attendedEvents: [],
        attendedEventsOther: "",
        isPartOfDgroup: null,
        wantsToJoinDgroup: null,
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      attendedEvents: [],
      isPartOfDgroup: null,
      wantsToJoinDgroup: null,
    }));
  };

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

  return (
    <>
    <Dialog open={Boolean(player)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {player?.name ?? "Player details"}
            {isBlocked ? (
              <Badge variant="destructive" className="text-[0.625rem]">
                Blocked
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            View and update this player&apos;s profile across your open play sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          {isLoading ? (
            <p className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading profile…
            </p>
          ) : isError ? (
            <p className="py-6 text-destructive">
              {error instanceof Error ? error.message : "Failed to load profile."}
            </p>
          ) : (
            <form
              id="owner-player-profile-form"
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <RegistrationPhotoField
                disabled={saveMutation.isPending}
                error={fieldErrors.photo}
                optional
                currentPhotoUrl={photoUrl}
                onChange={(file) => {
                  clearFieldError("photo");
                  setPhotoFile(file);
                }}
              />

              <div className="register-field-grid">
                <div className="register-field space-y-1.5">
                  <Label htmlFor="owner-profile-firstName">First name</Label>
                  <Input
                    id="owner-profile-firstName"
                    value={form.firstName}
                    aria-invalid={Boolean(fieldErrors.firstName)}
                    disabled={saveMutation.isPending}
                    onChange={(event) => {
                      clearFieldError("firstName");
                      setForm((prev) => ({ ...prev, firstName: event.target.value }));
                    }}
                  />
                  {renderFieldError("firstName")}
                </div>
                <div className="register-field space-y-1.5">
                  <Label htmlFor="owner-profile-lastName">Last name</Label>
                  <Input
                    id="owner-profile-lastName"
                    value={form.lastName}
                    aria-invalid={Boolean(fieldErrors.lastName)}
                    disabled={saveMutation.isPending}
                    onChange={(event) => {
                      clearFieldError("lastName");
                      setForm((prev) => ({ ...prev, lastName: event.target.value }));
                    }}
                  />
                  {renderFieldError("lastName")}
                </div>
                <div className="register-field space-y-1.5 md:col-span-2">
                  <Label htmlFor="owner-profile-mobileNumber">Mobile number</Label>
                  <Input
                    id="owner-profile-mobileNumber"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="09XX-XXXXXXX"
                    value={form.mobileNumber}
                    maxLength={12}
                    aria-invalid={Boolean(fieldErrors.mobileNumber)}
                    disabled={saveMutation.isPending}
                    onFocus={() => {
                      if (mobileTouched) return;
                      setMobileTouched(true);
                      if (!form.mobileNumber) {
                        setForm((prev) => ({ ...prev, mobileNumber: "09" }));
                      }
                    }}
                    onChange={(event) => {
                      clearFieldError("mobileNumber");
                      setForm((prev) => ({
                        ...prev,
                        mobileNumber: formatMobileNumberInput(event.target.value, mobileTouched),
                      }));
                    }}
                  />
                  {renderFieldError("mobileNumber")}
                </div>
                <div className="register-field space-y-1.5 md:col-span-2">
                  <Label htmlFor="owner-profile-email">Email</Label>
                  <Input
                    id="owner-profile-email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    aria-invalid={Boolean(fieldErrors.email)}
                    disabled={saveMutation.isPending}
                    onChange={(event) => {
                      clearFieldError("email");
                      setForm((prev) => ({ ...prev, email: event.target.value }));
                    }}
                  />
                  {renderFieldError("email")}
                </div>
                <div className="register-field space-y-1.5">
                  <Label htmlFor="owner-profile-gender">Gender</Label>
                  <ProfileSelectField
                    id="owner-profile-gender"
                    placeholder="Select gender"
                    value={form.gender}
                    options={GENDER_OPTIONS}
                    disabled={saveMutation.isPending}
                    invalid={Boolean(fieldErrors.gender)}
                    onChange={(gender) => {
                      clearFieldError("gender");
                      setForm((prev) => ({
                        ...prev,
                        gender: gender as GenderOption | "",
                      }));
                    }}
                  />
                  {renderFieldError("gender")}
                </div>
                <div className="register-field space-y-1.5">
                  <Label htmlFor="owner-profile-birthdate">Birthdate</Label>
                  <Input
                    id="owner-profile-birthdate"
                    type="date"
                    value={form.birthdate}
                    aria-invalid={Boolean(fieldErrors.birthdate)}
                    disabled={saveMutation.isPending}
                    onChange={(event) => {
                      clearFieldError("birthdate");
                      setForm((prev) => ({ ...prev, birthdate: event.target.value }));
                    }}
                  />
                  {renderFieldError("birthdate")}
                </div>
                <div className="register-field space-y-1.5 md:col-span-2">
                  <Label htmlFor="owner-profile-pickleballLevel">Pickleball level</Label>
                  <ProfileSelectField
                    id="owner-profile-pickleballLevel"
                    placeholder="Select level"
                    value={form.pickleballLevel}
                    options={PICKLEBALL_LEVELS}
                    disabled={saveMutation.isPending}
                    invalid={Boolean(fieldErrors.pickleballLevel)}
                    onChange={(pickleballLevel) => {
                      clearFieldError("pickleballLevel");
                      setForm((prev) => ({
                        ...prev,
                        pickleballLevel: pickleballLevel as PickleballLevel | "",
                      }));
                    }}
                  />
                  {renderFieldError("pickleballLevel")}
                </div>
                <div className="register-field space-y-1.5 md:col-span-2">
                  <div className="flex items-end justify-between gap-3">
                    <Label htmlFor="owner-profile-biography">Biography</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {form.biography.length}/500
                    </span>
                  </div>
                  <Textarea
                    id="owner-profile-biography"
                    value={form.biography}
                    maxLength={500}
                    rows={4}
                    placeholder="Tell others a little about yourself…"
                    aria-invalid={Boolean(fieldErrors.biography)}
                    disabled={saveMutation.isPending}
                    onChange={(event) => {
                      clearFieldError("biography");
                      setForm((prev) => ({ ...prev, biography: event.target.value }));
                    }}
                  />
                  {renderFieldError("biography")}
                </div>
              </div>

              {showCcf ? (
                <div className="space-y-4 border-t pt-6">
                  <p className="text-sm font-medium">CCF questionnaire</p>
                  <CcfQuestionnaireSection
                    ccfEventsBefore={ccfEventsBefore}
                    attendedEvents={form.attendedEvents}
                    isPartOfDgroup={form.isPartOfDgroup}
                    wantsToJoinDgroup={form.wantsToJoinDgroup}
                    fieldErrors={fieldErrors}
                    disabled={saveMutation.isPending}
                    onSelectCcfEventsBefore={selectCcfEventsBefore}
                    onToggleEvent={(item, checked) => {
                      clearFieldError("attendedEvents");
                      setForm((prev) => ({
                        ...prev,
                        attendedEvents: checked
                          ? [...prev.attendedEvents, item]
                          : prev.attendedEvents.filter((value) => value !== item),
                      }));
                    }}
                    onSelectDgroupMembership={(inDgroup) => {
                      clearFieldError("isPartOfDgroup");
                      clearFieldError("wantsToJoinDgroup");
                      setForm((prev) => ({
                        ...prev,
                        isPartOfDgroup: inDgroup,
                        wantsToJoinDgroup: inDgroup ? null : prev.wantsToJoinDgroup,
                      }));
                    }}
                    onSelectWantsToJoinDgroup={(wantsToJoin) => {
                      clearFieldError("wantsToJoinDgroup");
                      setForm((prev) => ({ ...prev, wantsToJoinDgroup: wantsToJoin }));
                    }}
                    renderFieldError={renderFieldError}
                  />
                </div>
              ) : null}

              <section className="space-y-3 border-t border-border/60 pt-6">
                <h3 className="text-sm font-semibold text-foreground">Personal QR code</h3>
                {qrQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
                  </div>
                ) : qrQuery.isError ? (
                  <p className="text-sm text-muted-foreground">
                    {qrQuery.error instanceof Error
                      ? qrQuery.error.message
                      : "QR code unavailable."}
                  </p>
                ) : qrQuery.data?.personalQrCodeDataUrl ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      className="player-profile-view-qr mx-auto flex w-fit cursor-pointer items-center justify-center rounded-xl bg-white p-3 shadow-sm outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`View full QR code for ${player?.name ?? "player"}`}
                      onClick={() => setQrOpen(true)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrQuery.data.personalQrCodeDataUrl}
                        alt={`Personal QR for ${player?.name ?? "player"}`}
                        className="mx-auto block size-48 max-w-full object-contain"
                      />
                    </button>
                    <p className="break-all text-center text-sm text-muted-foreground">
                      {qrQuery.data.personalQrCode}
                    </p>
                    <Button type="button" variant="outline" className="w-full" onClick={copyQrCode}>
                      <Copy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                      Copy QR ID
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={
                        qrEmailSent ||
                        resendQrEmailMutation.isPending ||
                        saveMutation.isPending ||
                        !form.email.trim()
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
                      Tap the QR code to zoom in, copy the personal QR ID, or email it to the
                      player.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No personal QR code on file.</p>
                )}
              </section>
            </form>
          )}
        </div>

        {!isLoading && !isError ? (
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
              Close
            </Button>
            <Button
              type="submit"
              form="owner-player-profile-form"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
    {qrQuery.data?.personalQrCodeDataUrl ? (
      <PlayerQrDialog
        displayName={player?.name ?? "Player"}
        personalQrCode={qrQuery.data.personalQrCode}
        personalQrCodeDataUrl={qrQuery.data.personalQrCodeDataUrl}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    ) : null}
    </>
  );
}
