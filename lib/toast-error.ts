"use client";

import { toast } from "sonner";

import {
  getPublicErrorMessage,
  shouldSuppressUserNotification,
} from "@/lib/infrastructure-error";

/** Show a toast for operator/user failures, but stay silent for infrastructure errors (logged server-side). */
export function toastOperationError(error: unknown, fallback: string) {
  if (shouldSuppressUserNotification(error)) return;
  toast.error(getPublicErrorMessage(error, fallback));
}
