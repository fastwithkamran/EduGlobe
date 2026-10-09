// POST /api/ai — server-side Gemini endpoint, open to guests and signed-in users.

import { type NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { generateAIStream, type ChatMessage, AI_ERROR_MARKERS } from "@/lib/gemini";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGE_CHARS = 1_000;
const MAX_HISTORY_MSGS = 10;
const MAX_HISTORY_MESSAGE_CHARS = 4_000;
const MAX_HISTORY_TOTAL_CHARS = 12_000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 24 * 60 * 60_000;
const MAX_RATE_LIMIT_ENTRIES = 10_000;

const rateLimitMap = new Map<string, { count: number; reset: number }>();

function getClientIp(req: NextRequest): string {
  // Prefer Vercel's platform header; otherwise use the reverse proxy's forwarded IP.
  const forwardedIp =
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip");

  const ip = forwardedIp?.split(",")[0]?.trim() ?? "";
  return isIP(ip) ? ip : "unknown";
}

function isRateLimited(ip: string): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry && now < entry.reset) {
    if (entry.count >= RATE_LIMIT) {
      return {
        limited: true,
        retryAfter: Math.max(1, Math.ceil((entry.reset - now) / 1_000)),
      };
    }

    entry.count++;
    return { limited: false, retryAfter: 0 };
  }

  if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    for (const [key, value] of rateLimitMap) {
      if (now >= value.reset) rateLimitMap.delete(key);
    }

    if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
      return { limited: true, retryAfter: 60 };
    }
  }

  rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
  return { limited: false, retryAfter: 0 };
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
  const message = requestBody.message;
  const rawHistory = requestBody.history;

  if (typeof message !== "string" || !message.trim()) return null;
  if (message.length > MAX_MESSAGE_CHARS) return null;
  if (rawHistory !== undefined && !Array.isArray(rawHistory)) return null;

  const history: ChatMessage[] = [];
  let historyChars = 0;
  for (const item of (rawHistory ?? []).slice(-MAX_HISTORY_MSGS)) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return null;
    }

    const entry = item as Record<string, unknown>;
    if (
      (entry.role !== "user" && entry.role !== "assistant") ||
      typeof entry.content !== "string" ||
      !entry.content.trim() ||
      entry.content.length > MAX_HISTORY_MESSAGE_CHARS
    ) {
      return null;
    }

    if (
      AI_ERROR_MARKERS.some((marker) =>
        (entry.content as string).includes(marker),
      )
    ) {
      continue;
    }

    historyChars += entry.content.length;
    if (historyChars > MAX_HISTORY_TOTAL_CHARS) return null;
    history.push({ role: entry.role, content: entry.content });
  }

  return { message, history };
}

export async function POST(req: NextRequest) {
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

  const limit = isRateLimited(getClientIp(req));
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

  const encoder = new TextEncoder();
  const aiStream = generateAIStream(body.message, body.history, req.signal);
  let cancelled = false;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of aiStream) {
          if (cancelled) break;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error("/api/ai stream error:", err);
        if (!cancelled) {
          controller.enqueue(
            encoder.encode(
              "\n\n[The response was interrupted. Please try again.]",
            ),
          );
        }
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(readable, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
