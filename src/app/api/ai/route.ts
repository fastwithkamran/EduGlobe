// ============================================================
// POST /api/ai — Server-Side Gemini AI Route
//
// Open to all users (guests included) — soft auth only.
// Security layers:
//   1. IP-based in-memory rate limiting (15 req/min guests, 30 req/min authed)
//   2. Max message length (1 000 chars)
//   3. History capped at last 10 messages before sending to Gemini
//   4. Streaming response — text arrives on the client as it generates
//
// Header (optional): Authorization: Bearer <firebase-id-token>
// Body: { message: string; history?: ChatMessage[] }
// ============================================================

import { type NextRequest, NextResponse } from 'next/server';
import { generateAIStream, type ChatMessage } from '@/lib/gemini';
import { verifyAuth } from '@/lib/verify-auth';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_MESSAGE_CHARS = 1_000;
const MAX_HISTORY_MSGS  = 10;      // last N messages kept (5 exchanges)
const RATE_WINDOW_MS    = 60_000;  // 1 minute
const RATE_LIMIT_GUEST  = 15;      // requests per window for guests
const RATE_LIMIT_AUTHED = 30;      // requests per window for signed-in users

// ─── In-Memory Rate Limiter ───────────────────────────────────────────────────
// Works well for a single Vercel instance. For multi-region scale, replace
// with Upstash Redis (@upstash/ratelimit). Free tier: upstash.com
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.reset) {
    rateLimitMap.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return false; // first request in window — allow
  }

  if (entry.count >= limit) return true; // over limit — block

  entry.count++;
  return false; // under limit — allow
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Soft auth — identify caller if token present, but don't block guests
  const auth = await verifyAuth(req).catch(() => null);

  // 2. Rate limiting — key is UID for authed users, IP for guests
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('x-real-ip')
            ?? 'anonymous';
  const rateLimitKey = auth ? `uid:${auth.uid}` : `ip:${ip}`;
  const rateLimitCap  = auth ? RATE_LIMIT_AUTHED : RATE_LIMIT_GUEST;

  if (isRateLimited(rateLimitKey, rateLimitCap)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before trying again.' },
      { status: 429 },
    );
  }

  // 3. Parse + validate body
  let body: { message: string; history?: ChatMessage[] };
  try {
    body = await req.json() as { message: string; history?: ChatMessage[] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  if (body.message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message too long. Maximum ${MAX_MESSAGE_CHARS} characters allowed.` },
      { status: 400 },
    );
  }

  // 4. Cap history to last N messages to control token cost
  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY_MSGS)
    : [];

  // 5. Stream Gemini response back to client
  const encoder = new TextEncoder();
  const aiStream = generateAIStream(body.message, history);

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of aiStream) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error('/api/ai stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
