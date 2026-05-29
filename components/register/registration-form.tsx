"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";

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
import { existingPlayerSchema, newPlayerSchema } from "@/lib/validations";
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

export function RegistrationForm({
  gameId,
  gameTitle,
}: {
  gameId: string;
  gameTitle?: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<"existing-player" | "new-player" | "volunteer" | "">("");
  const [volunteerType, setVolunteerType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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

  const submit = async () => {
    const isExisting =
      role === "existing-player" || (role === "volunteer" && !!form.personalQrCode.trim());
    const endpoint = isExisting ? "/api/register/existing" : "/api/register/new";

    const payload = {
      ...form,
      gameId,
      volunteerType: role === "volunteer" ? volunteerType || undefined : undefined,
      volunteerTypeOther: form.volunteerTypeOther || "",
    };

    const validation = isExisting
      ? existingPlayerSchema.safeParse(payload)
      : newPlayerSchema.safeParse(payload);
    if (!validation.success) {
      showValidationErrors(validation.error);
      return;
    }

    setFieldErrors({});

    try {
      setSubmitting(true);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        const message =
          typeof data.message === "string"
            ? formatZodError(data.message)
            : "Registration failed.";
        toast.error(message);
        setSubmitting(false);
        return;
      }
      router.push(`/register/${gameId}/success`);
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
      <section className="register-shell">
        <Card className="register-card relative border border-border bg-card shadow-sm">
          {submitting ? (
            <div
              className="register-loading-overlay absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/90 px-6 text-center backdrop-blur-sm"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
              <p className="text-base font-medium text-foreground">Adding you to the queue…</p>
              <p className="caption">Please wait a moment.</p>
            </div>
          ) : null}

          <CardHeader className="register-card-header">
            <CardTitle className="section-title">CCF Player Registration</CardTitle>
            {gameTitle ? (
              <p className="caption mt-1 text-muted-foreground">{gameTitle}</p>
            ) : null}
          </CardHeader>
          <CardContent className="register-form-compact">
            {!role ? (
              <div className="register-role-grid">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="register-role-btn"
                  onClick={() => setRole("new-player")}
                >
                  Player
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="register-role-btn"
                  onClick={() => setRole("volunteer")}
                >
                  Volunteer
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="register-back h-9 px-2"
                  onClick={() => {
                    setRole("");
                    setFieldErrors({});
                  }}
                  disabled={submitting}
                >
                  ← Back
                </Button>

                {role === "new-player" || role === "volunteer" ? (
                  <div className="register-field-grid">
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
                        aria-invalid={Boolean(fieldErrors.mobileNumber)}
                        aria-describedby={
                          fieldErrors.mobileNumber ? "mobileNumber-error" : undefined
                        }
                        onChange={(event) => updateForm("mobileNumber", event.target.value)}
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
                  </div>
                ) : (
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

                {role === "volunteer" ? (
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

                <Button
                  type="button"
                  size="lg"
                  className="register-submit w-full"
                  onClick={submit}
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : "Submit Registration"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
