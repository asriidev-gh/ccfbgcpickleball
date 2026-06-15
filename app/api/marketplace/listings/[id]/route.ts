import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  deleteMarketplaceListing,
  updateMarketplaceListing,
} from "@/lib/marketplace-listings";
import { parseMarketplaceListingFormData } from "@/lib/parse-marketplace-listing-form";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const formData = await request.formData();
      const { parsed, photoFile, removePhoto } = parseMarketplaceListingFormData(formData);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      if (photoFile && !isCloudinaryConfigured()) {
        return NextResponse.json(
          { message: "Photo upload is not configured on this server." },
          { status: 400 },
        );
      }

      const listing = await updateMarketplaceListing(authUser.userId, id, parsed.data, {
        photoFile,
        removePhoto,
      });
      if (!listing) {
        return NextResponse.json({ message: "Listing not found." }, { status: 404 });
      }

      return NextResponse.json({ listing, message: "Listing updated." });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update listing." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const deleted = await deleteMarketplaceListing(authUser.userId, id);
      if (!deleted) {
        return NextResponse.json({ message: "Listing not found." }, { status: 404 });
      }

      return NextResponse.json({ message: "Listing deleted." });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete listing." },
      { status: 400 },
    );
  }
}
