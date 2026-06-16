import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  createMarketplaceListing,
  listMarketplaceListings,
} from "@/lib/marketplace-listings";
import { MAX_MARKETPLACE_LISTING_PHOTOS } from "@/lib/marketplace-listings-shared";
import { parseMarketplaceListingFormData } from "@/lib/parse-marketplace-listing-form";

export async function GET() {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const listings = await listMarketplaceListings(authUser.userId);
      return NextResponse.json({
        listings,
        photoUploadConfigured: isCloudinaryConfigured(),
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load listings." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const formData = await request.formData();
      const { parsed, photoFile, photoFiles, removePhoto, photoClientIds, photoOrder } =
        parseMarketplaceListingFormData(formData);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      if (!isCloudinaryConfigured()) {
        return NextResponse.json(
          { message: "Photo upload is required but is not configured on this server." },
          { status: 400 },
        );
      }

      const files = photoFiles.length > 0 ? photoFiles : photoFile ? [photoFile] : [];
      if (files.length === 0) {
        return NextResponse.json({ message: "A product photo is required." }, { status: 400 });
      }
      if (files.length > MAX_MARKETPLACE_LISTING_PHOTOS) {
        return NextResponse.json(
          { message: `You can upload up to ${MAX_MARKETPLACE_LISTING_PHOTOS} photos per listing.` },
          { status: 400 },
        );
      }

      const listing = await createMarketplaceListing(authUser.userId, parsed.data, {
        photoFiles: files,
        removePhoto,
        photoClientIds,
        photoOrder,
      });
      return NextResponse.json({ listing, message: "Listing created." });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create listing." },
      { status: 400 },
    );
  }
}
