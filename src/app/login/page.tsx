"use client";

import { useState } from "react";

export default function LoginPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });

    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;
    } else {
      setErr("Wrong password.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">SolutionOps Demo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter password to continue.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button className="w-full rounded-xl bg-black text-white p-3">
            Enter
          </button>
        </form>
      </div>
    </main>
  );
}

