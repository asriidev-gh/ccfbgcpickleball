import { RegistrationEntry } from "@/components/register/registration-entry";

/** Instant shell — session status loads on the client so QR scans are not blocked on Mongo. */
export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { gameId } = await params;
  const { mode } = await searchParams;

  return (
    <RegistrationEntry
      gameId={gameId}
      initialMode={mode === "upload-qr" ? "upload-qr" : undefined}
    />
  );
}
