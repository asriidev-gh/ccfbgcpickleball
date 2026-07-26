import { RegistrationEntry } from "@/components/register/registration-entry";

/** Instant shell — session status loads on the client so QR scans are not blocked on Mongo. */
export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ mode?: string; again?: string }>;
}) {
  const { gameId } = await params;
  const { mode, again } = await searchParams;

  return (
    <RegistrationEntry
      gameId={gameId}
      initialMode={mode === "upload-qr" ? "upload-qr" : undefined}
      allowAnotherRegistration={again === "1" || again === "true"}
    />
  );
}
