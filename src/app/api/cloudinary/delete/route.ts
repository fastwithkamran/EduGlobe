// ============================================================
// POST /api/cloudinary/delete
//
// SECURITY: Requires a valid Firebase ID token in the
// Authorization header. Only authenticated users can delete
// files — this prevents anyone from wiping assets anonymously.
//
// Header: Authorization: Bearer <firebase-id-token>
// Body:   { publicId: string }
// ============================================================

import { v2 as cloudinary } from 'cloudinary';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/verify-auth';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  // ── Auth check — must be a signed-in user ──────────────────
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { publicId } = (await req.json()) as { publicId: string };

    if (!publicId) {
      return NextResponse.json({ error: 'publicId is required' }, { status: 400 });
    }

    // Try image resource type first, then raw (for PDFs / docs)
    let result: { result?: string } = {};
    try {
      result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch {
      result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    }

    return NextResponse.json({ ok: true, result: result.result });
  } catch (err) {
    console.error('[cloudinary/delete] Error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
