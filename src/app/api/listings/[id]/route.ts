import { NextResponse } from "next/server";
import { readListing, writeListing } from "@/lib/listings";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const listing = readListing(resolvedParams.id);
    return NextResponse.json(listing);
  } catch (error) {
    console.error("Error reading listing:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const patch = await req.json();
    let listing;
    try {
      listing = readListing(resolvedParams.id);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = { ...listing, ...patch };
    writeListing(updated);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating listing:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

