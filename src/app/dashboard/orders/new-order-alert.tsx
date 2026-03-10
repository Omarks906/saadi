"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchNewOrderCount } from "./actions";

function playOrderAlert() {
  try {
    const ctx = new AudioContext();
    // Two ascending "ding" tones
    const tones = [
      { freq: 880, delay: 0 },
      { freq: 1100, delay: 0.25 },
      { freq: 1320, delay: 0.5 },
    ];
    for (const { freq, delay } of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.6, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.5);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.5);
    }
  } catch {
    // AudioContext not available (e.g. SSR or sandboxed)
  }
}

export function NewOrderAlert({
  orgSlug,
  initialLatest,
}: {
  orgSlug: string;
  initialLatest: string;
}) {
  const router = useRouter();
  const lastSeenRef = useRef(initialLatest);

  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await fetchNewOrderCount(orgSlug, lastSeenRef.current);
      if (count > 0) {
        lastSeenRef.current = new Date().toISOString();
        playOrderAlert();
        router.refresh();
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [orgSlug, router]);

  return null;
}
