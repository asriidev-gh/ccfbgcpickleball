import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { getDeviceLabelFromRequest } from "@/lib/device-from-request";
import { runWithDatabase } from "@/lib/db";
import {
  clearPasskeyChallengeCookie,
  getPasskeyRelyingParty,
  readPasskeyChallenge,
} from "@/lib/passkey";
import { isSuperAdmin } from "@/lib/superadmin";
import { isPasskeyLoginEnabled } from "@/lib/system-features-server";
import { User } from "@/models/User";

export async function POST(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const auth = await getAuthUserFromCookie();
      if (!auth) return NextResponse.json({ message: "Please log in first." }, { status: 401 });

      if (!(await isPasskeyLoginEnabled()) && !isSuperAdmin(auth.email)) {
        return NextResponse.json({ message: "Passkey login is turned off." }, { status: 403 });
      }

      const saved = readPasskeyChallenge(request, "register");
      if (!saved || saved.userId !== auth.userId) {
        return NextResponse.json(
          { message: "Passkey setup expired. Please try again." },
          { status: 400 },
        );
      }

      const { rpID, origin } = getPasskeyRelyingParty(request);
      const verification = await verifyRegistrationResponse({
        response: await request.json(),
        expectedChallenge: saved.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
      if (!verification.verified) {
        return NextResponse.json({ message: "Could not verify passkey." }, { status: 400 });
      }

      const { credential } = verification.registrationInfo;
      await User.findByIdAndUpdate(auth.userId, {
        $push: {
          passkeys: {
            credentialId: credential.id,
            publicKey: Buffer.from(credential.publicKey).toString("base64url"),
            counter: credential.counter,
            transports: credential.transports ?? [],
            deviceLabel: getDeviceLabelFromRequest(request),
          },
        },
      });

      return clearPasskeyChallengeCookie(NextResponse.json({ ok: true }));
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not save passkey." },
      { status: 400 },
    );
  }
}
