import { ZodError } from "zod";

type ZodIssueLike = {
  message?: string;
  path?: (string | number)[];
  code?: string;
};

function friendlyFieldLabel(path: (string | number)[] | undefined) {
  const key = path?.[0];
  switch (key) {
    case "firstName":
      return "First name";
    case "lastName":
      return "Last name";
    case "mobileNumber":
      return "Mobile number";
    case "email":
      return "Email";
    case "personalQrCode":
      return "Personal QR code";
    case "attendedEvents":
      return "CCF events attended";
    case "wantsToJoinDgroup":
      return "Join a D-group";
    case "isPartOfDgroup":
      return "D-group membership";
    case "volunteerType":
      return "Volunteer type";
    default:
      return typeof key === "string" ? key : "This field";
  }
}

function friendlyIssueMessage(issue: ZodIssueLike): string {
  if (issue.message && !issue.message.startsWith("[")) return issue.message;

  const field = friendlyFieldLabel(issue.path);
  if (issue.code === "too_small" && issue.path?.[0] === "mobileNumber") {
    return "Enter a valid mobile number (at least 7 digits).";
  }
  if (issue.code === "invalid_format" && issue.path?.[0] === "email") {
    return "Enter a valid email address.";
  }
  if (issue.code === "too_small") {
    return `${field} is required.`;
  }
  return issue.message ?? "Please check your entries and try again.";
}

export function getZodFieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) {
      errors[key] = friendlyIssueMessage(issue as ZodIssueLike);
    }
  }
  return errors;
}

export function getFirstZodErrorField(error: ZodError): string | null {
  const first = error.issues[0];
  const key = first?.path[0];
  return typeof key === "string" ? key : null;
}

export function formatZodError(error: unknown): string {
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (trimmed.startsWith("[") && trimmed.includes('"path"')) {
      try {
        const parsed = JSON.parse(trimmed) as ZodIssueLike[];
        if (parsed[0]) return friendlyIssueMessage(parsed[0]);
      } catch {
        // fall through
      }
    }
    return trimmed || "Please check your entries and try again.";
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0] as ZodIssueLike | undefined;
    if (issue) return friendlyIssueMessage(issue);
  }

  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed.startsWith("[") && trimmed.includes('"path"')) {
      try {
        const parsed = JSON.parse(trimmed) as ZodIssueLike[];
        if (parsed[0]) return friendlyIssueMessage(parsed[0]);
      } catch {
        // fall through
      }
    }
    if (trimmed && !trimmed.startsWith("[")) return trimmed;
  }

  return "Please check your entries and try again.";
}
