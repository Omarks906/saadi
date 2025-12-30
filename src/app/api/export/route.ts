import { NextResponse } from "next/server";
import archiver from "archiver";
import { readListing } from "@/lib/listings";
import { processedDir } from "@/lib/paths";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });

  let listing;
  try {
    listing = readListing(listingId);
  } catch {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const dir = processedDir(listingId);

  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const files = photos
    .filter((p) => p.status === "processed" && p.processedUrl)
    .map((p) => path.join(dir, path.basename(p.processedUrl!)));

  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", `attachment; filename="listing-${listingId}-images.zip"`);

  const stream = new ReadableStream({
    start(controller) {
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      archive.on("end", () => controller.close());
      archive.on("error", (err: Error) => controller.error(err));

      for (const f of files) {
        if (fs.existsSync(f)) archive.file(f, { name: path.basename(f) });
      }

      archive.finalize();
    },
  });

  return new NextResponse(stream as any, { headers });
}

