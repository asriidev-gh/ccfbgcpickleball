"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";

import {
  fetchGameRegistrationStatus,
  getRegistrationBlockedMessage,
  promptIfRegistrationFull,
} from "@/components/game/registration-capacity-prompt";
import { RegistrationPhotoField } from "@/components/register/registration-photo-field";
import type { GameRegistrationStatus } from "@/lib/game-registration-limit";
import {
  persistActiveQueueHighlight,
  setQueueHighlightPlayerId,
} from "@/lib/queue-highlight";
import type { RegistrationFormVariant } from "@/lib/registration-variant";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  existingPlayerSchema,
  genericPlayerSchema,
  newPlayerSchema,
  volunteerExistingPlayerSchema,
  volunteerNewPlayerSchema,
} from "@/lib/validations";
import { cn } from "@/lib/utils";

const events = [
  "Not yet",
  "Sunday Service",
  "Women to Women Ministry",
  "Men's Ministry",
  "B1G Singles Ministry",
  "Elevate Youth Ministry",
  "True Life Retreat",
  "Other",
];

type FieldErrors = Record<string, string>;

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

export function RegistrationForm({
  gameId,
  gameTitle,
  formVariant,
}: {
  gameId: string;
  gameTitle?: string;
  formVariant: RegistrationFormVariant;
}) {
  const router = useRouter();
  const isGenericForm = formVariant === "generic";
  const [role, setRole] = useState<"existing-player" | "new-player" | "volunteer" | "">("");
  const [pendingRole, setPendingRole] = useState<"new-player" | "volunteer" | null>(null);
  const [volunteerType, setVolunteerType] = useState("");
  const [mobileTouched, setMobileTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<GameRegistrationStatus | null>(
    null,
  );
  const [statusLoading, setStatusLoading] = useState(true);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobileNumber: "",
    email: "",
    personalQrCode: "",
    firstTimeSportsMinistry: false,
    isPartOfDgroup: false,
    attendedEvents: ["Not yet"] as string[],
    attendedEventsOther: "",
    volunteerTypeOther: "",
  });

  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const eventsBlockRef = useRef<HTMLDivElement>(null);

  const isOtherSelected = useMemo(
    () => form.attendedEvents.includes("Other"),
    [form.attendedEvents]
  );

  const registrationBlockedMessage = registrationStatus
    ? getRegistrationBlockedMessage(registrationStatus)
    : null;

  const resetToRoleSelection = () => {
    setRole("");
    setVolunteerType("");
    setFieldErrors({});
    setPhotoFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onRegistrationReset = () => resetToRoleSelection();
    window.addEventListener(REGISTRATION_RESET_EVENT, onRegistrationReset);
    return () => window.removeEventListener(REGISTRATION_RESET_EVENT, onRegistrationReset);
  }, []);

  useEffect(() => {
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
  }, [gameId]);

  const ensureCanRegister = async () => {
    const canProceed = await promptIfRegistrationFull(gameId);
    if (canProceed) {
      try {
        const status = await fetchGameRegistrationStatus(gameId);
        setRegistrationStatus(status);
      } catch {
        /* keep previous banner */
      }
    }
    return canProceed;
  };

  const selectRole = async (nextRole: "new-player" | "volunteer") => {
    if (pendingRole) return;
    setPendingRole(nextRole);
    try {
      if (!(await ensureCanRegister())) return;
      setRole(nextRole);
    } finally {
      setPendingRole(null);
    }
  };

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
    if (name === "attendedEvents") {
      eventsBlockRef.current?.focus();
      eventsBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  const buildNewPlayerPayload = () => {
    if (isGenericForm) {
      return {
        gameId,
        firstName: form.firstName,
        lastName: form.lastName,
        mobileNumber: form.mobileNumber,
        email: form.email,
      };
    }

    if (role === "volunteer") {
      return {
        gameId,
        firstName: form.firstName,
        lastName: form.lastName,
        mobileNumber: form.mobileNumber,
        email: form.email,
        personalQrCode: form.personalQrCode,
        volunteerType,
        volunteerTypeOther: form.volunteerTypeOther || "",
      };
    }

    return {
      ...form,
      gameId,
      volunteerTypeOther: form.volunteerTypeOther || "",
    };
  };

  const appendNewPlayerFormData = (
    body: FormData,
    payload: ReturnType<typeof buildNewPlayerPayload>,
  ) => {
    body.append("gameId", payload.gameId);
    body.append("firstName", payload.firstName);
    body.append("lastName", payload.lastName);
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
        attendedEvents: string[];
        attendedEventsOther?: string;
      };
      body.append("firstTimeSportsMinistry", String(ccfPayload.firstTimeSportsMinistry));
      body.append("isPartOfDgroup", String(ccfPayload.isPartOfDgroup));
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

      if (isVolunteer && !volunteerType) {
        toast.error("Select a volunteer type.");
        setSubmitting(false);
        return;
      }

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

      setFieldErrors({});

      const finishRegistrationSuccess = (registeredPlayerId: unknown) => {
        if (registeredPlayerId != null) {
          const id = String(registeredPlayerId);
          setQueueHighlightPlayerId(gameId, id);
          persistActiveQueueHighlight(gameId, id);
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
          finishRegistrationSuccess(data?.player?._id);
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
      finishRegistrationSuccess(data?.player?._id);
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
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="section-title">Player Registration</CardTitle>
                {gameTitle ? (
                  <p className="caption mt-1 text-muted-foreground">{gameTitle}</p>
                ) : null}
              </div>
              <Link
                href={`/games/${gameId}/spectate`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
              >
                Go to Open play
              </Link>
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
              <div
                className={cn(
                  "register-role-grid",
                  isGenericForm && "register-role-grid--single",
                )}
              >
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="register-role-btn"
                  disabled={statusLoading || submitting || pendingRole !== null}
                  onClick={() => void selectRole("new-player")}
                >
                  {pendingRole === "new-player" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading…
                    </>
                  ) : isGenericForm ? (
                    "Check In"
                  ) : (
                    "Player"
                  )}
                </Button>
                {!isGenericForm ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="register-role-btn"
                    disabled={statusLoading || submitting || pendingRole !== null}
                    onClick={() => void selectRole("volunteer")}
                  >
                    {pendingRole === "volunteer" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Loading…
                      </>
                    ) : (
                      "Volunteer"
                    )}
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="register-back"
                  onClick={resetToRoleSelection}
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

                {!isGenericForm && role === "volunteer" ? (
                  <div className="register-block">
                    <Label className="register-label">Volunteer Type</Label>
                    <div className="register-choice-grid">
                      {["Pickleball", "Running", "Badminton", "Other"].map((item) => (
                        <Button
                          key={item}
                          type="button"
                          variant={volunteerType === item ? "default" : "outline"}
                          className="register-choice-btn"
                          onClick={() => setVolunteerType(item)}
                          disabled={submitting}
                        >
                          {item}
                        </Button>
                      ))}
                    </div>
                    {volunteerType === "Other" ? (
                      <Input
                        className="register-input"
                        placeholder="Specify volunteer type"
                        value={form.volunteerTypeOther}
                        onChange={(event) =>
                          updateForm("volunteerTypeOther", event.target.value)
                        }
                        disabled={submitting}
                      />
                    ) : null}
                  </div>
                ) : null}

                {!isGenericForm && role !== "volunteer" ? (
                  <>
                    <div className="register-toggle-row">
                      <Button
                        type="button"
                        variant={form.isPartOfDgroup ? "default" : "outline"}
                        className="register-toggle-btn"
                        onClick={() => setForm({ ...form, isPartOfDgroup: true })}
                        disabled={submitting}
                      >
                        In a D-Group: Yes
                      </Button>
                      <Button
                        type="button"
                        variant={!form.isPartOfDgroup ? "default" : "outline"}
                        className="register-toggle-btn"
                        onClick={() => setForm({ ...form, isPartOfDgroup: false })}
                        disabled={submitting}
                      >
                        In a D-Group: No
                      </Button>
                    </div>

                    {role !== "existing-player" ? (
                      <div className="register-toggle-row">
                        <Button
                          type="button"
                          variant={form.firstTimeSportsMinistry ? "default" : "outline"}
                          className="register-toggle-btn"
                          onClick={() => setForm({ ...form, firstTimeSportsMinistry: true })}
                          disabled={submitting}
                        >
                          First time at CCF Sports Ministry: Yes
                        </Button>
                        <Button
                          type="button"
                          variant={!form.firstTimeSportsMinistry ? "default" : "outline"}
                          className="register-toggle-btn"
                          onClick={() => setForm({ ...form, firstTimeSportsMinistry: false })}
                          disabled={submitting}
                        >
                          First time at CCF Sports Ministry: No
                        </Button>
                      </div>
                    ) : null}

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
                      <div className="register-checklist">
                        {events.map((item) => {
                          const checked = form.attendedEvents.includes(item);
                          return (
                            <label
                              key={item}
                              className={cn("register-checklist-item", checked && "is-checked")}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => toggleEvent(item, Boolean(value))}
                                disabled={submitting}
                              />
                              <span>{item}</span>
                            </label>
                          );
                        })}
                      </div>
                      {renderFieldError("attendedEvents")}
                      {isOtherSelected ? (
                        <Input
                          className="register-input"
                          placeholder="Please specify the other event"
                          value={form.attendedEventsOther}
                          onChange={(event) =>
                            updateForm("attendedEventsOther", event.target.value)
                          }
                          disabled={submitting}
                        />
                      ) : null}
                    </div>
                  </>
                ) : null}

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
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
