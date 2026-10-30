import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getPasskeyRelyingParty, setPasskeyChallengeCookie } from "@/lib/passkey";
import { isPasskeyLoginEnabled } from "@/lib/system-features-server";

export async function POST(request: Request) {
  try {
    if (!(await runWithDatabase(() => isPasskeyLoginEnabled()))) {
      return NextResponse.json({ message: "Passkey login is turned off." }, { status: 403 });
    }

    const { rpID } = getPasskeyRelyingParty(request);
    // No allowCredentials: the device offers whichever discoverable passkey the user has for this site.
    const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
    return setPasskeyChallengeCookie(NextResponse.json(options), "login", options.challenge);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not start passkey sign-in." },
      { status: 400 },
    );
  }
}
