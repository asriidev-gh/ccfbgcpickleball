const INFRASTRUCTURE_ERROR_PATTERN =
  /must be connected|not connected|before initial connection is complete|bufferCommands\s*=\s*false|connection closed|client was closed|operation interrupted|topology was destroyed|socket has been|connection is not ready|connection failed after multiple attempts|buffering timed out|session that has ended|closed connection pool|mongoexpiredsessionerror|mongopoolclosederror|mongoserverselectionerror|mongodb connection failed|mongodb connection is not ready/i;

function collectErrorMessages(error: unknown) {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = current.cause;
  }
  if (typeof current === "string") messages.push(current);
  return messages;
}

export function getErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function isInfrastructureError(error: unknown) {
  const text = collectErrorMessages(error).join(" ");
  if (!text.trim()) return false;
  return INFRASTRUCTURE_ERROR_PATTERN.test(text);
}

export function isInfrastructureErrorMessage(message: string) {
  return INFRASTRUCTURE_ERROR_PATTERN.test(message);
}

/** True when the error should not be shown in UI toasts or banners. */
export function shouldSuppressUserNotification(error: unknown) {
  return isInfrastructureError(error);
}

export function getPublicErrorMessage(error: unknown, fallback: string) {
  if (shouldSuppressUserNotification(error)) return fallback;
  const message = getErrorText(error).trim();
  if (!message || isInfrastructureErrorMessage(message)) return fallback;
  return message;
}

export function sanitizeErrorMessage(message: string | undefined, fallback: string) {
  const trimmed = message?.trim();
  if (!trimmed || isInfrastructureErrorMessage(trimmed)) return fallback;
  return trimmed;
}
