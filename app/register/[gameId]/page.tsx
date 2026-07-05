import { notFound, redirect } from "next/navigation";

import { RegistrationForm } from "@/components/register/registration-form";
import { runWithDatabase } from "@/lib/db";
import { getGameRegistrationPagePayload } from "@/lib/game-registration-limit";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { gameId } = await params;
  const { mode } = await searchParams;

  const payload = await runWithDatabase(() => getGameRegistrationPagePayload(gameId));
  if (!payload) notFound();

  if (payload.allowQrRegistration === false) {
    redirect(`/games/${gameId}/spectate`);
  }

  return (
    <RegistrationForm
      gameId={gameId}
      gameTitle={payload.gameTitle}
      formVariant={payload.formVariant}
      initialRegistrationStatus={payload}
      initialMode={mode === "upload-qr" ? "upload-qr" : undefined}
    />
  );
}
