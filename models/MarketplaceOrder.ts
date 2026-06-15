import mongoose, { Schema } from "mongoose";

import {
  MAX_MARKETPLACE_ITEM_COLOR_LENGTH,
  MAX_MARKETPLACE_ITEM_SIZE_LENGTH,
} from "@/lib/marketplace-listings-shared";
import { MAX_MARKETPLACE_ORDER_QUANTITY } from "@/lib/marketplace-orders-shared";

const marketplaceOrderLineSchema = new Schema(
  {
    size: { type: String, trim: true, maxlength: MAX_MARKETPLACE_ITEM_SIZE_LENGTH, default: "" },
    color: { type: String, trim: true, maxlength: MAX_MARKETPLACE_ITEM_COLOR_LENGTH, default: "" },
    quantity: { type: Number, required: true, min: 1, max: MAX_MARKETPLACE_ORDER_QUANTITY },
  },
  { _id: false },
);

const marketplaceOrderSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    listingId: { type: Schema.Types.ObjectId, ref: "MarketplaceListing", required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    gameId: { type: String, required: true, trim: true, index: true },
    listingTitle: { type: String, required: true, trim: true, maxlength: 120 },
    listingPhotoUrl: { type: String, trim: true, default: "" },
    playerName: { type: String, required: true, trim: true, maxlength: 120 },
    lines: { type: [marketplaceOrderLineSchema], required: true },
    fulfillmentMethod: {
      type: String,
      enum: ["pickup", "courier"],
      default: "pickup",
    },
    unitPrice: { type: Number, required: true, min: 0 },
    itemSubtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    orderTotal: { type: Number, required: true, min: 0 },
    deliveryAddress: { type: String, trim: true, maxlength: 300, default: "" },
    deliveryLandmark: { type: String, trim: true, maxlength: 200, default: "" },
    deliveryContactPerson: { type: String, trim: true, maxlength: 120, default: "" },
    deliveryContactNumber: { type: String, trim: true, maxlength: 40, default: "" },
    deliveryNotes: { type: String, trim: true, maxlength: 300, default: "" },
    paymentMethod: {
      type: String,
      enum: ["cash", "gcash", "bank_transfer"],
      default: "cash",
    },
    paymentProofUrl: { type: String, trim: true, default: "" },
    paymentProofPublicId: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "acknowledged", "for_release", "fulfilled", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

marketplaceOrderSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
marketplaceOrderSchema.index({ listingId: 1, createdAt: -1 });
marketplaceOrderSchema.index({ playerId: 1, gameId: 1, createdAt: -1 });

if (mongoose.models.MarketplaceOrder) {
  mongoose.deleteModel("MarketplaceOrder");
}

export const MarketplaceOrder = mongoose.model("MarketplaceOrder", marketplaceOrderSchema);
