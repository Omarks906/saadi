import { NextRequest, NextResponse } from "next/server";
import { createListing } from "@/lib/listings";

function checkAuth(req: NextRequest) {
  const authCookie = req.cookies.get("so_auth");
  return authCookie?.value === "1";
}

export async function HEAD(req: NextRequest) {
  if (!checkAuth(req)) return new NextResponse(null, { status: 401 });
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // Special: login page uses this to set cookie
    if (body?.__authOnly) {
      const res = NextResponse.json({ ok: true });
      res.cookies.set("so_auth", "1", { httpOnly: false, sameSite: "lax", path: "/" });
      return res;
    }

    const car = body.car ?? {};
    car.year = Number(car.year || 0);
    car.mileageKm = Number(car.mileageKm || 0);
    car.price = car.price === undefined ? undefined : Number(car.price);
    car.make = String(car.make || "");
    car.model = String(car.model || "");

    const listing = createListing(car);
    const res = NextResponse.json(listing);
    res.cookies.set("so_auth", "1", { httpOnly: false, sameSite: "lax", path: "/" });
    return res;
  } catch (error: any) {
    console.error("Error creating listing:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create listing" },
      { status: 500 }
    );
  }
}

