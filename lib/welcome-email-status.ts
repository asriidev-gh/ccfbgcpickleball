export type WelcomeEmailStatus = "success" | "failed" | "skipped";

export type RegistrationWelcomeEmailResult =
  | { sent: true; id?: string }
  | { sent: false; reason: "not_configured" | "missing_recipient" }
  | { sent: false; reason: "provider_error" | "exception"; error: unknown };

export function getWelcomeEmailFailureMessage(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Unknown email error.";
}

function getWelcomeEmailSkippedMessage(reason: "not_configured" | "missing_recipient") {
  if (reason === "not_configured") return "Resend API key is not configured.";
  return "Player email address is missing.";
}

export function buildWelcomeEmailPlayerUpdate(result: RegistrationWelcomeEmailResult) {
  const welcomeEmailSentAt = new Date();

  if (result.sent) {
    return {
      welcomeEmailStatus: "success" as const,
      welcomeEmailError: "",
      welcomeEmailSentAt,
    };
  }

  if (result.reason === "not_configured" || result.reason === "missing_recipient") {
    return {
      welcomeEmailStatus: "skipped" as const,
      welcomeEmailError: getWelcomeEmailSkippedMessage(result.reason),
      welcomeEmailSentAt,
    };
  }

  const failure = result as Extract<
    RegistrationWelcomeEmailResult,
    { sent: false; reason: "provider_error" | "exception" }
  >;

  return {
    welcomeEmailStatus: "failed" as const,
    welcomeEmailError: getWelcomeEmailFailureMessage(failure.error),
    welcomeEmailSentAt,
  };
}
