import { connectToDatabase } from "@/lib/db";
import {
  deleteMarketplacePhotos,
  uploadMarketplaceListingPhoto,
} from "@/lib/marketplace-photo-upload";
import type {
  MarketplaceCondition,
  MarketplaceFulfillmentMethod,
  MarketplaceItemType,
  MarketplaceListingItem,
} from "@/lib/marketplace-listings-shared";
import type { MarketplacePaymentMethod } from "@/lib/marketplace-payment-shared";
import { MARKETPLACE_PAYMENT_METHODS } from "@/lib/marketplace-payment-shared";
import { MarketplaceListing } from "@/models/MarketplaceListing";
import { PickleGame } from "@/models/PickleGame";

type ListingDoc = {
  _id: { toString(): string };
  title: string;
  price: number;
  condition: MarketplaceCondition;
  description: string;
  productTag?: string | null;
  itemType?: string | null;
  itemSize?: string | null;
  itemColor?: string | null;
  location: string;
  fulfillmentMethod?: MarketplaceFulfillmentMethod | string | null;
  pickupLocation?: string | null;
  deliveryFee?: number | null;
  deliveryFeeShoulderedByRecipient?: boolean;
  paymentMethods?: string[] | null;
  gcashName?: string | null;
  gcashNumber?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeOptionalString(value: string | undefined | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeItemDetails(input: {
  itemType?: string;
  itemSize?: string;
  itemColor?: string;
}) {
  const itemType = normalizeOptionalString(input.itemType) as MarketplaceItemType | null;
  if (!itemType) {
    return { itemType: null, itemSize: null, itemColor: null };
  }
  return {
    itemType,
    itemSize: normalizeOptionalString(input.itemSize),
    itemColor: normalizeOptionalString(input.itemColor),
  };
}

function normalizeFulfillment(input: {
  fulfillmentMethod: MarketplaceFulfillmentMethod;
  pickupLocation?: string;
  deliveryFee?: number;
  deliveryFeeShoulderedByRecipient?: boolean;
}) {
  if (input.fulfillmentMethod === "courier") {
    const deliveryFeeShoulderedByRecipient = input.deliveryFeeShoulderedByRecipient === true;
    return {
      fulfillmentMethod: "courier" as const,
      pickupLocation: "",
      deliveryFee: deliveryFeeShoulderedByRecipient ? null : (input.deliveryFee ?? 0),
      deliveryFeeShoulderedByRecipient,
    };
  }

  return {
    fulfillmentMethod: "pickup" as const,
    pickupLocation: input.pickupLocation?.trim() ?? "",
    deliveryFee: null,
    deliveryFeeShoulderedByRecipient: false,
  };
}

function normalizePaymentMethods(value: string[] | null | undefined): MarketplacePaymentMethod[] {
  const methods = (value ?? []).filter((method): method is MarketplacePaymentMethod =>
    MARKETPLACE_PAYMENT_METHODS.includes(method as MarketplacePaymentMethod),
  );
  return methods.length > 0 ? methods : ["cash"];
}

function normalizePayment(input: {
  paymentMethods: MarketplacePaymentMethod[];
  gcashName?: string;
  gcashNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
}) {
  const paymentMethods = normalizePaymentMethods(input.paymentMethods);
  const includesGcash = paymentMethods.includes("gcash");
  const includesBank = paymentMethods.includes("bank_transfer");

  return {
    paymentMethods,
    gcashName: includesGcash ? (input.gcashName?.trim() ?? "") : "",
    gcashNumber: includesGcash ? (input.gcashNumber?.trim() ?? "") : "",
    bankName: includesBank ? (input.bankName?.trim() ?? "") : "",
    bankAccountName: includesBank ? (input.bankAccountName?.trim() ?? "") : "",
    bankAccountNumber: includesBank ? (input.bankAccountNumber?.trim() ?? "") : "",
  };
}

function serializeListing(doc: ListingDoc): MarketplaceListingItem {
  const productTag = doc.productTag?.trim();
  const photoUrl = doc.photoUrl?.trim();
  const itemType = normalizeOptionalString(doc.itemType) as MarketplaceItemType | null;
  const fulfillmentMethod =
    doc.fulfillmentMethod === "courier" ? "courier" : ("pickup" as MarketplaceFulfillmentMethod);
  const pickupLocation = normalizeOptionalString(doc.pickupLocation);
  const deliveryFee =
    fulfillmentMethod === "courier" &&
    !doc.deliveryFeeShoulderedByRecipient &&
    typeof doc.deliveryFee === "number"
      ? doc.deliveryFee
      : null;
  const paymentMethods = normalizePaymentMethods(doc.paymentMethods);

  return {
    id: doc._id.toString(),
    title: doc.title,
    price: doc.price,
    condition: doc.condition,
    description: doc.description,
    productTag: productTag ? productTag : null,
    itemType,
    itemSize: itemType ? normalizeOptionalString(doc.itemSize) : null,
    itemColor: itemType ? normalizeOptionalString(doc.itemColor) : null,
    location: doc.location,
    fulfillmentMethod,
    pickupLocation,
    deliveryFee,
    deliveryFeeShoulderedByRecipient: doc.deliveryFeeShoulderedByRecipient === true,
    paymentMethods,
    gcashName: paymentMethods.includes("gcash") ? normalizeOptionalString(doc.gcashName) : null,
    gcashNumber: paymentMethods.includes("gcash") ? normalizeOptionalString(doc.gcashNumber) : null,
    bankName: paymentMethods.includes("bank_transfer") ? normalizeOptionalString(doc.bankName) : null,
    bankAccountName: paymentMethods.includes("bank_transfer")
      ? normalizeOptionalString(doc.bankAccountName)
      : null,
    bankAccountNumber: paymentMethods.includes("bank_transfer")
      ? normalizeOptionalString(doc.bankAccountNumber)
      : null,
    photoUrl: photoUrl ? photoUrl : null,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export type MarketplaceListingInput = {
  title: string;
  price: number;
  condition: MarketplaceCondition;
  description: string;
  productTag?: string;
  itemType?: string;
  itemSize?: string;
  itemColor?: string;
  location: string;
  fulfillmentMethod: MarketplaceFulfillmentMethod;
  pickupLocation?: string;
  deliveryFee?: number;
  deliveryFeeShoulderedByRecipient?: boolean;
  paymentMethods: MarketplacePaymentMethod[];
  gcashName?: string;
  gcashNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  isActive?: boolean;
};

export type MarketplaceListingPhotoInput = {
  photoFile?: File | null;
  removePhoto?: boolean;
};

function normalizeProductTag(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

async function applyListingPhotoUpdate(
  ownerId: string,
  listingId: string,
  existing: { photoUrl?: string | null; photoPublicId?: string | null } | null,
  photo?: MarketplaceListingPhotoInput,
) {
  if (!photo) {
    return {
      photoUrl: existing?.photoUrl?.trim() ?? "",
      photoPublicId: existing?.photoPublicId?.trim() ?? "",
    };
  }

  if (photo.removePhoto) {
    const publicId = existing?.photoPublicId?.trim();
    if (publicId) await deleteMarketplacePhotos([publicId]);
    return { photoUrl: "", photoPublicId: "" };
  }

  if (photo.photoFile) {
    const uploaded = await uploadMarketplaceListingPhoto(photo.photoFile, {
      userId: ownerId,
      listingId,
    });
    const publicId = existing?.photoPublicId?.trim();
    if (publicId) await deleteMarketplacePhotos([publicId]);
    return uploaded;
  }

  return {
    photoUrl: existing?.photoUrl?.trim() ?? "",
    photoPublicId: existing?.photoPublicId?.trim() ?? "",
  };
}

export async function listMarketplaceListings(ownerId: string) {
  await connectToDatabase();
  const docs = (await MarketplaceListing.find({ ownerId })
    .sort({ createdAt: -1 })
    .lean()) as ListingDoc[];
  return docs.map(serializeListing);
}

export async function listActiveMarketplaceListingsForGame(gameId: string) {
  await connectToDatabase();
  const game = (await PickleGame.findOne({ gameId }).select("ownerId").lean()) as
    | { ownerId: { toString(): string } }
    | null;
  if (!game?.ownerId) return null;

  const ownerId = game.ownerId.toString();
  const docs = (await MarketplaceListing.find({
    ownerId,
    isActive: { $ne: false },
    photoUrl: { $nin: ["", null] },
  })
    .sort({ createdAt: -1 })
    .lean()) as ListingDoc[];
  return docs.map(serializeListing);
}

export async function createMarketplaceListing(
  ownerId: string,
  input: MarketplaceListingInput,
  photo?: MarketplaceListingPhotoInput,
) {
  await connectToDatabase();
  if (!photo?.photoFile) {
    throw new Error("A product photo is required.");
  }

  const itemDetails = normalizeItemDetails(input);
  const fulfillment = normalizeFulfillment(input);
  const payment = normalizePayment(input);
  const doc = await MarketplaceListing.create({
    ownerId,
    title: input.title,
    price: input.price,
    condition: input.condition,
    description: input.description,
    productTag: normalizeProductTag(input.productTag),
    itemType: itemDetails.itemType,
    itemSize: itemDetails.itemSize,
    itemColor: itemDetails.itemColor,
    location: input.location,
    fulfillmentMethod: fulfillment.fulfillmentMethod,
    pickupLocation: fulfillment.pickupLocation,
    deliveryFee: fulfillment.deliveryFee,
    deliveryFeeShoulderedByRecipient: fulfillment.deliveryFeeShoulderedByRecipient,
    paymentMethods: payment.paymentMethods,
    gcashName: payment.gcashName,
    gcashNumber: payment.gcashNumber,
    bankName: payment.bankName,
    bankAccountName: payment.bankAccountName,
    bankAccountNumber: payment.bankAccountNumber,
    isActive: input.isActive !== false,
    photoUrl: "",
    photoPublicId: "",
  });

  const listingId = doc._id.toString();
  const photoFields = await applyListingPhotoUpdate(ownerId, listingId, null, photo);
  if (!photoFields.photoUrl?.trim()) {
    await MarketplaceListing.deleteOne({ _id: listingId });
    throw new Error("A product photo is required.");
  }

  doc.photoUrl = photoFields.photoUrl;
  doc.photoPublicId = photoFields.photoPublicId;
  await doc.save();

  return serializeListing(doc.toObject() as ListingDoc);
}

export async function updateMarketplaceListing(
  ownerId: string,
  listingId: string,
  input: Partial<MarketplaceListingInput>,
  photo?: MarketplaceListingPhotoInput,
) {
  await connectToDatabase();
  const existing = (await MarketplaceListing.findOne({ _id: listingId, ownerId }).lean()) as
    | ListingDoc
    | null;
  if (!existing) return null;

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.price !== undefined) update.price = input.price;
  if (input.condition !== undefined) update.condition = input.condition;
  if (input.description !== undefined) update.description = input.description;
  if (input.location !== undefined) update.location = input.location;
  if (input.fulfillmentMethod !== undefined) {
    const fulfillment = normalizeFulfillment({
      fulfillmentMethod: input.fulfillmentMethod,
      pickupLocation: input.pickupLocation,
      deliveryFee: input.deliveryFee,
      deliveryFeeShoulderedByRecipient: input.deliveryFeeShoulderedByRecipient,
    });
    update.fulfillmentMethod = fulfillment.fulfillmentMethod;
    update.pickupLocation = fulfillment.pickupLocation;
    update.deliveryFee = fulfillment.deliveryFee;
    update.deliveryFeeShoulderedByRecipient = fulfillment.deliveryFeeShoulderedByRecipient;
  }
  if (
    input.paymentMethods !== undefined ||
    input.gcashName !== undefined ||
    input.gcashNumber !== undefined ||
    input.bankName !== undefined ||
    input.bankAccountName !== undefined ||
    input.bankAccountNumber !== undefined
  ) {
    const payment = normalizePayment({
      paymentMethods: input.paymentMethods ?? normalizePaymentMethods(existing.paymentMethods),
      gcashName: input.gcashName ?? existing.gcashName ?? "",
      gcashNumber: input.gcashNumber ?? existing.gcashNumber ?? "",
      bankName: input.bankName ?? existing.bankName ?? "",
      bankAccountName: input.bankAccountName ?? existing.bankAccountName ?? "",
      bankAccountNumber: input.bankAccountNumber ?? existing.bankAccountNumber ?? "",
    });
    update.paymentMethods = payment.paymentMethods;
    update.gcashName = payment.gcashName;
    update.gcashNumber = payment.gcashNumber;
    update.bankName = payment.bankName;
    update.bankAccountName = payment.bankAccountName;
    update.bankAccountNumber = payment.bankAccountNumber;
  }
  if (input.isActive !== undefined) update.isActive = input.isActive;
  if (input.productTag !== undefined) update.productTag = normalizeProductTag(input.productTag);
  if (
    input.itemType !== undefined ||
    input.itemSize !== undefined ||
    input.itemColor !== undefined
  ) {
    const itemDetails = normalizeItemDetails({
      itemType: input.itemType ?? "",
      itemSize: input.itemSize ?? "",
      itemColor: input.itemColor ?? "",
    });
    update.itemType = itemDetails.itemType;
    update.itemSize = itemDetails.itemSize;
    update.itemColor = itemDetails.itemColor;
  }

  if (photo) {
    const photoFields = await applyListingPhotoUpdate(ownerId, listingId, existing, photo);
    update.photoUrl = photoFields.photoUrl;
    update.photoPublicId = photoFields.photoPublicId;
  }

  const finalPhotoUrl =
    typeof update.photoUrl === "string"
      ? update.photoUrl
      : (existing.photoUrl?.trim() ?? "");
  if (!finalPhotoUrl) {
    throw new Error("A product photo is required.");
  }

  const doc = await MarketplaceListing.findOneAndUpdate(
    { _id: listingId, ownerId },
    { $set: update },
    { returnDocument: "after" },
  ).lean();

  if (!doc) return null;
  return serializeListing(doc as ListingDoc);
}

export async function deleteMarketplaceListing(ownerId: string, listingId: string) {
  await connectToDatabase();
  const existing = (await MarketplaceListing.findOne({ _id: listingId, ownerId })
    .select("photoPublicId")
    .lean()) as { photoPublicId?: string | null } | null;
  if (!existing) return false;

  const result = await MarketplaceListing.deleteOne({ _id: listingId, ownerId });
  if (result.deletedCount > 0) {
    const publicId = existing.photoPublicId?.trim();
    if (publicId) await deleteMarketplacePhotos([publicId]);
  }
  return result.deletedCount > 0;
}
