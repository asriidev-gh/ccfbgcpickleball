import mongoose, { Schema } from "mongoose";

const marketplaceListingSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    price: { type: Number, required: true, min: 0 },
    condition: { type: String, required: true, enum: ["New", "Used"] },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    productTag: { type: String, trim: true, maxlength: 40, default: null },
    itemType: { type: String, trim: true, maxlength: 40, default: null },
    itemSize: { type: String, trim: true, maxlength: 40, default: null },
    itemColor: { type: String, trim: true, maxlength: 40, default: null },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    fulfillmentMethod: {
      type: String,
      enum: ["pickup", "courier"],
      default: "pickup",
    },
    pickupLocation: { type: String, trim: true, maxlength: 200, default: "" },
    deliveryFee: { type: Number, min: 0, default: null },
    deliveryFeeShoulderedByRecipient: { type: Boolean, default: false },
    paymentMethods: {
      type: [String],
      enum: ["cash", "gcash", "bank_transfer"],
      default: ["cash"],
    },
    gcashName: { type: String, trim: true, maxlength: 120, default: "" },
    gcashNumber: { type: String, trim: true, maxlength: 11, default: "" },
    bankName: { type: String, trim: true, maxlength: 120, default: "" },
    bankAccountName: { type: String, trim: true, maxlength: 120, default: "" },
    bankAccountNumber: { type: String, trim: true, maxlength: 40, default: "" },
    photoUrl: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
    photoUrls: { type: [String], default: [] },
    photoPublicIds: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

marketplaceListingSchema.index({ ownerId: 1, createdAt: -1 });

if (mongoose.models.MarketplaceListing) {
  mongoose.deleteModel("MarketplaceListing");
}

export const MarketplaceListing = mongoose.model("MarketplaceListing", marketplaceListingSchema);
