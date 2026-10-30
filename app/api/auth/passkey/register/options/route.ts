import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

import { APP_NAME } from "@/lib/app-config";
import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { getPasskeyRelyingParty, setPasskeyChallengeCookie } from "@/lib/passkey";
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

      const user = await User.findById(auth.userId).select("name email passkeys");
      if (!user) return NextResponse.json({ message: "Account not found." }, { status: 404 });

      const { rpID } = getPasskeyRelyingParty(request);
      const options = await generateRegistrationOptions({
        rpName: APP_NAME,
        rpID,
        userName: user.email,
        userDisplayName: user.name,
        userID: new TextEncoder().encode(user._id.toString()),
        attestationType: "none",
        excludeCredentials: user.passkeys.map((key) => ({
          id: key.credentialId,
          transports: key.transports as never,
        })),
        authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
      });

      return setPasskeyChallengeCookie(
        NextResponse.json(options),
        "register",
        options.challenge,
        user._id.toString(),
      );
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not start passkey setup." },
      { status: 400 },
    );
  }
}
