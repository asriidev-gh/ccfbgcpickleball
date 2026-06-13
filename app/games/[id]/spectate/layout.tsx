import { SpectateMobileShell } from "@/components/player/spectate-mobile-shell";

export default async function SpectateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = await params;

  return <SpectateMobileShell gameId={gameId}>{children}</SpectateMobileShell>;
}
