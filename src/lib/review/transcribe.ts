import OpenAI from "openai";

let openaiClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export type TranscribeOptions = {
  /** Prefer smaller files; if Content-Length exceeds this, caller should fallback to another URL. */
  maxBytes?: number;
  /** Request timeout for fetch (ms). */
  timeoutMs?: number;
  /** Force language if known (e.g. 'sv'). */
  language?: string;
};

async function headContentLength(url: string, timeoutMs: number): Promise<number | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ac.signal });
    if (!res.ok) return null;
    const len = res.headers.get("content-length");
    return len ? Number(len) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchBuffer(url: string, timeoutMs: number): Promise<{ buffer: Buffer; contentType?: string | null }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) {
      throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`);
    }
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    return { buffer, contentType: res.headers.get("content-type") };
  } finally {
    clearTimeout(t);
  }
}

function guessExtension(contentType?: string | null): string {
  if (!contentType) return "mp3";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("mp4")) return "m4a";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("ogg")) return "ogg";
  return "mp3";
}

export async function transcribeAudioUrl(url: string, opts: TranscribeOptions = {}): Promise<{ transcript: string; bytes: number }> {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const maxBytes = opts.maxBytes ?? 25 * 1024 * 1024; // 25MB default

  const len = await headContentLength(url, timeoutMs);
  if (len != null && len > maxBytes) {
    throw new Error(`Audio too large (${len} bytes) > maxBytes (${maxBytes}).`);
  }

  const { buffer, contentType } = await fetchBuffer(url, timeoutMs);
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Audio too large after download (${buffer.byteLength} bytes) > maxBytes (${maxBytes}).`);
  }

  const ext = guessExtension(contentType);
  // Next.js/TS can be picky about Buffer being a BlobPart; wrap as Uint8Array.
  const file = new File([new Uint8Array(buffer)], `call.${ext}`);

  const client = getClient();
  // Prefer newer transcription models when available; fall back safely.
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

  const res = await client.audio.transcriptions.create({
    model,
    file,
    language: opts.language,
  });

  // SDK returns { text } (typings vary by version)
  const text: string | undefined = (res as any).text;
  if (!text || !text.trim()) throw new Error("Empty transcription result");

  return { transcript: text.trim(), bytes: buffer.byteLength };
}
