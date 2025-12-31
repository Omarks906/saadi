import fs from "fs";
import crypto from "crypto";
import { ensureDirs, listingPath, originalsDir, processedDir } from "./paths";

export type Listing = {
  id: string;
  createdAt: string;
  car: {
    make: string;
    model: string;
    year: number;
    mileageKm: number;
    transmission?: string;
    fuel?: string;
    price?: number;
    notes?: string;
    features?: string[];
    exteriorColor?: string;
    interiorColor?: string;
    trim?: string;
    fwd?: boolean;
    condition?: string;
  };
  photos: Array<{
    filename: string;
    originalUrl: string;
    processedUrl?: string;
    status: "uploaded" | "processing" | "processed" | "failed";
  }>;
  ad?: {
    headline: string;
    short: string;
    body: string;
    bulletPoints: string[];
  } | null;
};

export function createListing(car: Listing["car"]): Listing {
  ensureDirs();
  const id = crypto.randomBytes(8).toString("hex");
  const listing: Listing = {
    id,
    createdAt: new Date().toISOString(),
    car,
    photos: [],
    ad: null,
  };
  fs.mkdirSync(originalsDir(id), { recursive: true });
  fs.mkdirSync(processedDir(id), { recursive: true });
  fs.writeFileSync(listingPath(id), JSON.stringify(listing, null, 2), "utf-8");
  return listing;
}

export function readListing(id: string): Listing {
  const raw = fs.readFileSync(listingPath(id), "utf-8");
  return JSON.parse(raw) as Listing;
}

export function writeListing(listing: Listing) {
  fs.writeFileSync(listingPath(listing.id), JSON.stringify(listing, null, 2), "utf-8");
}

