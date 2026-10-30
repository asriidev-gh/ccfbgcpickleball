import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import {
  clearPasskeyChallengeCookie,
  getPasskeyRelyingParty,
  readPasskeyChallenge,
  setAuthSessionCookie,
} from "@/lib/passkey";
import { isPasskeyLoginEnabled } from "@/lib/system-features-server";
import { recordUserLogin } from "@/lib/user-auth-audit";
import { BLOCKED_LOGIN_MESSAGE, isUserBlocked } from "@/lib/user-block";
import { User } from "@/models/User";

const FAILED = "Passkey sign-in failed. Use your password instead.";

export async function POST(request: Request) {
  try {
    return await runWithDatabase(async () => {
      if (!(await isPasskeyLoginEnabled())) {
        return NextResponse.json({ message: "Passkey login is turned off." }, { status: 403 });
      }

      const saved = readPasskeyChallenge(request, "login");
      if (!saved) {
        return NextResponse.json({ message: "Sign-in expired. Please try again." }, { status: 400 });
      }

      const body = (await request.json()) as AuthenticationResponseJSON;
      const user = await User.findOne({ "passkeys.credentialId": body.id });
      const passkey = user?.passkeys.find((key) => key.credentialId === body.id);
      if (!user || !passkey) return NextResponse.json({ message: FAILED }, { status: 401 });

      if (isUserBlocked(user)) {
        return NextResponse.json({ message: BLOCKED_LOGIN_MESSAGE }, { status: 403 });
      }

      const { rpID, origin } = getPasskeyRelyingParty(request);
      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: saved.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
          counter: passkey.counter,
          transports: passkey.transports as never,
        },
      });
      if (!verification.verified) return NextResponse.json({ message: FAILED }, { status: 401 });

      await User.updateOne(
        { _id: user._id, "passkeys.credentialId": passkey.credentialId },
        { $set: { "passkeys.$.counter": verification.authenticationInfo.newCounter } },
      );
      await recordUserLogin(user._id.toString(), request);

      const response = NextResponse.json({
        user: { id: user._id, email: user.email, name: user.name },
      });
      setAuthSessionCookie(response, user);
      return clearPasskeyChallengeCookie(response);
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : FAILED },
      { status: 400 },
    );
  }
}
