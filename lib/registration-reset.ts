export const REGISTRATION_RESET_EVENT = "paddleflow:registration-reset";

export function dispatchRegistrationReset() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REGISTRATION_RESET_EVENT));
}
