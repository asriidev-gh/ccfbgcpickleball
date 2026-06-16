"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";

import { CcfQuestionnaireSection } from "@/components/register/ccf-questionnaire-section";
import { RegistrationPhotoField } from "@/components/register/registration-photo-field";
import { PlayerPersonalQrSection } from "@/components/player/player-personal-qr-section";
import {
  PlayerProfileDialogTabs,
  type PlayerProfileDialogTab,
} from "@/components/player/player-profile-dialog-tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  GENDER_OPTIONS,
  PICKLEBALL_LEVELS,
  type GenderOption,
  type PickleballLevel,
} from "@/lib/player-profile-shared";
import { profileBaseSchema, profileCcfFieldsSchema } from "@/lib/validations";
import { cn } from "@/lib/utils";

type CcfEventsBeforeAnswer = "yes" | "not_yet";
type FieldErrors = Record<string, string>;

type ProfileResponse = {
  playerId: string;
  email: string;
  showCcfQuestionnaire: boolean;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  photoUrl: string;
  gender: GenderOption | "";
  birthdate: string;
  biography: string;
  pickleballLevel: PickleballLevel | "";
  isPartOfDgroup: boolean | null;
  wantsToJoinDgroup: boolean | null;
  attendedEvents: string[];
  attendedEventsOther: string;
  ccfEventsBefore: CcfEventsBeforeAnswer | null;
  personalQrCode: string;
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

export function PlayerProfileForm({
  gameId,
  playerId,
  compact = false,
}: {
  gameId: string;
  playerId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const spectateHref = `/games/${gameId}/spectate`;
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
  const [activeTab, setActiveTab] = useState<PlayerProfileDialogTab>("profile");

  const { data, isLoading, error } = useQuery({
    queryKey: ["player-profile", gameId, playerId],
    queryFn: async () => {
      const response = await fetch(
        `/api/games/${encodeURIComponent(gameId)}/player-profile?playerId=${encodeURIComponent(playerId)}`,
      );
      const payload = (await response.json()) as ProfileResponse;
      if (!response.ok) throw new Error(payload.message ?? "Failed to load profile.");
      return payload;
    },
  });

  useEffect(() => {
    if (!data) return;
    setShowCcf(data.showCcfQuestionnaire);
    setCcfEventsBefore(data.ccfEventsBefore);
    setPhotoUrl(data.photoUrl);
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
        mobileNumber: form.mobileNumber,
        gender: form.gender,
        birthdate: form.birthdate,
        biography: form.biography,
        pickleballLevel: form.pickleballLevel,
      };

      const baseValidation = profileBaseSchema.safeParse(basePayload);
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
      body.append("playerId", playerId);
      body.append("firstName", basePayload.firstName);
      body.append("lastName", basePayload.lastName);
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

      const response = await fetch(`/api/games/${encodeURIComponent(gameId)}/player-profile`, {
        method: "PATCH",
        body,
      });
      const payload = (await response.json()) as {
        message?: string;
        profile: ProfileResponse;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update profile.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Profile updated.");
      queryClient.setQueryData(["player-profile", gameId, playerId], payload.profile);
      queryClient.invalidateQueries({ queryKey: ["game", gameId, "spectator"] });
      router.push(spectateHref);
    },
    onError: (saveError) => {
      if (saveError instanceof Error && saveError.message === "validation") return;
      toast.error(saveError instanceof Error ? saveError.message : "Failed to update profile.");
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

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading profile…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-panel">
        <CardContent className="py-8">
          <p className="text-destructive">
            {error instanceof Error ? error.message : "Failed to load profile."}
          </p>
          <Link
            href={spectateHref}
            className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}
          >
            Back to open play
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-xl">Update profile</CardTitle>
        <p className="text-sm text-muted-foreground">
          Update your player details for this open play session.
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <PlayerProfileDialogTabs
            open
            showCcf={showCcf}
            onTabChange={setActiveTab}
            profileContent={
              <div className="space-y-5">
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
                    <Label htmlFor="profile-firstName">First name</Label>
                    <Input
                      id="profile-firstName"
                      value={form.firstName}
                      aria-invalid={Boolean(fieldErrors.firstName)}
                      onChange={(event) => {
                        clearFieldError("firstName");
                        setForm((prev) => ({ ...prev, firstName: event.target.value }));
                      }}
                    />
                    {renderFieldError("firstName")}
                  </div>
                  <div className="register-field space-y-1.5">
                    <Label htmlFor="profile-lastName">Last name</Label>
                    <Input
                      id="profile-lastName"
                      value={form.lastName}
                      aria-invalid={Boolean(fieldErrors.lastName)}
                      onChange={(event) => {
                        clearFieldError("lastName");
                        setForm((prev) => ({ ...prev, lastName: event.target.value }));
                      }}
                    />
                    {renderFieldError("lastName")}
                  </div>
                  <div className="register-field space-y-1.5 md:col-span-2">
                    <Label htmlFor="profile-mobileNumber">Mobile number</Label>
                    <Input
                      id="profile-mobileNumber"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="09XX-XXXXXXX"
                      value={form.mobileNumber}
                      maxLength={12}
                      aria-invalid={Boolean(fieldErrors.mobileNumber)}
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
                    <Label htmlFor="profile-email">Email</Label>
                    <Input id="profile-email" type="email" value={form.email} disabled readOnly />
                    <p className="caption text-muted-foreground">
                      Email is from your registration and cannot be changed here.
                    </p>
                  </div>
                  <div className="register-field space-y-1.5">
                    <Label htmlFor="profile-gender">Gender</Label>
                    <ProfileSelectField
                      id="profile-gender"
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
                    <Label htmlFor="profile-birthdate">Birthdate</Label>
                    <Input
                      id="profile-birthdate"
                      type="date"
                      value={form.birthdate}
                      aria-invalid={Boolean(fieldErrors.birthdate)}
                      onChange={(event) => {
                        clearFieldError("birthdate");
                        setForm((prev) => ({ ...prev, birthdate: event.target.value }));
                      }}
                    />
                    {renderFieldError("birthdate")}
                  </div>
                  <div className="register-field space-y-1.5 md:col-span-2">
                    <Label htmlFor="profile-pickleballLevel">Pickleball level</Label>
                    <ProfileSelectField
                      id="profile-pickleballLevel"
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
                      <Label htmlFor="profile-biography">Biography</Label>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {form.biography.length}/500
                      </span>
                    </div>
                    <Textarea
                      id="profile-biography"
                      value={form.biography}
                      maxLength={500}
                      rows={compact ? 3 : 4}
                      placeholder="Tell others a little about yourself…"
                      aria-invalid={Boolean(fieldErrors.biography)}
                      className="border-border bg-background"
                      onChange={(event) => {
                        clearFieldError("biography");
                        setForm((prev) => ({ ...prev, biography: event.target.value }));
                      }}
                    />
                    {renderFieldError("biography")}
                  </div>
                </div>
              </div>
            }
            ccfContent={
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
            }
            qrContent={
              activeTab === "qr" ? (
                <PlayerPersonalQrSection
                  firstName={form.firstName || data?.firstName || ""}
                  lastName={form.lastName || data?.lastName || ""}
                  personalQrCode={data?.personalQrCode ?? ""}
                  gameId={gameId}
                  compact={compact}
                />
              ) : null
            }
          />

          {compact ? (
            <div className="mt-6 border-t border-border/60 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={saveMutation.isPending} className="w-full sm:flex-1">
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Save profile"
                  )}
                </Button>
                <Link
                  href={spectateHref}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "inline-flex w-full sm:flex-1",
                  )}
                >
                  Back to open play
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 border-t border-border/60 pt-4">
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Save profile"
                  )}
                </Button>
                <Link
                  href={spectateHref}
                  className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
                >
                  Back to open play
                </Link>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
