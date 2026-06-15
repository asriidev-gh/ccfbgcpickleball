import { connectToDatabase } from "@/lib/db";
import { uploadMarketplaceOrderPaymentProof } from "@/lib/marketplace-photo-upload";
import type { MarketplaceFulfillmentMethod } from "@/lib/marketplace-listings-shared";
import {
  marketplacePaymentRequiresProof,
  type MarketplacePaymentMethod,
} from "@/lib/marketplace-payment-shared";
import { MARKETPLACE_PAYMENT_METHODS } from "@/lib/marketplace-payment-shared";
import type {
  MarketplaceOrderDeliveryDetails,
  MarketplaceOrderItem,
  MarketplaceOrderLine,
} from "@/lib/marketplace-orders-shared";
import { marketplaceOrderLineTotalQuantity } from "@/lib/marketplace-orders-shared";
import { MarketplaceListing } from "@/models/MarketplaceListing";
import { MarketplaceOrder } from "@/models/MarketplaceOrder";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { assertPlayerRegisteredForGame } from "@/lib/player-profile";

type OrderDoc = {
  _id: { toString(): string };
  listingId: { toString(): string };
  listingTitle: string;
  listingPhotoUrl?: string | null;
  playerId: { toString(): string };
  playerName: string;
  gameId: string;
  lines: Array<{ size?: string | null; color?: string | null; quantity: number }>;
  fulfillmentMethod?: MarketplaceFulfillmentMethod | string | null;
  unitPrice?: number;
  itemSubtotal?: number;
  deliveryFee?: number;
  orderTotal?: number;
  deliveryAddress?: string | null;
  deliveryLandmark?: string | null;
  deliveryContactPerson?: string | null;
  deliveryContactNumber?: string | null;
  deliveryNotes?: string | null;
  paymentMethod?: MarketplacePaymentMethod | string | null;
  paymentProofUrl?: string | null;
  paymentProofPublicId?: string | null;
  status: MarketplaceOrderItem["status"];
  createdAt: Date;
  updatedAt: Date;
};

function normalizeOptionalLineValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeListingPhotoUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeFulfillmentMethod(
  value: string | null | undefined,
): MarketplaceFulfillmentMethod {
  return value === "courier" ? "courier" : "pickup";
}

function normalizePaymentMethod(value: string | null | undefined): MarketplacePaymentMethod {
  if (value === "gcash" || value === "bank_transfer") return value;
  return "cash";
}

function normalizeListingPaymentMethods(value: string[] | null | undefined): MarketplacePaymentMethod[] {
  const methods = (value ?? []).filter((method): method is MarketplacePaymentMethod =>
    MARKETPLACE_PAYMENT_METHODS.includes(method as MarketplacePaymentMethod),
  );
  return methods.length > 0 ? methods : ["cash"];
}

function buildOrderDelivery(doc: OrderDoc): MarketplaceOrderDeliveryDetails | null {
  if (normalizeFulfillmentMethod(doc.fulfillmentMethod) !== "courier") return null;

  const deliveryAddress = doc.deliveryAddress?.trim() ?? "";
  if (!deliveryAddress) return null;

  return {
    deliveryAddress,
    landmark: doc.deliveryLandmark?.trim() ?? "",
    contactPerson: doc.deliveryContactPerson?.trim() ?? "",
    contactNumber: doc.deliveryContactNumber?.trim() ?? "",
    deliveryNotes: doc.deliveryNotes?.trim() ? doc.deliveryNotes.trim() : null,
  };
}

function serializeOrder(doc: OrderDoc): MarketplaceOrderItem {
  const lines = doc.lines.map((line) => ({
    size: normalizeOptionalLineValue(line.size ?? undefined),
    color: normalizeOptionalLineValue(line.color ?? undefined),
    quantity: line.quantity,
  }));
  const fulfillmentMethod = normalizeFulfillmentMethod(doc.fulfillmentMethod);
  const unitPrice = typeof doc.unitPrice === "number" ? doc.unitPrice : 0;
  const itemSubtotal =
    typeof doc.itemSubtotal === "number"
      ? doc.itemSubtotal
      : unitPrice * marketplaceOrderLineTotalQuantity(lines);
  const deliveryFee = typeof doc.deliveryFee === "number" ? doc.deliveryFee : 0;
  const orderTotal =
    typeof doc.orderTotal === "number" ? doc.orderTotal : itemSubtotal + deliveryFee;

  return {
    id: doc._id.toString(),
    listingId: doc.listingId.toString(),
    listingTitle: doc.listingTitle,
    listingPhotoUrl: normalizeListingPhotoUrl(doc.listingPhotoUrl),
    playerId: doc.playerId.toString(),
    playerName: doc.playerName,
    gameId: doc.gameId,
    lines,
    fulfillmentMethod,
    unitPrice,
    itemSubtotal,
    deliveryFee,
    orderTotal,
    delivery: buildOrderDelivery(doc),
    paymentMethod: normalizePaymentMethod(doc.paymentMethod),
    paymentProofUrl: normalizeListingPhotoUrl(doc.paymentProofUrl),
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export type SubmitMarketplaceOrderDeliveryInput = {
  deliveryAddress: string;
  landmark: string;
  contactPerson: string;
  contactNumber: string;
  deliveryNotes?: string;
};

export type SubmitMarketplaceOrderInput = {
  listingId: string;
  lines: Array<{
    size?: string;
    color?: string;
    quantity: number;
  }>;
  delivery?: SubmitMarketplaceOrderDeliveryInput;
  paymentMethod: MarketplacePaymentMethod;
};

export async function submitMarketplaceOrder(
  gameId: string,
  playerId: string,
  input: SubmitMarketplaceOrderInput,
  paymentProofFile?: File | null,
) {
  await connectToDatabase();
  await assertPlayerRegisteredForGame(gameId, playerId);

  const game = (await PickleGame.findOne({ gameId }).select("ownerId").lean()) as
    | { ownerId: { toString(): string } }
    | null;
  if (!game?.ownerId) {
    throw new Error("Game not found.");
  }

  const ownerId = game.ownerId.toString();
  const listing = await MarketplaceListing.findOne({
    _id: input.listingId,
    ownerId,
    isActive: { $ne: false },
    photoUrl: { $nin: ["", null] },
  })
    .select("title photoUrl price fulfillmentMethod deliveryFee deliveryFeeShoulderedByRecipient paymentMethods")
    .lean<{
      title: string;
      photoUrl?: string | null;
      price: number;
      fulfillmentMethod?: MarketplaceFulfillmentMethod | string | null;
      deliveryFee?: number | null;
      deliveryFeeShoulderedByRecipient?: boolean;
      paymentMethods?: string[] | null;
    }>();
  if (!listing) {
    throw new Error("Listing not found or no longer available.");
  }

  const listingPhotoUrl = listing.photoUrl?.trim() ?? "";
  if (!listingPhotoUrl) {
    throw new Error("Listing not found or no longer available.");
  }

  const fulfillmentMethod = normalizeFulfillmentMethod(listing.fulfillmentMethod);
  const listingPaymentMethods = normalizeListingPaymentMethods(listing.paymentMethods);
  const paymentMethod = normalizePaymentMethod(input.paymentMethod);

  if (!listingPaymentMethods.includes(paymentMethod)) {
    throw new Error("Selected payment option is not accepted for this listing.");
  }

  if (marketplacePaymentRequiresProof(paymentMethod)) {
    if (!paymentProofFile) {
      throw new Error("Upload proof of payment for GCash or bank transfer orders.");
    }
  }

  const deliveryFee =
    fulfillmentMethod === "courier" &&
    !listing.deliveryFeeShoulderedByRecipient &&
    typeof listing.deliveryFee === "number"
      ? listing.deliveryFee
      : 0;

  if (fulfillmentMethod === "courier") {
    if (!input.delivery) {
      throw new Error("Delivery details are required for courier orders.");
    }
    const { deliveryAddress, landmark, contactPerson, contactNumber } = input.delivery;
    if (
      !deliveryAddress.trim() ||
      !landmark.trim() ||
      !contactPerson.trim() ||
      !contactNumber.trim()
    ) {
      throw new Error("Complete all delivery details for courier orders.");
    }
  }

  const player = await Player.findById(playerId).select("firstName lastName").lean<{
    firstName: string;
    lastName?: string | null;
  }>();
  if (!player) {
    throw new Error("Player not found.");
  }

  const playerName = [player.firstName, player.lastName?.trim()].filter(Boolean).join(" ");
  const lines: MarketplaceOrderLine[] = input.lines.map((line) => ({
    size: normalizeOptionalLineValue(line.size),
    color: normalizeOptionalLineValue(line.color),
    quantity: line.quantity,
  }));
  const itemSubtotal = listing.price * marketplaceOrderLineTotalQuantity(lines);
  const orderTotal = itemSubtotal + deliveryFee;

  let paymentProofUrl = "";
  let paymentProofPublicId = "";
  if (paymentProofFile) {
    const uploaded = await uploadMarketplaceOrderPaymentProof(paymentProofFile, {
      gameId,
      playerId,
      listingId: input.listingId,
    });
    paymentProofUrl = uploaded.photoUrl;
    paymentProofPublicId = uploaded.photoPublicId;
  }

  const doc = await MarketplaceOrder.create({
    ownerId,
    listingId: input.listingId,
    playerId,
    gameId,
    listingTitle: listing.title,
    listingPhotoUrl,
    playerName,
    lines,
    fulfillmentMethod,
    unitPrice: listing.price,
    itemSubtotal,
    deliveryFee,
    orderTotal,
    deliveryAddress:
      fulfillmentMethod === "courier" ? input.delivery!.deliveryAddress.trim() : "",
    deliveryLandmark: fulfillmentMethod === "courier" ? input.delivery!.landmark.trim() : "",
    deliveryContactPerson:
      fulfillmentMethod === "courier" ? input.delivery!.contactPerson.trim() : "",
    deliveryContactNumber:
      fulfillmentMethod === "courier" ? input.delivery!.contactNumber.trim() : "",
    deliveryNotes:
      fulfillmentMethod === "courier" ? (input.delivery!.deliveryNotes?.trim() ?? "") : "",
    paymentMethod,
    paymentProofUrl,
    paymentProofPublicId,
    status: "pending",
  });

  return serializeOrder(doc.toObject() as OrderDoc);
}

export async function listPlayerMarketplaceOrders(gameId: string, playerId: string) {
  await connectToDatabase();
  await assertPlayerRegisteredForGame(gameId, playerId);

  const docs = (await MarketplaceOrder.find({ gameId, playerId })
    .sort({ createdAt: -1 })
    .lean()) as OrderDoc[];

  const missingPhotoListingIds = [
    ...new Set(
      docs
        .filter((doc) => !normalizeListingPhotoUrl(doc.listingPhotoUrl))
        .map((doc) => doc.listingId.toString()),
    ),
  ];

  const listingPhotoById = new Map<string, string>();
  if (missingPhotoListingIds.length > 0) {
    const listings = await MarketplaceListing.find({ _id: { $in: missingPhotoListingIds } })
      .select("photoUrl")
      .lean<Array<{ _id: { toString(): string }; photoUrl?: string | null }>>();
    for (const listing of listings) {
      const photoUrl = listing.photoUrl?.trim() ?? "";
      if (photoUrl) listingPhotoById.set(listing._id.toString(), photoUrl);
    }
  }

  return docs.map((doc) => {
    if (normalizeListingPhotoUrl(doc.listingPhotoUrl)) {
      return serializeOrder(doc);
    }
    const fallbackPhoto = listingPhotoById.get(doc.listingId.toString());
    return serializeOrder({
      ...doc,
      listingPhotoUrl: fallbackPhoto ?? doc.listingPhotoUrl,
    });
  });
}

export async function cancelPlayerMarketplaceOrder(
  gameId: string,
  playerId: string,
  orderId: string,
) {
  await connectToDatabase();
  await assertPlayerRegisteredForGame(gameId, playerId);

  const doc = await MarketplaceOrder.findOneAndUpdate(
    { _id: orderId, gameId, playerId, status: "pending" },
    { $set: { status: "cancelled" } },
    { returnDocument: "after" },
  ).lean();

  if (!doc) {
    throw new Error("Order not found or cannot be cancelled.");
  }

  return serializeOrder(doc as OrderDoc);
}

export async function listOwnerMarketplaceOrders(ownerId: string) {
  await connectToDatabase();

  const docs = (await MarketplaceOrder.find({ ownerId })
    .sort({ createdAt: -1 })
    .lean()) as OrderDoc[];

  return docs.map(serializeOrder);
}

export async function acknowledgeOwnerMarketplaceOrder(ownerId: string, orderId: string) {
  await connectToDatabase();

  const doc = await MarketplaceOrder.findOneAndUpdate(
    { _id: orderId, ownerId, status: "pending" },
    { $set: { status: "acknowledged" } },
    { returnDocument: "after" },
  ).lean();

  if (!doc) {
    throw new Error("Order not found or cannot be acknowledged.");
  }

  return serializeOrder(doc as OrderDoc);
}

export async function markForReleaseOwnerMarketplaceOrder(ownerId: string, orderId: string) {
  await connectToDatabase();

  const doc = await MarketplaceOrder.findOneAndUpdate(
    { _id: orderId, ownerId, status: "acknowledged" },
    { $set: { status: "for_release" } },
    { returnDocument: "after" },
  ).lean();

  if (!doc) {
    throw new Error("Order not found or cannot be marked for release.");
  }

  return serializeOrder(doc as OrderDoc);
}

export async function fulfillOwnerMarketplaceOrder(ownerId: string, orderId: string) {
  await connectToDatabase();

  const doc = await MarketplaceOrder.findOneAndUpdate(
    { _id: orderId, ownerId, status: { $in: ["acknowledged", "for_release"] } },
    { $set: { status: "fulfilled" } },
    { returnDocument: "after" },
  ).lean();

  if (!doc) {
    throw new Error("Order not found or cannot be marked fulfilled.");
  }

  return serializeOrder(doc as OrderDoc);
}
