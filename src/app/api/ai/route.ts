// ============================================================
// POST /api/ai — Server-Side Gemini AI Route
//
// Open to all users (guests included) — no auth required.
// If an Authorization token IS provided, we decode it and
// attach the caller's identity for future logging / rate limiting.
//
// Header (optional): Authorization: Bearer <firebase-id-token>
// Body: { message: string; history?: ChatMessage[] }
// ============================================================

import { type NextRequest, NextResponse } from 'next/server';
import { generateAIResponse, type ChatMessage } from '@/lib/gemini';
import { verifyAuth } from '@/lib/verify-auth';

export async function POST(req: NextRequest) {
  // Soft auth — identify the caller if a token is present, but don't block guests
  const auth = await verifyAuth(req).catch(() => null);

  try {
    const body = await req.json() as { message: string; history?: ChatMessage[] };

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const response = await generateAIResponse(
      body.message,
      body.history ?? [],
    );

    return NextResponse.json({
      response,
      // Return caller UID in dev — useful for debugging; omit in production
      ...(process.env.NODE_ENV === 'development' && auth ? { callerUid: auth.uid } : {}),
    });
  } catch (err) {
    console.error('/api/ai error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
