import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readListing, writeListing } from "@/lib/listings";
import { originalsDir } from "@/lib/paths";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const listingId = String(form.get("listingId") || "");
  const files = form.getAll("files") as File[];

  if (!listingId || !files.length) {
    return NextResponse.json({ error: "Missing listingId or files" }, { status: 400 });
  }

  let listing;
  try {
    listing = readListing(listingId);
  } catch {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  listing.photos = photos;
  fs.mkdirSync(originalsDir(listingId), { recursive: true });

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = `${Date.now()}-${file.name}`.replace(/[^\w.\-]/g, "_");
    const dest = path.join(originalsDir(listingId), safeName);
    fs.writeFileSync(dest, buffer);

    listing.photos.push({
      filename: safeName,
      originalUrl: `/uploads/${listingId}/original/${safeName}`,
      status: "uploaded",
    });
  }

  writeListing(listing);
  return NextResponse.json(listing);
}

