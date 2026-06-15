import { CCF_ATTENDED_NOT_YET } from "@/lib/ccf-registration";
import { isPlayerCcfAttended } from "@/lib/player-profile-shared";

export const QR_UPLOAD_CCF_MODES = ["none", "full", "join_dgroup_only"] as const;
export type QrUploadCcfMode = (typeof QR_UPLOAD_CCF_MODES)[number];

export type QrUploadCcfQuestionnaireAnswers = {
  ccfEventsBefore: "yes" | "not_yet" | null;
  attendedEvents: string[];
  isPartOfDgroup: boolean | null;
  wantsToJoinDgroup: boolean | null;
};

export function resolveQrUploadCcfQuestionnaireMode(player: {
  attendedEvents?: string[] | null;
  isPartOfDgroup?: boolean | null;
}): QrUploadCcfMode {
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
