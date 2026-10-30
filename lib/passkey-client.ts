import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(data.message ?? "Passkey request failed.");
  return data;
}

export function isPasskeySupported() {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

function friendlyPasskeyError(error: unknown) {
  if (error instanceof Error && error.name === "NotAllowedError") {
    return new Error("Passkey request was cancelled.");
  }
  return error instanceof Error ? error : new Error("Passkey request failed.");
}

/** Registers a passkey for the signed-in user (prompts Face ID / fingerprint / Windows Hello). */
export async function registerPasskey() {
  try {
    const optionsJSON = await postJson<Parameters<typeof startRegistration>[0]["optionsJSON"]>(
      "/api/auth/passkey/register/options",
    );
    const credential = await startRegistration({ optionsJSON });
    await postJson("/api/auth/passkey/register/verify", credential);
  } catch (error) {
    throw friendlyPasskeyError(error);
  }
}

/** Signs in with an existing passkey; the server sets the auth cookie on success. */
export async function signInWithPasskey() {
  try {
    const optionsJSON = await postJson<Parameters<typeof startAuthentication>[0]["optionsJSON"]>(
      "/api/auth/passkey/login/options",
    );
    const credential = await startAuthentication({ optionsJSON });
    await postJson("/api/auth/passkey/login/verify", credential);
  } catch (error) {
    throw friendlyPasskeyError(error);
  }
}
