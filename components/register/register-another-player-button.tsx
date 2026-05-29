"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { promptIfRegistrationFull } from "@/components/game/registration-capacity-prompt";
import { Button } from "@/components/ui/button";

export function RegisterAnotherPlayerButton({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const canProceed = await promptIfRegistrationFull(gameId);
      if (canProceed) {
        router.push(`/register/${gameId}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check registration status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      className="w-full"
      disabled={loading}
      onClick={handleClick}
    >
      {loading ? "Checking…" : "Register another player"}
    </Button>
  );
}
