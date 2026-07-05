"use client";

import Swal from "sweetalert2";

import type { CourtView } from "@/components/game/court-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { GameRegistrationStatus } from "@/lib/game-registration-limit";
import { REGISTRATION_FEATURE_DEFAULT } from "@/lib/registration-feature";
import { countSessionRegisteredPlayers } from "@/lib/session-registered-player-count";

const registrationAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#22c55e",
};

export async function fetchGameRegistrationStatus(gameId: string) {
  const response = await fetch(`/api/games/${gameId}/registration-status`);
  const payload = (await response.json()) as GameRegistrationStatus & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to check registration status.");
  }
  return payload;
}

export function getRegistrationBlockedMessage(status: GameRegistrationStatus) {
  if (status.status === "ended") {
    return "Registration is closed for this session.";
  }
  if (status.isFull) {
    return `Registration is full. This session is limited to ${status.expectedPlayers} players (${status.registeredCount} already registered).`;
  }
  return null;
}

async function promptIfRegistrationCapacityBlocked(status: GameRegistrationStatus) {
  if (status.allowQrRegistration === false) {
    return true;
  }

  if (!status.isFull) {
    return true;
  }

  const message = getRegistrationBlockedMessage(status);
  if (!message) {
    return true;
  }

  if (status.status === "ended") {
    await Swal.fire({
      ...registrationAlertOptions,
      icon: "info",
      title: "Registration closed",
      text: message,
      confirmButtonText: "OK",
    });
    return false;
  }

  await Swal.fire({
    ...registrationAlertOptions,
    icon: "warning",
    title: "Registration full",
    html: `This session uses a <strong>strict player limit of ${status.expectedPlayers}</strong> and is already full (<strong>${status.registeredCount}</strong> registered).`,
    confirmButtonText: "OK",
  });
  return false;
}

function buildRegistrationStatusFromSession(input: {
  gameId: string;
  status: "draft" | "active" | "ended";
  strictPlayerCount?: boolean;
  expectedPlayers?: number;
  allowQrRegistration?: boolean;
  registeredCount: number;
}): GameRegistrationStatus | null {
  if (input.expectedPlayers == null || input.strictPlayerCount == null) {
    return null;
  }

  const strict = input.strictPlayerCount === true;
  const allowQrRegistration = input.allowQrRegistration !== false;
  const isFull =
    input.status === "ended" || (strict && input.registeredCount >= input.expectedPlayers);

  return {
    gameId: input.gameId,
    formVariant: "generic",
    registrationFeature: REGISTRATION_FEATURE_DEFAULT,
    strictPlayerCount: strict,
    allowQrRegistration,
    expectedPlayers: input.expectedPlayers,
    registeredCount: input.registeredCount,
    isFull,
    spotsRemaining: strict
      ? Math.max(0, input.expectedPlayers - input.registeredCount)
      : null,
    status: input.status,
  };
}

/** Returns true if registration can proceed; false if user dismissed a full-session prompt. */
export async function promptIfRegistrationFullFromStatus(status: GameRegistrationStatus) {
  return promptIfRegistrationCapacityBlocked(status);
}

/** Returns true if registration can proceed; false if user dismissed a full-session prompt. */
export async function promptIfRegistrationFull(gameId: string) {
  const status = await fetchGameRegistrationStatus(gameId);
  return promptIfRegistrationCapacityBlocked(status);
}

/** Uses already-loaded dashboard data when possible to skip a registration-status round trip. */
export async function promptIfRegistrationFullFromSession(input: {
  gameId: string;
  status: "draft" | "active" | "ended";
  strictPlayerCount?: boolean;
  expectedPlayers?: number;
  allowQrRegistration?: boolean;
  queue: QueueEntryView[];
  checkedOut: QueueEntryView[];
  courts: CourtView[];
}) {
  const localStatus = buildRegistrationStatusFromSession({
    gameId: input.gameId,
    status: input.status,
    strictPlayerCount: input.strictPlayerCount,
    expectedPlayers: input.expectedPlayers,
    allowQrRegistration: input.allowQrRegistration,
    registeredCount: countSessionRegisteredPlayers({
      queue: input.queue,
      checkedOut: input.checkedOut,
      courts: input.courts,
    }),
  });

  if (localStatus) {
    return promptIfRegistrationCapacityBlocked(localStatus);
  }

  return promptIfRegistrationFull(input.gameId);
}
