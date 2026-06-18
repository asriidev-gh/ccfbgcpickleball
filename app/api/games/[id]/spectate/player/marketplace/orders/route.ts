import { NextResponse } from "next/server";

import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { RegistrationLimitError } from "@/lib/game-registration-limit";
import { listPlayerMarketplaceOrders, submitMarketplaceOrder } from "@/lib/marketplace-orders";
import { marketplacePaymentRequiresProof } from "@/lib/marketplace-payment-shared";
import { parseMarketplaceOrderFormData } from "@/lib/parse-marketplace-order-form";
import { PlayerProfileAccessError } from "@/lib/player-profile";
import { spectateMarketplaceOrderPlayerSchema } from "@/lib/validations";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const { searchParams } = new URL(request.url);
    const parsed = spectateMarketplaceOrderPlayerSchema.safeParse({
      playerId: searchParams.get("playerId"),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const orders = await listPlayerMarketplaceOrders(gameId, parsed.data.playerId);
      return NextResponse.json({ orders });
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof RegistrationLimitError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load orders." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const formData = await request.formData();
    const { parsed, paymentProofFile } = parseMarketplaceOrderFormData(formData);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    if (marketplacePaymentRequiresProof(parsed.data.paymentMethod)) {
      if (!isCloudinaryConfigured()) {
        return NextResponse.json(
          { message: "Payment proof upload is not configured on this server." },
          { status: 400 },
        );
      }
      if (!paymentProofFile) {
        return NextResponse.json(
          { message: "Upload proof of payment for GCash or bank transfer orders." },
          { status: 400 },
        );
      }
    }

    return await runWithDatabase(async () => {
      const order = await submitMarketplaceOrder(
        gameId,
        parsed.data.playerId,
        {
          listingId: parsed.data.listingId,
          lines: parsed.data.lines,
          delivery: parsed.data.delivery,
          paymentMethod: parsed.data.paymentMethod,
        },
        paymentProofFile,
      );
      return NextResponse.json({
        order,
        message: "Order submitted. The seller will follow up with you.",
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
      { message: error instanceof Error ? error.message : "Failed to submit order." },
      { status: 400 },
    );
  }
}
