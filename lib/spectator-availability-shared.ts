export const SPECTATOR_VIEW_UNAVAILABLE_MESSAGE =
  "The spectator view is currently not available. Please check with the administrator.";

export class SpectatorViewUnavailableError extends Error {
  readonly status = 503;

  constructor(message = SPECTATOR_VIEW_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "SpectatorViewUnavailableError";
  }
}

export function isSpectatorViewUnavailableError(
  error: unknown,
): error is SpectatorViewUnavailableError {
  if (error instanceof SpectatorViewUnavailableError) return true;
  const message = error instanceof Error ? error.message : "";
  return /spectator view is currently not available/i.test(message);
}
