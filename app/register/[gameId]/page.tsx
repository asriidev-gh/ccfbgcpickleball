import { notFound, redirect } from "next/navigation";

import { RegistrationForm } from "@/components/register/registration-form";
import { connectToDatabase } from "@/lib/db";
import { resolveGameRegistrationFormVariant } from "@/lib/resolve-game-registration-variant";
import { PickleGame } from "@/models/PickleGame";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  await connectToDatabase();
  const { gameId } = await params;
  const { mode } = await searchParams;
  const game = await PickleGame.findOne({ gameId }).select(
    "gameId title status allowQrRegistration",
  );
  if (!game) notFound();

  if (game.allowQrRegistration === false) {
    redirect(`/games/${gameId}/spectate`);
  }

  const formVariant = await resolveGameRegistrationFormVariant(gameId);
  if (!formVariant) notFound();

  return (
    <RegistrationForm
      gameId={gameId}
      gameTitle={game.title}
      formVariant={formVariant}
      initialMode={mode === "upload-qr" ? "upload-qr" : undefined}
    />
  );
}
