import { APP_NAME } from "@/lib/app-config";

export function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || process.env.RESEND?.trim() || "";
}

export function isResendConfigured() {
  return Boolean(getResendApiKey());
}

export function getResendFromEmail() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  return `${APP_NAME} <onboarding@resend.dev>`;
}
