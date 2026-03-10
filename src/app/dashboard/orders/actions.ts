"use server";

import { getAdminTokenForOrg } from "@/lib/admin-token";

export async function fetchNewOrderCount(orgSlug: string, since: string): Promise<number> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = getAdminTokenForOrg(orgSlug);
  if (!baseUrl || !adminToken) return 0;

  try {
    const url = new URL(`${baseUrl}/api/admin/orders`);
    url.searchParams.set("since", since);
    url.searchParams.set("orgSlug", orgSlug);
    url.searchParams.set("limit", "10");

    const res = await fetch(url.toString(), {
      headers: { "x-admin-token": adminToken },
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.orders || []).length;
  } catch {
    return 0;
  }
}
