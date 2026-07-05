import { Loader2 } from "lucide-react";

export default function RegisterLoading() {
  return (
    <main className="register-page">
      <section className="register-shell">
        <div
          className="register-card flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 shadow-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading registration…</p>
        </div>
      </section>
    </main>
  );
}
