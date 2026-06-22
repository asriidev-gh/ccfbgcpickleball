"use client";

import { QuickPlaySetup } from "@/components/play/quick-play-setup";

export default function QuickPlayPage() {
  return (
    <main className="min-h-screen px-6 py-8 pb-12 lg:px-10">
      <section className="mx-auto flex max-w-3xl flex-col">
        <QuickPlaySetup />
      </section>
    </main>
  );
}
