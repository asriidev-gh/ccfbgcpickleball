"use client";

import Swal from "sweetalert2";

import type { GameRegistrationStatus } from "@/lib/game-registration-limit";

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

/** Returns true if registration can proceed; false if user dismissed a full-session prompt. */
export async function promptIfRegistrationFull(gameId: string) {
  const status = await fetchGameRegistrationStatus(gameId);

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
