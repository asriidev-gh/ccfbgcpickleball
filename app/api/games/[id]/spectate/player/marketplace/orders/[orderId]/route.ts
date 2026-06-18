import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { RegistrationLimitError } from "@/lib/game-registration-limit";
import { cancelPlayerMarketplaceOrder } from "@/lib/marketplace-orders";
import { PlayerProfileAccessError } from "@/lib/player-profile";
import { spectateMarketplaceOrderPlayerSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  try {
    const { id: gameId, orderId } = await params;
    const body = await request.json();
    const parsed = spectateMarketplaceOrderPlayerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const order = await cancelPlayerMarketplaceOrder(gameId, parsed.data.playerId, orderId);
      return NextResponse.json({
        order,
        message: "Order cancelled.",
      });
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof RegistrationLimitError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to cancel order." },
      { status: 400 },
    );
  }
}
