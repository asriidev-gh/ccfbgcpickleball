import { RegisterSuccessActions } from "@/components/register/register-success-actions";
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
            <RegisterSuccessActions gameId={gameId} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
