import Link from "next/link";
import { Eye } from "lucide-react";

import { RegisterAnotherPlayerButton } from "@/components/register/register-another-player-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RegisterSuccessPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return (
    <main className="register-page items-center">
      <section className="register-shell max-w-xl">
        <Card className="register-card w-full border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="page-title">You are in the queue!</CardTitle>
          </CardHeader>
          <CardContent className="register-form-compact">
            <p className="text-base leading-relaxed text-muted-foreground">
              Thank you for registering. Your profile and queue entry are now active.
            </p>
            <div className="flex flex-col gap-3">
              <Link href={`/games/${gameId}/spectate`}>
                <Button size="lg" className="register-submit w-full">
                  <Eye className="mr-2 h-5 w-5" />
                  Proceed to the Game Queue!
                </Button>
              </Link>
              <RegisterAnotherPlayerButton gameId={gameId} />
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
