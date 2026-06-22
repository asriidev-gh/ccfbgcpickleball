import { Resend } from "resend";

import { APP_NAME } from "@/lib/app-config";
import { getPublicAppBaseUrl } from "@/lib/app-url";
import { getResendApiKey, getResendFromEmail } from "@/lib/resend-config";

type AccountWelcomeEmailInput = {
  to: string;
  name: string;
  verificationToken: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAccountWelcomeEmailHtml(input: {
  name: string;
  verifyUrl: string;
}) {
  const safeName = escapeHtml(input.name);
  const safeVerifyUrl = escapeHtml(input.verifyUrl);

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
                  Thanks for creating your account. Please confirm your email address so you can create and manage open play games.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;">
                <a
                  href="${safeVerifyUrl}"
                  style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:10px;"
                >
                  Verify my email
                </a>
                <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#64748b;">
                  If the button does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#0f172a;word-break:break-all;">${safeVerifyUrl}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendAccountWelcomeVerificationEmail(
  input: AccountWelcomeEmailInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return { ok: false, message: "Email service is not configured." };
  }

  const verifyUrl = `${getPublicAppBaseUrl()}/verify-email?token=${encodeURIComponent(input.verificationToken)}`;
  const resend = new Resend(apiKey);

  const response = await resend.emails.send({
    from: getResendFromEmail(),
    to: input.to,
    subject: `Welcome to ${APP_NAME} — verify your email`,
    html: buildAccountWelcomeEmailHtml({ name: input.name, verifyUrl }),
  });

  if (response.error) {
    return { ok: false, message: response.error.message };
  }

  return { ok: true };
}
