"use client";

import { Bell, Camera, Eye, ImageIcon, Loader2, QrCode } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";

import {
  CcfQuestionnaireSection,
  type CcfEventsBeforeAnswer,
} from "@/components/register/ccf-questionnaire-section";
import { DgroupAvailabilityFields } from "@/components/register/dgroup-availability-fields";
import { QrUploadProfileSection } from "@/components/register/qr-upload-profile-section";
import { Button } from "@/components/ui/button";
import { useNavigateToSpectate } from "@/components/register/use-navigate-to-spectate";
import { CCF_ATTENDED_NOT_YET } from "@/lib/ccf-registration";
import type { DgroupWeekday } from "@/lib/dgroup-availability-shared";
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
import type { QrUploadCcfMode } from "@/lib/qr-upload-ccf-questionnaire-shared";
import {
  isQrUploadFlowComplete,
  shouldCollectDgroupAvailability,
} from "@/lib/qr-upload-ccf-questionnaire-shared";
import {
  formatQrUploadBirthdate,
  needsQrUploadProfileCompletion,
  type QrUploadProfileFormValues,
  type QrUploadProfileSnapshot,
} from "@/lib/qr-upload-profile-shared";
import { QR_UPLOAD_REGISTRATION_SOURCE } from "@/lib/registration-feature";
import type { RegistrationFormVariant } from "@/lib/registration-variant";
import { CHECKED_OUT_RE_REGISTER_MESSAGE, ALREADY_REGISTERED_MESSAGE } from "@/lib/registration-messages";
import {
  qrUploadFullExistingPlayerSchema,
  qrUploadJoinDgroupExistingPlayerSchema,
  qrUploadSkipExistingPlayerSchema,
} from "@/lib/validations";

type UploadQrIdFlowProps = {
  gameId: string;
  formVariant: RegistrationFormVariant;
  onBack: () => void;
};

type PlayerQueueStatus = "active" | "checked_out" | null;

type LookupPlayer = {
  playerId: string;
  firstName: string;
  lastName: string;
  personalQrCode: string;
  queueStatus: PlayerQueueStatus;
  ccfQuestionnaireMode: QrUploadCcfMode | null;
  profileSnapshot: QrUploadProfileSnapshot;
  needsProfileCompletion: boolean;
};

const emptyProfileForm = (): QrUploadProfileFormValues => ({
  gender: "",
  birthdate: "",
  pickleballLevel: "",
});

type FieldErrors = Record<string, string>;

export function UploadQrIdFlow({
  gameId,
  formVariant,
  onBack,
}: UploadQrIdFlowProps) {
  const isCcfForm = formVariant === "ccf";
  const { navigateToSpectate, navigating } = useNavigateToSpectate(gameId);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const eventsBlockRef = useRef<HTMLDivElement>(null);
  const dgroupBlockRef = useRef<HTMLDivElement>(null);
  const joinDgroupBlockRef = useRef<HTMLDivElement>(null);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [player, setPlayer] = useState<LookupPlayer | null>(null);
  const [ccfEventsBefore, setCcfEventsBefore] = useState<CcfEventsBeforeAnswer | null>(null);
  const [attendedEvents, setAttendedEvents] = useState<string[]>([]);
  const [isPartOfDgroup, setIsPartOfDgroup] = useState<boolean | null>(null);
  const [wantsToJoinDgroup, setWantsToJoinDgroup] = useState<boolean | null>(null);
  const [profileForm, setProfileForm] = useState<QrUploadProfileFormValues>(emptyProfileForm);
  const [dgroupAvailableDays, setDgroupAvailableDays] = useState<DgroupWeekday[]>([]);
  const [dgroupAvailableTimeFrom, setDgroupAvailableTimeFrom] = useState("");
  const [dgroupAvailableTimeTo, setDgroupAvailableTimeTo] = useState("");

  const resetFlowState = () => {
    setCcfEventsBefore(null);
    setAttendedEvents([]);
    setIsPartOfDgroup(null);
    setWantsToJoinDgroup(null);
    setProfileForm(emptyProfileForm());
    setDgroupAvailableDays([]);
    setDgroupAvailableTimeFrom("");
    setDgroupAvailableTimeTo("");
    setFieldErrors({});
  };

  const showValidationErrors = (error: ZodError) => {
    const errors = getZodFieldErrors(error);
    const firstField = getFirstZodErrorField(error);
    setFieldErrors(errors);
    toast.error((firstField && errors[firstField]) || formatZodError(error));
  };

  const renderFieldError = (name: string) =>
    fieldErrors[name] ? (
      <p id={`${name}-error`} className="text-sm text-destructive" role="alert">
        {fieldErrors[name]}
      </p>
    ) : null;

  const goToSpectatorView = async (playerId?: string) => {
    if (playerId) {
      setQueueHighlightPlayerId(gameId, playerId);
      persistActiveQueueHighlight(gameId, playerId);
    }
    await navigateToSpectate({ applyQueueHighlight: false });
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

      if (
        (queueStatus === "active" || data.alreadyRegistered === true) &&
        typeof data.playerId === "string"
      ) {
        await goToSpectatorView(data.playerId);
        return;
      }

      const ccfQuestionnaireMode =
        isCcfForm &&
        (data.ccfQuestionnaireMode === "none" ||
          data.ccfQuestionnaireMode === "full" ||
          data.ccfQuestionnaireMode === "join_dgroup_only")
          ? data.ccfQuestionnaireMode
          : null;

      const profileSnapshot: QrUploadProfileSnapshot = {
        gender: typeof data.gender === "string" ? data.gender : "",
        birthdate: typeof data.birthdate === "string" ? data.birthdate : "",
        pickleballLevel: typeof data.pickleballLevel === "string" ? data.pickleballLevel : "",
      };
      const needsProfileCompletion =
        data.needsProfileCompletion === true || needsQrUploadProfileCompletion(profileSnapshot);

      resetFlowState();
      setProfileForm({
        gender: profileSnapshot.gender?.trim()
          ? (profileSnapshot.gender as QrUploadProfileFormValues["gender"])
          : "",
        birthdate: formatQrUploadBirthdate(profileSnapshot.birthdate),
        pickleballLevel: profileSnapshot.pickleballLevel?.trim()
          ? (profileSnapshot.pickleballLevel as QrUploadProfileFormValues["pickleballLevel"])
          : "",
      });
      setDgroupAvailableDays(
        Array.isArray(data.dgroupAvailableDays)
          ? data.dgroupAvailableDays.filter((day: string): day is DgroupWeekday =>
              typeof day === "string",
            )
          : [],
      );
      setDgroupAvailableTimeFrom(
        typeof data.dgroupAvailableTimeFrom === "string" ? data.dgroupAvailableTimeFrom : "",
      );
      setDgroupAvailableTimeTo(
        typeof data.dgroupAvailableTimeTo === "string" ? data.dgroupAvailableTimeTo : "",
      );

      setPlayer({
        playerId: typeof data.playerId === "string" ? data.playerId : "",
        firstName: data.firstName,
        lastName: data.lastName,
        personalQrCode: data.personalQrCode,
        queueStatus,
        ccfQuestionnaireMode,
        profileSnapshot,
        needsProfileCompletion,
      });

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

  const finishRegistrationSuccess = async (registeredPlayerId: unknown) => {
    const id = registeredPlayerId != null ? String(registeredPlayerId) : player?.playerId;
    await goToSpectatorView(id);
  };

  const ccfAnswers = useMemo(
    () => ({
      ccfEventsBefore,
      attendedEvents,
      isPartOfDgroup,
      wantsToJoinDgroup,
    }),
    [ccfEventsBefore, attendedEvents, isPartOfDgroup, wantsToJoinDgroup],
  );

  const dgroupAvailability = useMemo(
    () => ({
      dgroupAvailableDays,
      dgroupAvailableTimeFrom,
      dgroupAvailableTimeTo,
    }),
    [dgroupAvailableDays, dgroupAvailableTimeFrom, dgroupAvailableTimeTo],
  );

  const collectDgroupAvailability = useMemo(
    () => shouldCollectDgroupAvailability(player?.ccfQuestionnaireMode ?? null, ccfAnswers),
    [player?.ccfQuestionnaireMode, ccfAnswers],
  );

  const buildProfilePayload = () => {
    if (!player?.needsProfileCompletion) {
      return {};
    }
    return {
      requiresProfileUpdate: true as const,
      gender: profileForm.gender,
      birthdate: profileForm.birthdate,
      pickleballLevel: profileForm.pickleballLevel,
    };
  };

  const buildDgroupAvailabilityPayload = () => {
    if (!collectDgroupAvailability) {
      return {};
    }
    return {
      dgroupAvailableDays,
      dgroupAvailableTimeFrom,
      dgroupAvailableTimeTo,
    };
  };

  const buildCcfQuestionnairePayload = () => {
    if (ccfEventsBefore === "not_yet") {
      return {
        attendedEvents: [CCF_ATTENDED_NOT_YET],
        attendedEventsOther: "",
        isPartOfDgroup: false,
        wantsToJoinDgroup: null as boolean | null,
        prayerRequest: "",
      };
    }

    if (ccfEventsBefore === "yes") {
      return {
        attendedEvents,
        attendedEventsOther: "",
        isPartOfDgroup: isPartOfDgroup ?? false,
        wantsToJoinDgroup: isPartOfDgroup === true ? null : wantsToJoinDgroup,
        prayerRequest: "",
      };
    }

    return {
      attendedEvents: [] as string[],
      attendedEventsOther: "",
      isPartOfDgroup: false,
      wantsToJoinDgroup: null as boolean | null,
      prayerRequest: "",
    };
  };

  const buildSubmitPayload = () => {
    if (!player) {
      throw new Error("Player is required.");
    }

    const base = {
      gameId,
      personalQrCode: player.personalQrCode,
      registrationSource: QR_UPLOAD_REGISTRATION_SOURCE,
      ...buildProfilePayload(),
    };

    if (!isCcfForm || player.ccfQuestionnaireMode === null) {
      return { ...base, qrUploadCcfMode: "none" as const };
    }

    if (player.ccfQuestionnaireMode === "join_dgroup_only") {
      if (wantsToJoinDgroup !== true && wantsToJoinDgroup !== false) {
        return {
          ...base,
          qrUploadCcfMode: "join_dgroup_only" as const,
          wantsToJoinDgroup: undefined,
        };
      }
      return {
        ...base,
        qrUploadCcfMode: "join_dgroup_only" as const,
        wantsToJoinDgroup,
        ...buildDgroupAvailabilityPayload(),
      };
    }

    if (player.ccfQuestionnaireMode === "full") {
      return {
        ...base,
        qrUploadCcfMode: "full" as const,
        ...buildCcfQuestionnairePayload(),
        ...buildDgroupAvailabilityPayload(),
      };
    }

    return { ...base, qrUploadCcfMode: "none" as const };
  };

  const validatePayload = (
    payload: ReturnType<typeof buildSubmitPayload>,
    questionnaireMode: QrUploadCcfMode | null,
  ) => {
    if (!isCcfForm || questionnaireMode === "none" || questionnaireMode === null) {
      return qrUploadSkipExistingPlayerSchema.safeParse(payload);
    }
    if (questionnaireMode === "join_dgroup_only") {
      return qrUploadJoinDgroupExistingPlayerSchema.safeParse(payload);
    }
    return qrUploadFullExistingPlayerSchema.safeParse(payload);
  };

  const submit = async () => {
    if (!player) {
      toast.error("Scan or upload your personal QR first.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildSubmitPayload();
      const validation = validatePayload(payload, player.ccfQuestionnaireMode);

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
        if (response.status === 409) {
          if (data.checkedOut) {
            toast.error(CHECKED_OUT_RE_REGISTER_MESSAGE);
            setPlayer((current) =>
              current ? { ...current, queueStatus: "checked_out" } : current,
            );
            setSubmitting(false);
            return;
          }

          const playerId =
            data?.player?._id != null ? String(data.player._id) : player.playerId;
          const alreadyRegistered =
            data.alreadyRegistered === true || data.message === ALREADY_REGISTERED_MESSAGE;

          if (alreadyRegistered && playerId) {
            await goToSpectatorView(playerId);
            return;
          }
        }

        toast.error(typeof data.message === "string" ? data.message : "Check-in failed.");
        setSubmitting(false);
        return;
      }

      await finishRegistrationSuccess(data?.player?._id);
    } catch {
      toast.error("Check-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectCcfEventsBefore = (answer: CcfEventsBeforeAnswer) => {
    setCcfEventsBefore(answer);
    if (answer === "not_yet") {
      setAttendedEvents([]);
      setIsPartOfDgroup(null);
      setWantsToJoinDgroup(null);
      return;
    }
    setAttendedEvents([]);
    setIsPartOfDgroup(null);
    setWantsToJoinDgroup(null);
  };

  const showCcfQuestionnaire =
    player?.ccfQuestionnaireMode === "full" || player?.ccfQuestionnaireMode === "join_dgroup_only";

  const flowComplete = useMemo(
    () =>
      player
        ? isQrUploadFlowComplete({
            playerSnapshot: player.profileSnapshot,
            profileForm,
            ccfMode: player.ccfQuestionnaireMode,
            ccfAnswers,
            dgroupAvailability,
          })
        : false,
    [player, profileForm, ccfAnswers, dgroupAvailability],
  );

  return (
    <>
      {lookupLoading || submitting || navigating ? (
        <div
          className="register-loading-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="register-loading-overlay-content">
            <Loader2 className="register-loading-spinner" aria-hidden />
            <p className="register-loading-title">
              {navigating
                ? "Opening live view…"
                : submitting
                  ? "Adding you to the queue…"
                  : "Reading QR ID…"}
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

            {player.needsProfileCompletion ? (
              <QrUploadProfileSection
                values={profileForm}
                fieldErrors={fieldErrors}
                disabled={submitting}
                onChange={(patch) => setProfileForm((current) => ({ ...current, ...patch }))}
              />
            ) : null}

            {showCcfQuestionnaire ? (
              <CcfQuestionnaireSection
                variant={
                  player.ccfQuestionnaireMode === "join_dgroup_only" ? "join_dgroup_only" : "full"
                }
                ccfEventsBefore={ccfEventsBefore}
                attendedEvents={attendedEvents}
                isPartOfDgroup={isPartOfDgroup}
                wantsToJoinDgroup={wantsToJoinDgroup}
                fieldErrors={fieldErrors}
                disabled={submitting}
                eventsBlockRef={eventsBlockRef}
                dgroupBlockRef={dgroupBlockRef}
                joinDgroupBlockRef={joinDgroupBlockRef}
                onSelectCcfEventsBefore={selectCcfEventsBefore}
                onToggleEvent={(item, checked) => {
                  setAttendedEvents((current) =>
                    checked ? [...current, item] : current.filter((value) => value !== item),
                  );
                }}
                onSelectDgroupMembership={(inDgroup) => {
                  setIsPartOfDgroup(inDgroup);
                  setWantsToJoinDgroup(inDgroup ? null : wantsToJoinDgroup);
                  if (inDgroup) {
                    setDgroupAvailableDays([]);
                    setDgroupAvailableTimeFrom("");
                    setDgroupAvailableTimeTo("");
                  }
                }}
                onSelectWantsToJoinDgroup={(value) => {
                  setWantsToJoinDgroup(value);
                  if (value !== true) {
                    setDgroupAvailableDays([]);
                    setDgroupAvailableTimeFrom("");
                    setDgroupAvailableTimeTo("");
                  }
                }}
                renderFieldError={renderFieldError}
              />
            ) : null}

            {collectDgroupAvailability ? (
              <DgroupAvailabilityFields
                days={dgroupAvailableDays}
                timeFrom={dgroupAvailableTimeFrom}
                timeTo={dgroupAvailableTimeTo}
                disabled={submitting}
                fieldErrors={fieldErrors}
                onToggleDay={(day, checked) => {
                  setDgroupAvailableDays((current) =>
                    checked ? [...current, day] : current.filter((value) => value !== day),
                  );
                }}
                onTimeFromChange={setDgroupAvailableTimeFrom}
                onTimeToChange={setDgroupAvailableTimeTo}
              />
            ) : null}

            {flowComplete ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full border-2 border-dashed"
                  onClick={() => {
                    setPlayer(null);
                    resetFlowState();
                  }}
                >
                  <QrCode className="mr-2 h-5 w-5" aria-hidden />
                  Use a different QR
                </Button>

                <Button
                  type="button"
                  size="lg"
                  className="register-submit w-full"
                  disabled={submitting || navigating || player.queueStatus === "checked_out"}
                  onClick={() => void submit()}
                >
                  {submitting || navigating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      {navigating ? "Loading queue…" : "Please wait.."}
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-5 w-5" aria-hidden />
                      Proceed to the Game Queue!
                    </>
                  )}
                </Button>
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
