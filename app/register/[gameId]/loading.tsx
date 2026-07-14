export default function RegisterLoading() {
  return (
    <main className="register-page">
      <section className="register-shell">
        <div
          className="register-card space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading registration"
        >
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted/70" />
          </div>
          <div className="space-y-3">
            <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
          </div>
          <p className="text-center text-sm text-muted-foreground">Opening registration…</p>
        </div>
      </section>
    </main>
  );
}
