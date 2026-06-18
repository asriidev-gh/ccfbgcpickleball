import { getDgroupTimeRangeError } from "@/lib/dgroup-availability-shared";
import type { DgroupWeekday } from "@/lib/dgroup-availability-shared";
import { CCF_ATTENDED_NOT_YET } from "@/lib/ccf-registration";
import { isPlayerCcfAttended } from "@/lib/player-profile-shared";
import {
  isQrUploadProfileFormComplete,
  needsQrUploadProfileCompletion,
  type QrUploadProfileFormValues,
  type QrUploadProfileSnapshot,
} from "@/lib/qr-upload-profile-shared";

export const QR_UPLOAD_CCF_MODES = ["none", "full", "join_dgroup_only"] as const;
export type QrUploadCcfMode = (typeof QR_UPLOAD_CCF_MODES)[number];

export type QrUploadCcfQuestionnaireAnswers = {
  ccfEventsBefore: "yes" | "not_yet" | null;
  attendedEvents: string[];
  isPartOfDgroup: boolean | null;
  wantsToJoinDgroup: boolean | null;
};

export type QrUploadDgroupAvailabilityAnswers = {
  dgroupAvailableDays: DgroupWeekday[];
  dgroupAvailableTimeFrom: string;
  dgroupAvailableTimeTo: string;
};

export function resolveQrUploadCcfQuestionnaireMode(
  player: {
    attendedEvents?: string[] | null;
    isPartOfDgroup?: boolean | null;
  },
  context?: {
    gameOwnerUserType?: string | null;
    isPlayerGameOwner?: boolean;
  },
): QrUploadCcfMode {
  const ownerIsCcf = context?.gameOwnerUserType === "ccf";
  const playerNotAttendingCcf = !isPlayerCcfAttended(player.attendedEvents);

  if (ownerIsCcf && playerNotAttendingCcf) {
    return "full";
  }

  if (isPlayerCcfAttended(player.attendedEvents)) {
    return player.isPartOfDgroup === true ? "none" : "join_dgroup_only";
  }

  return "full";
}

export function parseQrUploadCcfMode(value: unknown): QrUploadCcfMode | null {
  if (value === "none" || value === "full" || value === "join_dgroup_only") {
    return value;
  }
  return null;
}

export function isQrUploadCcfQuestionnaireComplete(
  mode: QrUploadCcfMode | null,
  answers: QrUploadCcfQuestionnaireAnswers,
) {
  if (mode === null || mode === "none") return true;

  if (mode === "join_dgroup_only") {
    return answers.wantsToJoinDgroup === true || answers.wantsToJoinDgroup === false;
  }

  if (answers.ccfEventsBefore === null) return false;
  if (answers.ccfEventsBefore === "not_yet") return true;

  const realEvents = answers.attendedEvents.filter((event) => event !== CCF_ATTENDED_NOT_YET);
  if (realEvents.length === 0) return false;
  if (answers.isPartOfDgroup === null) return false;
  if (answers.isPartOfDgroup === true) return true;
  return answers.wantsToJoinDgroup === true || answers.wantsToJoinDgroup === false;
}

export function shouldCollectDgroupAvailability(
  mode: QrUploadCcfMode | null,
  answers: QrUploadCcfQuestionnaireAnswers,
) {
  if (mode === "join_dgroup_only") {
    return answers.wantsToJoinDgroup === true;
  }
  if (mode === "full") {
    return answers.isPartOfDgroup === false && answers.wantsToJoinDgroup === true;
  }
  return false;
}

export function isQrUploadDgroupAvailabilityComplete(
  answers: QrUploadCcfQuestionnaireAnswers,
  availability: QrUploadDgroupAvailabilityAnswers,
  mode: QrUploadCcfMode | null,
) {
  if (!shouldCollectDgroupAvailability(mode, answers)) return true;
  if (availability.dgroupAvailableDays.length === 0) return false;
  if (!availability.dgroupAvailableTimeFrom || !availability.dgroupAvailableTimeTo) return false;
  return !getDgroupTimeRangeError(
    availability.dgroupAvailableTimeFrom,
    availability.dgroupAvailableTimeTo,
  );
}

export function isQrUploadFlowComplete(input: {
  playerSnapshot: QrUploadProfileSnapshot;
  profileForm: QrUploadProfileFormValues;
  ccfMode: QrUploadCcfMode | null;
  ccfAnswers: QrUploadCcfQuestionnaireAnswers;
  dgroupAvailability: QrUploadDgroupAvailabilityAnswers;
}) {
  const needsProfile = needsQrUploadProfileCompletion(input.playerSnapshot);
  if (needsProfile && !isQrUploadProfileFormComplete(input.profileForm)) {
    return false;
  }
  if (!isQrUploadCcfQuestionnaireComplete(input.ccfMode, input.ccfAnswers)) {
    return false;
  }
  if (
    !isQrUploadDgroupAvailabilityComplete(
      input.ccfAnswers,
      input.dgroupAvailability,
      input.ccfMode,
    )
  ) {
    return false;
  }
  return true;
}
