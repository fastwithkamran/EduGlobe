// ============================================================
// POST /api/ai — Server-Side Gemini AI Route
//
// Open to all users (guests + signed-in). No auth required.
// Rate limited by IP — 20 requests per minute for everyone.
//
// Body: { message: string; history?: ChatMessage[] }
// ============================================================

import { type NextRequest, NextResponse } from 'next/server';
import { generateAIStream, type ChatMessage } from '@/lib/gemini';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_MESSAGE_CHARS = 1_000;
const MAX_HISTORY_MSGS  = 10;                  // last N messages sent to Gemini
const RATE_LIMIT        = 10;                  // requests per day per IP
const RATE_WINDOW_MS    = 24 * 60 * 60_000;   // 24 hours

// ─── In-Memory Rate Limiter (IP-based) ────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;

  entry.count++;
  return false;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('x-real-ip')
            ?? 'anonymous';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute and try again.' },
      { status: 429 },
    );
  }

  // 2. Parse + validate body
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
      { error: `Message too long. Max ${MAX_MESSAGE_CHARS} characters.` },
      { status: 400 },
    );
  }

  // 3. Cap history to last N messages to control token cost
  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY_MSGS)
    : [];

  // 4. Stream Gemini response back to client
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
