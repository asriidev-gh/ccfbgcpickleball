"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";

import {
  fetchGameRegistrationStatus,
  getRegistrationBlockedMessage,
  promptIfRegistrationFullFromStatus,
} from "@/components/game/registration-capacity-prompt";
import { RegistrationPhotoField } from "@/components/register/registration-photo-field";
import { useNavigateToSpectate } from "@/components/register/use-navigate-to-spectate";
import type { GameRegistrationStatus } from "@/lib/game-registration-limit";
import {
  persistActiveQueueHighlight,
  setQueueHighlightPlayerId,
} from "@/lib/queue-highlight";
import { isQrIdRegistrationEnabled } from "@/lib/registration-feature";
import { REGISTRATION_PHOTO_REQUIRED_MESSAGE } from "@/lib/registration-photo";
import {
  isRegistrationPhotoRequired,
  type RegistrationFormVariant,
} from "@/lib/registration-variant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatZodError,
  getFirstZodErrorField,
  getZodFieldErrors,
} from "@/lib/format-zod-error";
import { REGISTRATION_RESET_EVENT } from "@/lib/registration-reset";
import { ALREADY_REGISTERED_MESSAGE } from "@/lib/registration-messages";
import { CCF_ATTENDED_NOT_YET, CCF_EVENT_OPTIONS } from "@/lib/ccf-registration";
import {
  existingPlayerSchema,
  genericPlayerSchema,
  newPlayerSchema,
  volunteerExistingPlayerSchema,
  volunteerNewPlayerSchema,
} from "@/lib/validations";
import { cn } from "@/lib/utils";

const UploadQrIdFlow = dynamic(
  () =>
    import("@/components/register/upload-qr-id-flow").then((mod) => mod.UploadQrIdFlow),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[10rem] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading QR check-in…
      </div>
    ),
  },
);

const PlayerQrReveal = dynamic(
  () =>
    import("@/components/register/player-qr-reveal").then((mod) => mod.PlayerQrReveal),
  { ssr: false },
);

type FieldErrors = Record<string, string>;
type CcfEventsBeforeAnswer = "yes" | "not_yet";

const REGISTRATION_VOLUNTEER_TYPE = "Pickleball";

function formatMobileNumberInput(value: string, forcePrefix = false): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!forcePrefix && digits.length === 0) return "";

  const tail =
    digits.startsWith("09")
      ? digits.slice(2)
      : digits.startsWith("9")
        ? digits.slice(1)
        : digits.startsWith("0")
          ? digits.slice(1)
          : digits;
  const normalized = (`09${tail}`).slice(0, 11);
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

type RegistrationFormMode = "upload-qr";
type RegistrationRole = "existing-player" | "new-player" | "volunteer" | "upload-qr";
type EntryStep = "role" | "has-qr" | "done";
type CheckInAs = "player" | "volunteer";
type PendingEntryAction =
  | "player"
  | "volunteer"
  | "spectator"
  | "has-qr-yes"
  | "has-qr-no"
  | null;

type PendingQrReveal = {
  playerId: string;
  firstName: string;
  personalQrCode: string;
  personalQrCodeDataUrl?: string;
};

export function RegistrationForm({
  gameId,
  gameTitle,
  formVariant,
  initialRegistrationStatus,
  initialMode,
  initialRole,
  onLeaveRole,
}: {
  gameId: string;
  gameTitle?: string;
  formVariant: RegistrationFormVariant;
  initialRegistrationStatus?: GameRegistrationStatus | null;
  initialMode?: RegistrationFormMode;
  /** When set (e.g. from RegistrationEntry), skip the check-in gate. */
  initialRole?: "new-player" | "volunteer" | "upload-qr";
  onLeaveRole?: () => void;
}) {
  const router = useRouter();
  const { navigateToSpectate, navigating: navigatingToSpectate } = useNavigateToSpectate(gameId);
  const isGenericForm = formVariant === "generic";
  const skipEntryFlow = Boolean(initialRole) || initialMode === "upload-qr";
  const resolvedInitialRole: RegistrationRole | "" =
    initialRole ?? (initialMode === "upload-qr" ? "upload-qr" : "");
  const [entryStep, setEntryStep] = useState<EntryStep>(skipEntryFlow ? "done" : "role");
  const [role, setRole] = useState<RegistrationRole | "">(resolvedInitialRole);
  const [checkInAs, setCheckInAs] = useState<CheckInAs | null>(null);
  const [pendingQrReveal, setPendingQrReveal] = useState<PendingQrReveal | null>(null);
  const [pendingEntryAction, setPendingEntryAction] = useState<PendingEntryAction>(null);
  const [pendingRole, setPendingRole] = useState<
    "new-player" | "volunteer" | "upload-qr" | null
  >(null);
  const [mobileTouched, setMobileTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<GameRegistrationStatus | null>(
    initialRegistrationStatus ?? null,
  );
  const [statusLoading, setStatusLoading] = useState(!initialRegistrationStatus);
  const [ccfEventsBefore, setCcfEventsBefore] = useState<CcfEventsBeforeAnswer | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "male" as "male" | "female",
    birthdate: "",
    mobileNumber: "",
    email: "",
    personalQrCode: "",
    isPartOfDgroup: null as boolean | null,
    wantsToJoinDgroup: null as boolean | null,
    attendedEvents: [] as string[],
    attendedEventsOther: "",
  });

  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const eventsBlockRef = useRef<HTMLDivElement>(null);
  const dgroupBlockRef = useRef<HTMLDivElement>(null);
  const joinDgroupBlockRef = useRef<HTMLDivElement>(null);
  const genderBlockRef = useRef<HTMLDivElement>(null);

  const registrationBlockedMessage = registrationStatus
    ? getRegistrationBlockedMessage(registrationStatus)
    : null;

  const qrIdEnabled = isQrIdRegistrationEnabled(registrationStatus?.registrationFeature);

  const resetToRoleSelection = () => {
    setEntryStep("role");
    setCheckInAs(null);
    setRole("");
    setPendingQrReveal(null);
    setCcfEventsBefore(null);
    setFieldErrors({});
    setPhotoFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backFromRegistrationFlow = () => {
    if (onLeaveRole) {
      onLeaveRole();
      return;
    }
    setRole("");
    setCcfEventsBefore(null);
    setFieldErrors({});
    setPhotoFile(null);
    setEntryStep("has-qr");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backFromHasQrStep = () => {
    setCheckInAs(null);
    setEntryStep("role");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onRegistrationReset = () => resetToRoleSelection();
    window.addEventListener(REGISTRATION_RESET_EVENT, onRegistrationReset);
    return () => window.removeEventListener(REGISTRATION_RESET_EVENT, onRegistrationReset);
  }, []);

  useEffect(() => {
    if (initialRegistrationStatus) return;

    let cancelled = false;
    const loadStatus = async () => {
      setStatusLoading(true);
      try {
        const status = await fetchGameRegistrationStatus(gameId);
        if (!cancelled) setRegistrationStatus(status);
      } catch {
        if (!cancelled) setRegistrationStatus(null);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    };
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [gameId, initialRegistrationStatus]);

  const ensureCanRegister = async (options?: { refresh?: boolean }) => {
    if (!options?.refresh && registrationStatus) {
      return promptIfRegistrationFullFromStatus(registrationStatus);
    }

    try {
      const status = await fetchGameRegistrationStatus(gameId);
      setRegistrationStatus(status);
      return promptIfRegistrationFullFromStatus(status);
    } catch {
      if (registrationStatus) {
        return promptIfRegistrationFullFromStatus(registrationStatus);
      }
      return true;
    }
  };

  const selectRole = async (nextRole: "new-player" | "volunteer" | "upload-qr") => {
    if (pendingRole) return;
    setPendingRole(nextRole);
    try {
      if (!(await ensureCanRegister())) return;
      setRole(nextRole);
      setEntryStep("done");
    } finally {
      setPendingRole(null);
    }
  };

  const openHasQrStep = async (as: CheckInAs) => {
    if (pendingEntryAction) return;
    setPendingEntryAction(as);
    try {
      if (!(await ensureCanRegister())) return;
      setCheckInAs(as);
      setEntryStep("has-qr");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setPendingEntryAction(null);
    }
  };

  const handleSpectator = async () => {
    if (pendingEntryAction || navigatingToSpectate) return;
    setPendingEntryAction("spectator");
    try {
      await navigateToSpectate({ applyQueueHighlight: false });
    } finally {
      setPendingEntryAction(null);
    }
  };

  const handleHasQrYes = async () => {
    if (pendingEntryAction || pendingRole || !checkInAs) return;
    setPendingEntryAction("has-qr-yes");
    try {
      if (!qrIdEnabled) {
        toast.info("QR check-in is not available for this session. Please complete registration.");
        await selectRole(checkInAs === "volunteer" ? "volunteer" : "new-player");
        return;
      }
      await selectRole("upload-qr");
    } finally {
      setPendingEntryAction(null);
    }
  };

  const handleHasQrNo = async () => {
    if (pendingEntryAction || pendingRole || !checkInAs) return;
    setPendingEntryAction("has-qr-no");
    try {
      await selectRole(checkInAs === "volunteer" ? "volunteer" : "new-player");
    } finally {
      setPendingEntryAction(null);
    }
  };

  const entryBusy =
    pendingEntryAction !== null ||
    pendingRole !== null ||
    navigatingToSpectate ||
    statusLoading;

  const pageTitle =
    !role && (entryStep === "role" || entryStep === "has-qr")
      ? "Check In"
      : role === "upload-qr"
        ? "Upload QR ID"
        : role === "volunteer"
          ? "Volunteer Registration"
          : "Player Registration";

  const setFieldRef =
    (name: string) =>
    (element: HTMLInputElement | null): void => {
      fieldRefs.current[name] = element;
    };

  const clearFieldError = (name: string) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const focusField = (name: string) => {
    if (name === "gender") {
      genderBlockRef.current?.focus();
      genderBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (name === "attendedEvents") {
      eventsBlockRef.current?.focus();
      eventsBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (name === "isPartOfDgroup") {
      dgroupBlockRef.current?.focus();
      dgroupBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (name === "wantsToJoinDgroup") {
      joinDgroupBlockRef.current?.focus();
      joinDgroupBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const input = fieldRefs.current[name];
    input?.focus();
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const showValidationErrors = (error: ZodError) => {
    const errors = getZodFieldErrors(error);
    const firstField = getFirstZodErrorField(error);
    setFieldErrors(errors);
    const message =
      (firstField && errors[firstField]) || formatZodError(error);
    toast.error(message);
    requestAnimationFrame(() => {
      if (firstField) focusField(firstField);
    });
  };

  const selectCcfEventsBefore = (answer: CcfEventsBeforeAnswer) => {
    clearFieldError("attendedEvents");
    clearFieldError("isPartOfDgroup");
    clearFieldError("wantsToJoinDgroup");
    setCcfEventsBefore(answer);
    if (answer === "not_yet") {
      setForm((prev) => ({
        ...prev,
        attendedEvents: [],
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

  const selectDgroupMembership = (inDgroup: boolean) => {
    clearFieldError("isPartOfDgroup");
    clearFieldError("wantsToJoinDgroup");
    setForm((prev) => ({
      ...prev,
      isPartOfDgroup: inDgroup,
      wantsToJoinDgroup: inDgroup ? null : prev.wantsToJoinDgroup,
    }));
  };

  const selectWantsToJoinDgroup = (wantsToJoin: boolean) => {
    clearFieldError("wantsToJoinDgroup");
    setForm((prev) => ({ ...prev, wantsToJoinDgroup: wantsToJoin }));
  };

  const toggleEvent = (item: string, checked: boolean) => {
    clearFieldError("attendedEvents");
    setForm((prev) => ({
      ...prev,
      attendedEvents: checked
        ? [...prev.attendedEvents, item]
        : prev.attendedEvents.filter((value) => value !== item),
    }));
  };

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    clearFieldError(String(key));
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateMobileNumber = (value: string) => {
    updateForm("mobileNumber", formatMobileNumberInput(value, mobileTouched));
  };

  const buildCcfQuestionnairePayload = () => {
    if (ccfEventsBefore === "not_yet") {
      return {
        firstTimeSportsMinistry: false,
        attendedEvents: [CCF_ATTENDED_NOT_YET],
        attendedEventsOther: "",
        isPartOfDgroup: false,
        wantsToJoinDgroup: null as boolean | null,
      };
    }

    if (ccfEventsBefore === "yes") {
      return {
        firstTimeSportsMinistry: false,
        attendedEvents: form.attendedEvents,
        attendedEventsOther: "",
        isPartOfDgroup: form.isPartOfDgroup ?? false,
        wantsToJoinDgroup:
          form.isPartOfDgroup === true ? null : form.wantsToJoinDgroup,
      };
    }

    return {
      firstTimeSportsMinistry: false,
      attendedEvents: [] as string[],
      attendedEventsOther: "",
      isPartOfDgroup: false,
      wantsToJoinDgroup: null as boolean | null,
    };
  };

  const buildNewPlayerPayload = () => {
    if (isGenericForm) {
      return {
        gameId,
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        birthdate: form.birthdate,
        mobileNumber: form.mobileNumber,
        email: form.email,
      };
    }

    if (role === "volunteer") {
      return {
        gameId,
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        birthdate: form.birthdate,
        mobileNumber: form.mobileNumber,
        email: form.email,
        personalQrCode: form.personalQrCode,
        volunteerType: REGISTRATION_VOLUNTEER_TYPE,
        volunteerTypeOther: "",
      };
    }

    return {
      ...form,
      ...buildCcfQuestionnairePayload(),
      gameId,
    };
  };

  const appendNewPlayerFormData = (
    body: FormData,
    payload: ReturnType<typeof buildNewPlayerPayload>,
  ) => {
    body.append("gameId", payload.gameId);
    body.append("firstName", payload.firstName);
    body.append("lastName", payload.lastName);
    body.append("gender", payload.gender);
    body.append("birthdate", payload.birthdate);
    body.append("mobileNumber", payload.mobileNumber);
    body.append("email", payload.email);

    if (!isGenericForm && role === "volunteer") {
      const volunteerPayload = payload as ReturnType<typeof buildNewPlayerPayload> & {
        volunteerType: string;
        volunteerTypeOther?: string;
      };
      body.append("volunteerType", volunteerPayload.volunteerType);
      body.append("volunteerTypeOther", volunteerPayload.volunteerTypeOther ?? "");
    } else if (!isGenericForm) {
      const ccfPayload = payload as ReturnType<typeof buildNewPlayerPayload> & {
        firstTimeSportsMinistry: boolean;
        isPartOfDgroup: boolean;
        wantsToJoinDgroup: boolean | null;
        attendedEvents: string[];
        attendedEventsOther?: string;
      };
      body.append("firstTimeSportsMinistry", String(ccfPayload.firstTimeSportsMinistry));
      body.append("isPartOfDgroup", String(ccfPayload.isPartOfDgroup));
      body.append(
        "wantsToJoinDgroup",
        ccfPayload.wantsToJoinDgroup === null
          ? "null"
          : String(ccfPayload.wantsToJoinDgroup),
      );
      body.append("attendedEvents", JSON.stringify(ccfPayload.attendedEvents));
      body.append("attendedEventsOther", ccfPayload.attendedEventsOther ?? "");
    }

    if (photoFile) {
      body.append("photo", photoFile);
    }
  };

  const submit = async () => {
    setSubmitting(true);

    try {
      if (!(await ensureCanRegister())) {
        setSubmitting(false);
        return;
      }

      const isVolunteer = role === "volunteer";
      const isExisting =
        role === "existing-player" || (isVolunteer && !!form.personalQrCode.trim());
      const endpoint = isExisting ? "/api/register/existing" : "/api/register/new";

      const payload = buildNewPlayerPayload();

      const validation = isExisting
        ? isVolunteer
          ? volunteerExistingPlayerSchema.safeParse(payload)
          : existingPlayerSchema.safeParse(payload)
        : isGenericForm
          ? genericPlayerSchema.safeParse(payload)
          : isVolunteer
            ? volunteerNewPlayerSchema.safeParse(payload)
            : newPlayerSchema.safeParse(payload);
      if (!validation.success) {
        showValidationErrors(validation.error);
        setSubmitting(false);
        return;
      }

      if (!isExisting && isRegistrationPhotoRequired(formVariant) && !photoFile) {
        setFieldErrors({ photo: REGISTRATION_PHOTO_REQUIRED_MESSAGE });
        toast.error(REGISTRATION_PHOTO_REQUIRED_MESSAGE);
        setSubmitting(false);
        return;
      }

      setFieldErrors({});

      const finishRegistrationSuccess = (
        registeredPlayerId: unknown,
        options?: {
          showPlayerQr?: boolean;
          personalQrCode?: string;
          personalQrCodeDataUrl?: string;
          firstName?: string;
        },
      ) => {
        if (registeredPlayerId != null) {
          const id = String(registeredPlayerId);
          setQueueHighlightPlayerId(gameId, id);
          persistActiveQueueHighlight(gameId, id);
        }

        if (
          options?.showPlayerQr &&
          options.personalQrCode &&
          registeredPlayerId != null
        ) {
          setPendingQrReveal({
            playerId: String(registeredPlayerId),
            firstName: options.firstName ?? form.firstName,
            personalQrCode: options.personalQrCode,
            personalQrCodeDataUrl: options.personalQrCodeDataUrl,
          });
          setSubmitting(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }

        router.push(`/register/${gameId}/success`);
      };

      let requestInit: RequestInit;
      if (isExisting) {
        requestInit = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        };
      } else {
        const body = new FormData();
        appendNewPlayerFormData(body, payload);
        requestInit = { method: "POST", body };
      }

      const response = await fetch(endpoint, requestInit);
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data.alreadyRegistered) {
          toast.error(
            typeof data.message === "string" ? data.message : ALREADY_REGISTERED_MESSAGE,
          );
          finishRegistrationSuccess(data?.player?._id, {
            showPlayerQr: data?.showPlayerQr,
            personalQrCode: data?.player?.personalQrCode,
            personalQrCodeDataUrl: data?.personalQrCodeDataUrl,
            firstName: data?.player?.firstName,
          });
          return;
        }

        const message =
          typeof data.message === "string"
            ? formatZodError(data.message)
            : "Registration failed.";
        toast.error(message);
        if (response.status === 403 || response.status === 409) {
          try {
            const status = await fetchGameRegistrationStatus(gameId);
            setRegistrationStatus(status);
          } catch {
            /* ignore */
          }
        }
        setSubmitting(false);
        return;
      }
      finishRegistrationSuccess(data?.player?._id, {
        showPlayerQr: data?.showPlayerQr,
        personalQrCode: data?.player?.personalQrCode,
        personalQrCodeDataUrl: data?.personalQrCodeDataUrl,
        firstName: data?.player?.firstName,
      });
    } catch {
      toast.error("Registration failed. Please try again.");
      setSubmitting(false);
    }
  };

  const renderFieldError = (name: string) =>
    fieldErrors[name] ? (
      <p id={`${name}-error`} className="text-sm text-destructive" role="alert">
        {fieldErrors[name]}
      </p>
    ) : null;

  const inputClass = (name: string) =>
    cn("register-input", fieldErrors[name] && "border-destructive ring-destructive/30");

  if (pendingQrReveal) {
    return (
      <main className="register-page">
        <section className="register-shell">
          <PlayerQrReveal
            firstName={pendingQrReveal.firstName}
            personalQrCode={pendingQrReveal.personalQrCode}
            personalQrCodeDataUrl={pendingQrReveal.personalQrCodeDataUrl}
            gameId={gameId}
            onContinue={() => {
              void navigateToSpectate();
            }}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="register-page">
      {submitting ? (
        <div
          className="register-loading-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="register-loading-overlay-content">
            <Loader2 className="register-loading-spinner" aria-hidden />
            <p className="register-loading-title">Adding you to the queue…</p>
            <p className="register-loading-caption">Please wait a moment.</p>
          </div>
        </div>
      ) : null}

      <section className="register-shell">
        <Card className="register-card border border-border bg-card shadow-sm">
          <CardHeader className="register-card-header">
            <div className="min-w-0">
              <CardTitle className="section-title">{pageTitle}</CardTitle>
              {gameTitle ? (
                <p className="caption mt-1 text-muted-foreground">{gameTitle}</p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="register-form-compact">
            {statusLoading ? (
              <p className="caption flex items-center gap-2 text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Checking session availability…
              </p>
            ) : null}
            {registrationBlockedMessage ? (
              <div
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
                role="alert"
              >
                {registrationBlockedMessage}
              </div>
            ) : null}
            {!role ? (
              entryStep === "role" ? (
                <div className="register-block">
                  <Label className="register-label">Check In as:</Label>
                  <div className="flex flex-col gap-3">
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="register-toggle-btn w-full"
                      disabled={entryBusy || submitting}
                      onClick={() => void openHasQrStep("player")}
                    >
                      {pendingEntryAction === "player" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Loading…
                        </>
                      ) : (
                        "Player"
                      )}
                    </Button>
                    {!isGenericForm ? (
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        className="register-toggle-btn w-full"
                        disabled={entryBusy || submitting}
                        onClick={() => void openHasQrStep("volunteer")}
                      >
                        {pendingEntryAction === "volunteer" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                            Loading…
                          </>
                        ) : (
                          "Volunteer"
                        )}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="register-toggle-btn w-full"
                      disabled={entryBusy || submitting}
                      onClick={() => void handleSpectator()}
                    >
                      {pendingEntryAction === "spectator" || navigatingToSpectate ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Opening…
                        </>
                      ) : (
                        "Spectator"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="register-back"
                    onClick={backFromHasQrStep}
                    disabled={entryBusy || submitting}
                  >
                    ← Back
                  </Button>

                  <div className="register-block">
                    <Label className="register-label">Do you have a QR already?</Label>
                    <div className="register-toggle-row">
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        className="register-toggle-btn"
                        disabled={entryBusy || submitting}
                        onClick={() => void handleHasQrYes()}
                      >
                        {pendingEntryAction === "has-qr-yes" || pendingRole === "upload-qr" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Loading…
                          </>
                        ) : (
                          "Yes"
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        className="register-toggle-btn"
                        disabled={entryBusy || submitting}
                        onClick={() => void handleHasQrNo()}
                      >
                        {pendingEntryAction === "has-qr-no" ||
                        pendingRole === "new-player" ||
                        pendingRole === "volunteer" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Loading…
                          </>
                        ) : (
                          "No"
                        )}
                      </Button>
                    </div>
                    <p className="caption text-center text-muted-foreground">
                      {checkInAs === "volunteer"
                        ? "Choose Yes to check in with your saved QR ID, or No to register as a new volunteer."
                        : "Choose Yes to upload your saved QR ID, or No to register as a new player."}
                    </p>
                  </div>
                </>
              )
            ) : role === "upload-qr" ? (
              <UploadQrIdFlow
                gameId={gameId}
                formVariant={formVariant}
                onBack={backFromRegistrationFlow}
              />
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="register-back"
                  onClick={backFromRegistrationFlow}
                  disabled={submitting}
                >
                  ← Back
                </Button>

                {role === "new-player" || role === "volunteer" ? (
                  <div
                    className={cn(
                      "register-field-grid",
                      isGenericForm && "register-field-grid--generic",
                    )}
                  >
                    <div className="register-field space-y-1.5">
                      <Input
                        ref={setFieldRef("firstName")}
                        className={inputClass("firstName")}
                        placeholder="First Name"
                        value={form.firstName}
                        aria-invalid={Boolean(fieldErrors.firstName)}
                        aria-describedby={fieldErrors.firstName ? "firstName-error" : undefined}
                        onChange={(event) => updateForm("firstName", event.target.value)}
                      />
                      {renderFieldError("firstName")}
                    </div>
                    <div className="register-field space-y-1.5">
                      <Input
                        ref={setFieldRef("lastName")}
                        className={inputClass("lastName")}
                        placeholder="Last Name"
                        value={form.lastName}
                        aria-invalid={Boolean(fieldErrors.lastName)}
                        aria-describedby={fieldErrors.lastName ? "lastName-error" : undefined}
                        onChange={(event) => updateForm("lastName", event.target.value)}
                      />
                      {renderFieldError("lastName")}
                    </div>
                    <div
                      ref={genderBlockRef}
                      tabIndex={-1}
                      className={cn(
                        "register-field space-y-1.5 rounded-lg outline-none md:col-span-2",
                        fieldErrors.gender && "ring-2 ring-destructive/40",
                      )}
                    >
                      <Label className="register-label">Gender</Label>
                      <div className="register-toggle-row" role="group" aria-label="Gender">
                        <Button
                          type="button"
                          variant={form.gender === "male" ? "default" : "outline"}
                          className="register-toggle-btn"
                          onClick={() => {
                            clearFieldError("gender");
                            updateForm("gender", "male");
                          }}
                          disabled={submitting}
                        >
                          Male
                        </Button>
                        <Button
                          type="button"
                          variant={form.gender === "female" ? "default" : "outline"}
                          className="register-toggle-btn"
                          onClick={() => {
                            clearFieldError("gender");
                            updateForm("gender", "female");
                          }}
                          disabled={submitting}
                        >
                          Female
                        </Button>
                      </div>
                      {renderFieldError("gender")}
                    </div>
                    <div className="register-field space-y-1.5 md:col-span-2">
                      <Label htmlFor="registration-birthdate" className="register-label">
                        Birthdate
                      </Label>
                      <Input
                        id="registration-birthdate"
                        ref={setFieldRef("birthdate")}
                        className={inputClass("birthdate")}
                        type="date"
                        value={form.birthdate}
                        aria-invalid={Boolean(fieldErrors.birthdate)}
                        aria-describedby={fieldErrors.birthdate ? "birthdate-error" : undefined}
                        onChange={(event) => updateForm("birthdate", event.target.value)}
                      />
                      {renderFieldError("birthdate")}
                    </div>
                    <div className="register-field space-y-1.5 md:col-span-2">
                      <Input
                        ref={setFieldRef("mobileNumber")}
                        className={inputClass("mobileNumber")}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="09XX-XXXXXXX"
                        value={form.mobileNumber}
                        maxLength={12}
                        aria-invalid={Boolean(fieldErrors.mobileNumber)}
                        aria-describedby={
                          fieldErrors.mobileNumber ? "mobileNumber-error" : undefined
                        }
                        onFocus={() => {
                          if (mobileTouched) return;
                          setMobileTouched(true);
                          if (!form.mobileNumber) updateForm("mobileNumber", "09");
                        }}
                        onChange={(event) => updateMobileNumber(event.target.value)}
                      />
                      {renderFieldError("mobileNumber")}
                    </div>
                    <div className="register-field space-y-1.5 md:col-span-2">
                      <Input
                        ref={setFieldRef("email")}
                        className={inputClass("email")}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="Email Address"
                        value={form.email}
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? "email-error" : undefined}
                        onChange={(event) => updateForm("email", event.target.value)}
                      />
                      {renderFieldError("email")}
                    </div>
                    <div className="register-field md:col-span-2">
                      <RegistrationPhotoField
                        disabled={submitting}
                        error={fieldErrors.photo}
                        optional={isGenericForm}
                        onChange={(file) => {
                          clearFieldError("photo");
                          setPhotoFile(file);
                        }}
                      />
                    </div>
                  </div>
                ) : isGenericForm ? null : (
                  <div className="register-field space-y-1.5">
                    <Input
                      ref={setFieldRef("personalQrCode")}
                      className={inputClass("personalQrCode")}
                      placeholder="Paste your existing personal QR code"
                      value={form.personalQrCode}
                      aria-invalid={Boolean(fieldErrors.personalQrCode)}
                      aria-describedby={
                        fieldErrors.personalQrCode ? "personalQrCode-error" : undefined
                      }
                      onChange={(event) => updateForm("personalQrCode", event.target.value)}
                    />
                    {renderFieldError("personalQrCode")}
                  </div>
                )}

                {!isGenericForm && role !== "volunteer" ? (
                  <>
                    <div
                      ref={eventsBlockRef}
                      tabIndex={-1}
                      className={cn(
                        "register-block rounded-lg outline-none",
                        fieldErrors.attendedEvents && "ring-2 ring-destructive/40",
                      )}
                    >
                      <Label className="register-label">
                        Have you attended any other CCF events before?
                      </Label>
                      <div className="register-toggle-row">
                        <Button
                          type="button"
                          variant={ccfEventsBefore === "yes" ? "default" : "outline"}
                          className="register-toggle-btn"
                          onClick={() => selectCcfEventsBefore("yes")}
                          disabled={submitting}
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          variant={ccfEventsBefore === "not_yet" ? "default" : "outline"}
                          className="register-toggle-btn"
                          onClick={() => selectCcfEventsBefore("not_yet")}
                          disabled={submitting}
                        >
                          Not Yet
                        </Button>
                      </div>
                      {renderFieldError("attendedEvents")}
                    </div>

                    {ccfEventsBefore === "yes" ? (
                      <>
                        <div className="register-block">
                          <Label className="register-label">Which event?</Label>
                          <div className="register-checklist">
                            {CCF_EVENT_OPTIONS.map((item) => {
                              const checked = form.attendedEvents.includes(item);
                              return (
                                <label
                                  key={item}
                                  className={cn(
                                    "register-checklist-item",
                                    checked && "is-checked",
                                  )}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) =>
                                      toggleEvent(item, Boolean(value))
                                    }
                                    disabled={submitting}
                                  />
                                  <span>{item}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div
                          ref={dgroupBlockRef}
                          tabIndex={-1}
                          className={cn(
                            "register-block rounded-lg outline-none",
                            fieldErrors.isPartOfDgroup && "ring-2 ring-destructive/40",
                          )}
                        >
                          <Label className="register-label">Are you in a D-group?</Label>
                          <div className="register-toggle-row">
                            <Button
                              type="button"
                              variant={form.isPartOfDgroup === true ? "default" : "outline"}
                              className="register-toggle-btn"
                              onClick={() => selectDgroupMembership(true)}
                              disabled={submitting}
                            >
                              Yes
                            </Button>
                            <Button
                              type="button"
                              variant={form.isPartOfDgroup === false ? "default" : "outline"}
                              className="register-toggle-btn"
                              onClick={() => selectDgroupMembership(false)}
                              disabled={submitting}
                            >
                              No
                            </Button>
                          </div>
                          {renderFieldError("isPartOfDgroup")}
                        </div>

                        {form.isPartOfDgroup === false ? (
                          <div
                            ref={joinDgroupBlockRef}
                            tabIndex={-1}
                            className={cn(
                              "register-block rounded-lg outline-none",
                              fieldErrors.wantsToJoinDgroup && "ring-2 ring-destructive/40",
                            )}
                          >
                            <Label className="register-label">
                              Do you want to join a dgroup?
                            </Label>
                            <div className="register-toggle-row">
                              <Button
                                type="button"
                                variant={
                                  form.wantsToJoinDgroup === true ? "default" : "outline"
                                }
                                className="register-toggle-btn"
                                onClick={() => selectWantsToJoinDgroup(true)}
                                disabled={submitting}
                              >
                                Yes
                              </Button>
                              <Button
                                type="button"
                                variant={
                                  form.wantsToJoinDgroup === false ? "default" : "outline"
                                }
                                className="register-toggle-btn"
                                onClick={() => selectWantsToJoinDgroup(false)}
                                disabled={submitting}
                              >
                                Not Yet
                              </Button>
                            </div>
                            {renderFieldError("wantsToJoinDgroup")}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}

                <div className="register-submit-bar">
                  <Button
                    type="button"
                    size="lg"
                    className="register-submit w-full"
                    onClick={() => void submit()}
                    disabled={submitting || statusLoading}
                    aria-busy={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Please wait..
                      </>
                    ) : (
                      "Submit Registration"
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
