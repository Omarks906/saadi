import { NextResponse } from "next/server";
import { readListing, writeListing } from "@/lib/listings";
import { openai, buildAdPrompt, AdOut } from "@/lib/ad";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { listingId } = await req.json().catch(() => ({}));
    if (!listingId) {
      return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
    }

    let listing;
    try {
      listing = readListing(listingId);
    } catch (error) {
      console.error("Error reading listing:", error);
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const prompt = buildAdPrompt(listing.car);

    let resp;
    try {
      resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant that writes honest used-car ads. Always return valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });
    } catch (error: any) {
      console.error("OpenAI API error:", error);
      const errorMessage = error?.message || error?.error?.message || "Failed to generate ad";
      const errorCode = error?.status || error?.code || "UNKNOWN";
      return NextResponse.json(
        { 
          error: "OpenAI API error", 
          message: errorMessage,
          code: errorCode,
          details: error?.error || error
        },
        { status: 500 }
      );
    }

    const text = resp.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: "No response from OpenAI" }, { status: 500 });
    }

    let parsed: AdOut;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Raw text:", text);
      return NextResponse.json({ error: "Bad JSON from model", raw: text }, { status: 500 });
    }

    listing.ad = parsed;
    writeListing(listing);

    return NextResponse.json({ ok: true, ad: parsed });
  } catch (error: any) {
    console.error("Unexpected error in generate-ad:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error?.message || "Failed to generate ad" },
      { status: 500 }
    );
  }
}

