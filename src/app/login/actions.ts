"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { setSessionOrgCookies } from "@/lib/auth-session";
import { getPool, initDatabase } from "@/lib/db/connection";

export async function loginAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const next = String(formData.get("next") || "/dashboard").trim();

  if (!orgSlug || !password) {
    redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  await initDatabase();
  const pool = getPool();
  const orgResult = await pool.query(
    "SELECT id, slug, password_hash FROM organizations WHERE slug = $1 LIMIT 1",
    [orgSlug]
  );

  if (orgResult.rows.length === 0) {
    redirect(
      `/login?error=invalid&next=${encodeURIComponent(next)}&orgSlug=${encodeURIComponent(
        orgSlug
      )}`
    );
  }

  const passwordHash = orgResult.rows[0]?.password_hash as string | null;
  if (!passwordHash) {
    redirect(
      `/login?error=unset&next=${encodeURIComponent(next)}&orgSlug=${encodeURIComponent(
        orgSlug
      )}`
    );
  }

  const matches = await bcrypt.compare(password, passwordHash);
  if (!matches) {
    redirect(
      `/login?error=invalid&next=${encodeURIComponent(next)}&orgSlug=${encodeURIComponent(
        orgSlug
      )}`
    );
  }

  await setSessionOrgCookies(orgSlug);

  let finalNext = next;
  if (finalNext.startsWith("/dashboard") && !finalNext.includes("orgSlug=")) {
    const sep = finalNext.includes("?") ? "&" : "?";
    finalNext = `${finalNext}${sep}orgSlug=${encodeURIComponent(orgSlug)}`;
  }

  redirect(finalNext);
}
