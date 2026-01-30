export const dynamic = "force-dynamic";
export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; error?: string; orgSlug?: string };
}) {
  const rawNext = searchParams?.next || "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";
  const error = searchParams?.error;
  const orgSlug = searchParams?.orgSlug || "";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border p-6">
        <h1 className="text-2xl font-bold mb-4">Dashboard Login</h1>

        <form action="/api/login" method="POST" className="space-y-3">
          <input type="hidden" name="next" value={next} />

          {error && (
            <div className="text-sm text-red-600">
              {error === "missing"
                ? "Missing org slug or password."
                : error === "unset"
                ? "Password not set for this org."
                : "Invalid org or password."}
            </div>
          )}

          <div>
            <label className="text-sm">Org slug</label>
            <input
              name="orgSlug"
              placeholder="chilli"
              className="w-full border rounded px-3 py-2"
              defaultValue={orgSlug}
              required
            />
          </div>

          <div>
            <label className="text-sm">Password</label>
            <input
              name="password"
              type="password"
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <button className="w-full rounded bg-black text-white py-2">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

