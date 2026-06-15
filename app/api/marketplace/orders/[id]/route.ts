import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  acknowledgeOwnerMarketplaceOrder,
  fulfillOwnerMarketplaceOrder,
  markForReleaseOwnerMarketplaceOrder,
} from "@/lib/marketplace-orders";
import { marketplaceOrderActionSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const parsed = marketplaceOrderActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const order =
        parsed.data.action === "acknowledge"
          ? await acknowledgeOwnerMarketplaceOrder(authUser.userId, orderId)
          : parsed.data.action === "mark_for_release"
            ? await markForReleaseOwnerMarketplaceOrder(authUser.userId, orderId)
            : await fulfillOwnerMarketplaceOrder(authUser.userId, orderId);

      const message =
        parsed.data.action === "acknowledge"
          ? "Order acknowledged."
          : parsed.data.action === "mark_for_release"
            ? "Order marked for release."
            : "Order marked fulfilled.";

      return NextResponse.json({ order, message });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update order." },
      { status: 400 },
    );
  }
}
