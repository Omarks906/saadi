import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readListing, writeListing } from "@/lib/listings";
import { originalsDir, processedDir } from "@/lib/paths";
import { requireAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest) {
  try {
    // 🔐 protect route
    const authErr = requireAuth(req);
    if (authErr) return authErr;

    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get("listingId");
    const filename = searchParams.get("filename");

    if (!listingId || !filename) {
      return NextResponse.json(
        { error: "listingId and filename are required" },
        { status: 400 }
      );
    }

    let listing;
    try {
      listing = readListing(listingId);
    } catch {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const photos = Array.isArray(listing.photos) ? listing.photos : [];
    const photoIndex = photos.findIndex((p) => p.filename === filename);

    if (photoIndex === -1) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const photo = photos[photoIndex];

    // Delete original file
    const originalFilePath = path.join(originalsDir(listingId), filename);
    if (fs.existsSync(originalFilePath)) {
      try {
        fs.unlinkSync(originalFilePath);
      } catch (err) {
        console.error(`Error deleting original file ${originalFilePath}:`, err);
      }
    }

    // Delete processed file if it exists
    if (photo.processedUrl) {
      const processedFilename = path.basename(photo.processedUrl);
      const processedFilePath = path.join(processedDir(listingId), processedFilename);
      if (fs.existsSync(processedFilePath)) {
        try {
          fs.unlinkSync(processedFilePath);
        } catch (err) {
          console.error(`Error deleting processed file ${processedFilePath}:`, err);
        }
      }
    }

    // Remove photo from listing
    photos.splice(photoIndex, 1);
    listing.photos = photos;
    writeListing(listing);

    return NextResponse.json({ ok: true, message: "Photo deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting photo:", error);
    return NextResponse.json(
      { error: "Failed to delete photo", details: error?.message },
      { status: 500 }
    );
  }
}

