// ============================================================
// /api/ai — Server-Side Gemini API Route
// Never expose GEMINI_API_KEY to the client.
// This route validates the request and proxies to Gemini.
// ============================================================

import { type NextRequest, NextResponse } from 'next/server';
import { generateAIResponse, type ChatMessage } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { message: string; history?: ChatMessage[] };

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const response = await generateAIResponse(
      body.message,
      body.history ?? [],
    );

    return NextResponse.json({ response });
  } catch (err) {
    console.error('/api/ai error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
