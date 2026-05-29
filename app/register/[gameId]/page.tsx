import { notFound } from "next/navigation";

import { RegistrationForm } from "@/components/register/registration-form";
import { connectToDatabase } from "@/lib/db";
import { PickleGame } from "@/models/PickleGame";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  await connectToDatabase();
  const { gameId } = await params;
  const game = await PickleGame.findOne({ gameId }).select("gameId title status");
  if (!game) notFound();

  return <RegistrationForm gameId={gameId} gameTitle={game.title} />;
}
