// ============================================================
// Opportune — Firestore Service Layer
// All Firestore + Storage operations live here.
// UI components never import from firebase/firestore directly.
// ============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
  increment, type QuerySnapshot, type Unsubscribe,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import type {
  UserProfile, Society, Post, PostComment,
  Notification, Follow,
  PostAttachment, SocietyPrivacy,
} from '@/types';

// ─── Internal helper — Firestore Timestamp → Date ────────────────────────────

function fromDoc<T>(snap: { id: string; data: () => Record<string, unknown> }): T {
  const data = snap.data();
  const convert = (obj: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
        out[k] = (v as { toDate: () => Date }).toDate();
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = convert(v as Record<string, unknown>);
      } else {
        out[k] = v;
      }
    }
    return out;
  };
  return { id: snap.id, ...convert(data) } as T;
}

// ─── File Upload (Cloudinary — unsigned preset) ───────────────────────────────
//
// Uses XMLHttpRequest instead of fetch so we get real upload-progress events.
// Calling code is unchanged: uploadFile(file, path, onProgress?) → URL
// The `path` arg is kept for API compat; we extract the first segment as folder.

export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset   = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !preset) {
    throw new Error('Cloudinary env vars not set (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)');
  }

  // Use first path segment as folder (e.g. 'societies', 'avatars', 'posts')
  const folder = path.split('/')[0] || 'opportune';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);
  formData.append('folder', folder);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { secure_url: string };
          resolve(data.secure_url);
        } catch {
          reject(new Error('Invalid Cloudinary response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    };

    xhr.onerror  = () => reject(new Error('Upload failed — network error'));
    xhr.onabort  = () => reject(new Error('Upload cancelled'));
    xhr.send(formData);
  });
}

// ─── File Delete (Cloudinary — server-side API route) ─────────────────────────
//
// Extracts the Cloudinary public_id from the URL and calls our
// /api/cloudinary/delete route (which holds the API secret server-side).
// Silently no-ops on empty or non-Cloudinary URLs.

export async function deleteFile(url: string): Promise<void> {
  if (!url) return;

  // Validate the URL is actually from Cloudinary's domain.
  // url.includes('cloudinary.com') is insufficient — 'evilcloudinary.com'
  // or 'cloudinary.com.attacker.com' would bypass that check.
  try {
    const { hostname } = new URL(url);
    const isCloudinary =
      hostname === 'res.cloudinary.com' ||
      hostname.endsWith('.cloudinary.com');
    if (!isCloudinary) return;
  } catch {
    return; // Malformed URL — skip silently
  }

  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^./]+)?$/);
  if (!match || !match[1]) return;
  const publicId = match[1];

  try {
    // Attach the caller's Firebase ID token so the server can verify auth
    const currentUser = getAuth().currentUser;
    const token = currentUser ? await currentUser.getIdToken() : null;

    await fetch('/api/cloudinary/delete', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ publicId }),
    });
  } catch (err) {
    // Best-effort: log but don't block the caller
    console.warn('[deleteFile] Cloudinary delete skipped:', err);
  }
}

// ─── User Profiles ────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return fromDoc<UserProfile>(snap);
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...updates, updatedAt: serverTimestamp() });
}

/**
 * Delete all Firestore data for a user prior to deleting their Auth account.
 * Removes: users doc, follows, notifications.
 * Posts and society membership are intentionally kept (soft-delete pattern).
 */
export async function deleteUserAccount(uid: string): Promise<void> {
  // 1. Delete user document
  await deleteDoc(doc(db, 'users', uid));

  // 2. Delete their follows
  const followsSnap = await getDocs(
    query(collection(db, 'follows'), where('followerId', '==', uid)),
  );
  await Promise.all(followsSnap.docs.map(d => deleteDoc(d.ref)));

  // 3. Delete their notifications
  const notifsSnap = await getDocs(
    query(collection(db, 'notifications'), where('userId', '==', uid)),
  );
  await Promise.all(notifsSnap.docs.map(d => deleteDoc(d.ref)));
}

// ─── Societies ────────────────────────────────────────────────────────────────

export async function getSociety(id: string): Promise<Society | null> {
  const snap = await getDoc(doc(db, 'societies', id));
  if (!snap.exists()) return null;
  return fromDoc<Society>(snap);
}

export async function getAllSocieties(): Promise<Society[]> {
  const snap = await getDocs(query(collection(db, 'societies'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => fromDoc<Society>(d));
}

/**
 * Create a new society.
 * The creator is automatically added as 'owner' member and their profile
 * is updated with role:'admin' and the new societyId.
 *
 * @returns the new society's Firestore document ID
 */
export async function createSociety(
  data: {
    name: string;
    organization: string;
    city: string;
    country: string;
    description: string;
    privacy: SocietyPrivacy;
    website: string;
    contactEmail: string;
    communityLinks?: import('@/types').CommunityLinks;
    logoURL: string;
    bannerURL: string;
  },
  creator: { uid: string; displayName: string; email: string; photoURL: string | null },
): Promise<string> {
  // 1. Create society doc
  const societyRef = await addDoc(collection(db, 'societies'), {
    ...data,
    memberCount: 0,
    followerCount: 0,
    isVerified: false,
    createdBy: creator.uid,
    createdByName: creator.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const societyId = societyRef.id;

  // 2. Make creator an admin in their user profile
  await updateDoc(doc(db, 'users', creator.uid), {
    role: 'admin',
    societyId,
    updatedAt: serverTimestamp(),
  });

  return societyId;
}

/**
 * Super-admin: delete a society and all related top-level documents.
 * Sub-collection cascade (comments, messages) requires a Cloud Function.
 */
export async function deleteSociety(societyId: string): Promise<void> {
  // Delete society images from Cloudinary first (best-effort)
  const societySnap = await getDoc(doc(db, 'societies', societyId));
  if (societySnap.exists()) {
    const society = fromDoc<Society>(societySnap);
    await Promise.allSettled([
      society.logoURL   ? deleteFile(society.logoURL)   : Promise.resolve(),
      society.bannerURL ? deleteFile(society.bannerURL) : Promise.resolve(),
    ]);
  }

  // Cascade-delete posts and follows for this society
  const related: Array<[string, string]> = [
    ['posts',   'societyId'],
    ['follows', 'societyId'],
  ];
  for (const [col, field] of related) {
    const snap = await getDocs(query(collection(db, col), where(field, '==', societyId)));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }
  await deleteDoc(doc(db, 'societies', societyId));
}

export function subscribeToPublicSocieties(
  callback: (societies: Society[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'societies'),
    where('privacy', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromDoc<Society>(d))));
}



export async function createPost(
  data: Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'likeCount' | 'commentCount' | 'likedBy'>,
): Promise<string> {
  const r = await addDoc(collection(db, 'posts'), {
    ...data,
    likeCount: 0,
    commentCount: 0,
    likedBy: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Notify all followers of this society that a new post was made
  // (new_post is the ONLY notification type per updated spec)
  if (data.visibility === 'public') {
    await notifyFollowersOfNewPost(
      data.societyId,
      data.societyName,
      r.id,
      data.content,
    );
  }

  return r.id;
}

/**
 * Internal: fan-out a new_post notification to all followers of a society.
 * Called automatically by createPost — do not call directly.
 */
async function notifyFollowersOfNewPost(
  societyId: string,
  societyName: string,
  postId: string,
  postContent: string,
): Promise<void> {
  const followsSnap = await getDocs(
    query(collection(db, 'follows'), where('societyId', '==', societyId)),
  );
  const preview = postContent.length > 80 ? postContent.slice(0, 80) + '…' : postContent;
  const notifications = followsSnap.docs.map(d =>
    addDoc(collection(db, 'notifications'), {
      userId: (d.data() as Follow).followerId,
      type: 'new_post',
      title: `New post from ${societyName}`,
      message: preview,
      isRead: false,
      relatedPostId: postId,
      relatedSocietyId: societyId,
      createdAt: serverTimestamp(),
    }),
  );
  await Promise.all(notifications);
}

/** Global public feed — real-time */
export function subscribeToFeed(
  callback: (posts: Post[]) => void,
  pageSize = 30,
): Unsubscribe {
  const q = query(
    collection(db, 'posts'),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromDoc<Post>(d))));
}

/** Feed filtered to societies the user follows — real-time */
export function subscribeToFollowingFeed(
  followedSocietyIds: string[],
  callback: (posts: Post[]) => void,
): Unsubscribe | null {
  if (followedSocietyIds.length === 0) {
    callback([]);
    return null;
  }
  // Firestore 'in' supports up to 30 values
  const ids = followedSocietyIds.slice(0, 30);
  const q = query(
    collection(db, 'posts'),
    where('societyId', 'in', ids),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromDoc<Post>(d))));
}

/** Posts for a single society — used inside My Society page Feed tab.
 *  pageLimit drives Load More: re-subscribe with a higher limit to fetch more. */
export function subscribeToSocietyPosts(
  societyId: string,
  callback: (posts: Post[]) => void,
  pageLimit = 10,
): Unsubscribe {
  const q = query(
    collection(db, 'posts'),
    where('societyId', '==', societyId),
    orderBy('createdAt', 'desc'),
    limit(pageLimit),
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromDoc<Post>(d))));
}

/** Edit post content (and optional opportunity meta) — admin only */
export async function updatePost(
  postId: string,
  updates: Partial<Pick<Post, 'content' | 'opportunityMeta'>>,
): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePost(postId: string): Promise<void> {
  // Delete any Cloudinary file attachments first (best-effort)
  const postSnap = await getDoc(doc(db, 'posts', postId));
  if (postSnap.exists()) {
    const post = fromDoc<Post>(postSnap);
    if (post.attachments?.length) {
      await Promise.allSettled(post.attachments.map(att => deleteFile(att.fileURL)));
    }
  }
  await deleteDoc(doc(db, 'posts', postId));
}

export async function togglePostLike(postId: string, userId: string, liked: boolean): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    likedBy: liked ? arrayUnion(userId) : arrayRemove(userId),
    likeCount: increment(liked ? 1 : -1),
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export function subscribeToComments(
  postId: string,
  callback: (comments: PostComment[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromDoc<PostComment>(d))));
}

export async function addComment(
  postId: string,
  data: Omit<PostComment, 'id' | 'createdAt'>,
): Promise<string> {
  const r = await addDoc(collection(db, 'posts', postId, 'comments'), {
    ...data, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
  return r.id;
}

// ─── Follows ─────────────────────────────────────────────────────────────────

export async function isFollowing(userId: string, societyId: string): Promise<boolean> {
  const q = query(
    collection(db, 'follows'),
    where('followerId', '==', userId),
    where('societyId', '==', societyId),
    limit(1),
  );
  return !(await getDocs(q)).empty;
}

export async function followSociety(userId: string, societyId: string): Promise<void> {
  await setDoc(doc(db, 'follows', `${userId}_${societyId}`), {
    followerId: userId, societyId, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'societies', societyId), { followerCount: increment(1) });
}

export async function unfollowSociety(userId: string, societyId: string): Promise<void> {
  await deleteDoc(doc(db, 'follows', `${userId}_${societyId}`));
  await updateDoc(doc(db, 'societies', societyId), { followerCount: increment(-1) });
}

export async function getFollowedSocietyIds(userId: string): Promise<string[]> {
  const q = query(collection(db, 'follows'), where('followerId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => (d.data() as Follow).societyId);
}


// ─── Notifications ────────────────────────────────────────────────────────────
// Per updated spec: notifications are ONLY sent for new_post from followed societies.

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(30),
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromDoc<Notification>(d))));
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { isRead: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('isRead', '==', false),
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { isRead: true })));
}
