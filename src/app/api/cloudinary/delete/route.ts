// POST /api/cloudinary/delete
// Server-side: uses API secret — never exposed to the client.
// Body: { publicId: string }

import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const { publicId } = (await req.json()) as { publicId: string };

    if (!publicId) {
      return NextResponse.json({ error: 'publicId is required' }, { status: 400 });
    }

    // Try image resource type first, then raw (for PDFs/docs)
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
