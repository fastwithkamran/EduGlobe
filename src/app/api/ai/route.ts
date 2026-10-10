// POST /api/ai — server-side Gemini endpoint, open to guests and signed-in users.

import { type NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import {
  generateAIStream,
  type ChatMessage,
  AI_ERROR_MARKERS,
} from "@/lib/gemini";

// node:net needs the Node runtime; maxDuration keeps long streams from being killed at the default limit.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Urdu/Arabic text is 2–3 bytes per char, so 10 history messages can exceed the old 32 KB cap.
const MAX_BODY_BYTES = 128 * 1024;
const MAX_MESSAGE_CHARS = 1_000;
const MAX_HISTORY_MSGS = 10;
const MAX_HISTORY_MESSAGE_CHARS = 4_000;
const MAX_HISTORY_TOTAL_CHARS = 12_000;

const RATE_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 10;
// Requests whose IP can't be determined share one bucket — keep it generous so
// a proxy quirk doesn't lock every user out after 10 requests in total.
const UNKNOWN_IP_RATE_LIMIT = RATE_LIMIT * 20;
const RATE_WINDOW_MS = 24 * 60 * 60_000;
const RATE_WINDOW_SEC = RATE_WINDOW_MS / 1_000;
const MAX_RATE_LIMIT_ENTRIES = 10_000;

const INTERRUPTED_MESSAGE = "[The response was interrupted. Please try again.]";

// ────────────────────────────────────────────────────────────────────────────
// Client IP
// ────────────────────────────────────────────────────────────────────────────

function normalizeIp(raw: string): string {
  let ip = raw.trim();
  // "[::1]:1234" -> "::1", "1.2.3.4:5678" -> "1.2.3.4"
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip))
    ip = ip.replace(/:\d+$/, "");

  const version = isIP(ip);
  if (version === 0) return "unknown";
  if (version === 4) return ip;

  // IPv4-mapped IPv6 (::ffff:1.2.3.4)
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];

  // Devices usually get a whole /64, so key on the prefix; otherwise rotating
  // the interface id bypasses the limit.
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = ip.includes("::")
    ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t]
    : h;
  return (
    full
      .slice(0, 4)
      .map((group) => group.toLowerCase().replace(/^0+(?=.)/, ""))
      .join(":") + "::/64"
  );
}

function getClientIp(req: NextRequest): string {
  // Prefer Vercel's platform header; otherwise use the reverse proxy's forwarded IP.
  const forwardedIp =
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip");

  return normalizeIp(forwardedIp?.split(",")[0] ?? "");
}

// ────────────────────────────────────────────────────────────────────────────
// Rate limiting
//
// A plain in-memory Map is per serverless instance, so on Vercel the limit is
// effectively unenforced (every cold start / parallel instance has its own
// counters). If UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set we
// use Redis; otherwise (or if Redis is unreachable) we fall back to memory.
// ────────────────────────────────────────────────────────────────────────────

type RateResult = { limited: boolean; retryAfter: number };

const memoryLimits = new Map<string, { count: number; reset: number }>();

function memoryConsume(key: string, max: number): RateResult {
  const now = Date.now();
  const entry = memoryLimits.get(key);

  if (entry && now < entry.reset) {
    if (entry.count >= max) {
      return {
        limited: true,
        retryAfter: Math.max(1, Math.ceil((entry.reset - now) / 1_000)),
      };
    }
    entry.count++;
    return { limited: false, retryAfter: 0 };
  }

  if (memoryLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
    for (const [k, v] of memoryLimits) {
      if (now >= v.reset) memoryLimits.delete(k);
    }
    if (memoryLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
      return { limited: true, retryAfter: 60 };
    }
  }

  memoryLimits.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
  return { limited: false, retryAfter: 0 };
}

function memoryRefund(key: string) {
  const entry = memoryLimits.get(key);
  if (entry && entry.count > 0) entry.count--;
}

async function redisPipeline(
  commands: (string | number)[][],
): Promise<unknown[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(data) || data.some((d) => d.error)) return null;
    return data.map((d) => d.result);
  } catch {
    return null;
  }
}

const redisKey = (key: string) => `opportune:ai:${key}`;

async function consumeRateLimit(key: string, max: number): Promise<RateResult> {
  const rk = redisKey(key);
  const result = await redisPipeline([
    ["INCR", rk],
    ["EXPIRE", rk, RATE_WINDOW_SEC, "NX"],
    ["TTL", rk],
  ]);

  if (result) {
    const count = Number(result[0]);
    const ttl = Number(result[2]);
    if (count > max) {
      void redisPipeline([["DECR", rk]]); // rejected calls shouldn't pile up
      return { limited: true, retryAfter: ttl > 0 ? ttl : RATE_WINDOW_SEC };
    }
    return { limited: false, retryAfter: 0 };
  }

  return memoryConsume(key, max);
}

/** Give the user their request back when the failure was ours, not theirs. */
async function refundRateLimit(key: string) {
  const result = await redisPipeline([["DECR", redisKey(key)]]);
  if (!result) memoryRefund(key);
}

// ────────────────────────────────────────────────────────────────────────────
// Request parsing
// ────────────────────────────────────────────────────────────────────────────

/** Browsers always send Origin on cross-site POSTs; block other sites burning our Gemini quota. */
function isCrossSiteRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false; // same-origin GET-less fetches / non-browser clients
  const host = (
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    ""
  )
    .split(",")[0]
    .trim();
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

async function readBoundedBody(req: NextRequest): Promise<string | null> {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return null;
  }

  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

function isErrorContent(content: string): boolean {
  return (
    content.includes(INTERRUPTED_MESSAGE) ||
    AI_ERROR_MARKERS.some((marker) => content.includes(marker))
  );
}

/**
 * Make history safe for Gemini: it must start with a user turn, strictly
 * alternate, and end with an assistant turn (the new user message follows).
 * Old behaviour could send consecutive user turns after dropping an error
 * reply, or start with an assistant turn after slicing to the last N.
 */
function normalizeHistory(entries: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const entry of entries) {
    const last = out[out.length - 1];
    if (last && last.role === entry.role) out[out.length - 1] = entry;
    else out.push(entry);
  }

  while (out.length && out[0].role !== "user") out.shift();
  while (out.length && out[out.length - 1].role !== "assistant") out.pop();

  // Over budget: drop the oldest full exchanges instead of rejecting the request.
  let total = out.reduce((sum, m) => sum + m.content.length, 0);
  while (out.length && total > MAX_HISTORY_TOTAL_CHARS) {
    total -= out.shift()!.content.length;
    while (out.length && out[0].role !== "user") {
      total -= out.shift()!.content.length;
    }
  }

  return out;
}

function parseRequestBody(rawBody: string): {
  message: string;
  history: ChatMessage[];
} | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }

  const requestBody = body as Record<string, unknown>;
  const rawMessage = requestBody.message;
  const rawHistory = requestBody.history;

  if (typeof rawMessage !== "string") return null;
  const message = rawMessage.trim();
  if (!message || message.length > MAX_MESSAGE_CHARS) return null;
  if (rawHistory !== undefined && !Array.isArray(rawHistory)) return null;

  const cleaned: ChatMessage[] = [];
  for (const item of (rawHistory ?? []).slice(-MAX_HISTORY_MSGS)) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return null;
    }

    const entry = item as Record<string, unknown>;
    if (
      (entry.role !== "user" && entry.role !== "assistant") ||
      typeof entry.content !== "string"
    ) {
      return null;
    }

    const content = entry.content.trim();
    if (!content) continue;

    if (isErrorContent(content)) {
      // Drop the failed reply AND the question it was answering, otherwise the
      // next turn would contain two user messages in a row.
      if (cleaned[cleaned.length - 1]?.role === "user") cleaned.pop();
      continue;
    }

    // A single long Gemini answer used to make every later request fail with 400.
    cleaned.push({
      role: entry.role,
      content:
        content.length > MAX_HISTORY_MESSAGE_CHARS
          ? `${content.slice(0, MAX_HISTORY_MESSAGE_CHARS)}…`
          : content,
    });
  }

  return { message, history: normalizeHistory(cleaned) };
}

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let rawBody: string | null;
  try {
    rawBody = await readBoundedBody(req);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (rawBody === null) {
    return NextResponse.json(
      {
        error: `Request body is too large. Maximum size is ${MAX_BODY_BYTES} bytes.`,
      },
      { status: 413 },
    );
  }

  const body = parseRequestBody(rawBody);
  if (!body) {
    return NextResponse.json(
      {
        error:
          "Invalid request. Provide a message of up to 1,000 characters and valid conversation history.",
      },
      { status: 400 },
    );
  }

  const ip = getClientIp(req);
  const limit = await consumeRateLimit(
    ip,
    ip === "unknown" ? UNKNOWN_IP_RATE_LIMIT : RATE_LIMIT,
  );
  if (limit.limited) {
    return NextResponse.json(
      {
        error:
          "Daily AI request limit reached. Please try again after the limit resets.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      },
    );
  }

  // Peek at the first chunk BEFORE committing to a 200 response, so a failed
  // upstream call returns a real error status (and refunds the user's quota)
  // instead of a "successful" response containing an error sentence.
  const iterator = generateAIStream(body.message, body.history, req.signal)[
    Symbol.asyncIterator
  ]();

  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (err) {
    if (!req.signal.aborted) console.error("/api/ai upstream error:", err);
    await refundRateLimit(ip);
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json(
      { error: "The AI service is unavailable right now. Please try again." },
      { status: 502 },
    );
  }

  if (first.done) {
    await refundRateLimit(ip);
    return NextResponse.json(
      { error: "The AI returned an empty response. Please try again." },
      { status: 502 },
    );
  }

  const firstChunk: string = first.value;
  if (AI_ERROR_MARKERS.some((marker) => firstChunk.includes(marker))) {
    await refundRateLimit(ip);
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  const closeUpstream = () => {
    Promise.resolve(iterator.return?.(undefined)).catch(() => {});
  };

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(firstChunk));
        while (!cancelled) {
          const next = await iterator.next();
          if (next.done || cancelled) break;
          controller.enqueue(encoder.encode(next.value));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("/api/ai stream error:", err);
          try {
            controller.enqueue(encoder.encode(`\n\n${INTERRUPTED_MESSAGE}`));
          } catch {
            // controller already closed
          }
        }
      } finally {
        if (cancelled) {
          closeUpstream();
        } else {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
    cancel() {
      cancelled = true;
      closeUpstream();
    },
  });

  return new Response(readable, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}
