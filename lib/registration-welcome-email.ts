import { Resend } from "resend";

import { APP_NAME } from "@/lib/app-config";
import { formatPublicAppPath, getPlayerLoginUrl } from "@/lib/app-url";
import {
  buildPlayerQrDataUrlWithBranding,
  getPlayerQrDownloadFilename,
} from "@/lib/player-qr";
import { resolvePlayerQrRenderOptionsForGame } from "@/lib/player-qr-branding";
import { getResendApiKey, getResendFromEmail } from "@/lib/resend-config";
import type { RegistrationWelcomeEmailResult } from "@/lib/welcome-email-status";
import { formatPlayerDisplayName } from "@/lib/utils";

type RegistrationWelcomeEmailInput = {
  to: string;
  firstName: string;
  lastName: string;
  personalQrCode: string;
  gameId: string;
  gameTitle: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildWelcomeEmailHtml(input: {
  displayName: string;
  gameTitle: string;
  personalQrCode: string;
  playerLoginUrl: string;
  playerLoginLabel: string;
}) {
  const safeName = escapeHtml(input.displayName);
  const safeGameTitle = escapeHtml(input.gameTitle);
  const safeQrCode = escapeHtml(input.personalQrCode);
  const safePlayerLoginUrl = escapeHtml(input.playerLoginUrl);
  const safePlayerLoginLabel = escapeHtml(input.playerLoginLabel);

  return `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 16px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">${escapeHtml(APP_NAME)}</p>
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#0f172a;">Welcome, ${safeName}!</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">
                  You&apos;re registered for <strong>${safeGameTitle}</strong>. Save the personal QR ID below and show it at future open play sessions for quick check-in.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 28px 0;">
                <img
                  src="cid:personal-qr-code"
                  alt="Personal QR code for ${safeName}"
                  width="320"
                  style="display:block;width:100%;max-width:320px;height:auto;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;"
                />
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Personal QR ID</p>
                <p style="margin:0 0 16px;font-size:18px;font-weight:700;letter-spacing:0.02em;color:#0f172a;word-break:break-all;">${safeQrCode}</p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">
                  Your QR image is attached to this email. Keep it on your phone or print it so you can check in faster next time.
                </p>
                <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#334155;">
                  To login your profile:
                  <a href="${safePlayerLoginUrl}" style="color:#2563eb;text-decoration:underline;">${safePlayerLoginLabel}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

export async function sendRegistrationWelcomeEmail(
  input: RegistrationWelcomeEmailInput,
): Promise<RegistrationWelcomeEmailResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    console.warn("[registration-email] Resend API key not configured; skipping welcome email.");
    return { sent: false as const, reason: "not_configured" as const };
  }

  const to = input.to.trim();
  if (!to) {
    return { sent: false as const, reason: "missing_recipient" as const };
  }

  const render = await resolvePlayerQrRenderOptionsForGame(input.gameId);
  const qrDataUrl = await buildPlayerQrDataUrlWithBranding(input.personalQrCode, {
    registrantFirstName: input.firstName,
    registrantLastName: input.lastName,
    branding: render.branding,
    includeClubLogo: render.includeClubLogo,
    clubLogoUrl: render.clubLogoUrl,
  });

  const base64 = qrDataUrl.includes(",") ? (qrDataUrl.split(",")[1] ?? "") : qrDataUrl;
  const qrBuffer = Buffer.from(base64, "base64");
  const displayName = formatPlayerDisplayName(input.firstName, input.lastName) || "Player";
  const filename = getPlayerQrDownloadFilename(input.firstName, input.personalQrCode);
  const playerLoginUrl = getPlayerLoginUrl();
  const playerLoginLabel = formatPublicAppPath(playerLoginUrl);
  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: getResendFromEmail(),
      to,
      subject: `Welcome to ${input.gameTitle} — your personal QR ID`,
      html: buildWelcomeEmailHtml({
        displayName,
        gameTitle: input.gameTitle,
        personalQrCode: input.personalQrCode,
        playerLoginUrl,
        playerLoginLabel,
      }),
      attachments: [
        {
          filename,
          content: qrBuffer,
          contentType: "image/svg+xml",
          contentId: "personal-qr-code",
        },
      ],
    });

    if (result.error) {
      console.error("[registration-email] Resend returned an error:", result.error);
      return { sent: false as const, reason: "provider_error" as const, error: result.error };
    }

    return { sent: true as const, id: result.data?.id };
  } catch (error) {
    console.error("[registration-email] Failed to send welcome email:", error);
    return { sent: false as const, reason: "exception" as const, error };
  }
}
