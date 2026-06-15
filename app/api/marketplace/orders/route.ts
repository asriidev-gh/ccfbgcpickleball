import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { listOwnerMarketplaceOrders } from "@/lib/marketplace-orders";

export async function GET() {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const orders = await listOwnerMarketplaceOrders(authUser.userId);
      return NextResponse.json({ orders });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load orders." },
      { status: 400 },
    );
  }
}
