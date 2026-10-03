// ============================================================
// verify-auth.ts — Server-Side Firebase JWT Verification
//
// Usage in any API route:
//   const auth = await verifyAuth(req);
//   if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   // auth.uid and auth.email are now available
// ============================================================

import type { NextRequest } from 'next/server';
import { getAdminAuth } from './firebase-admin';

export interface AuthPayload {
  uid: string;
  email?: string;
  name?: string;
}

/**
 * Extracts and verifies the Firebase ID token from the
 * `Authorization: Bearer <token>` request header.
 *
 * Returns the decoded payload on success, or null if:
 *  - No Authorization header is present
 *  - The token is invalid / expired
 *  - Firebase Admin env vars are not configured
 */
export async function verifyAuth(req: NextRequest): Promise<AuthPayload | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return {
      uid:   decoded.uid,
      email: decoded.email,
      name:  decoded.name,
    };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[verifyAuth] Token verification failed:', err);
    }
    return null;
  }
}
