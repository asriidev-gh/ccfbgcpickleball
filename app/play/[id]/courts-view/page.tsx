"use client";

import { EphemeralCourtsView } from "@/components/play/ephemeral-courts-view";

export default function EphemeralCourtsViewPage() {
  return (
    <main className="min-h-screen px-6 py-6 pb-12 lg:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <EphemeralCourtsView />
      </div>
    </main>
  );
}
