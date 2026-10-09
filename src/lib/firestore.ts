// ============================================================
// Opportune — Firestore Service Layer
// Firestore data access and Cloudinary media operations live here.
// UI components never import from firebase/firestore directly.
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  deleteField,
  runTransaction,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Query,
  type SnapshotOptions,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebase";
import type {
  UserProfile,
  Society,
  Post,
  PostComment,
  Notification,
  Follow,
  CommunityLinks,
} from "@/types";

// Firestore allows 500 writes per batch; stay under it.
const BATCH_LIMIT = 450;
// Client-side upload limits (Cloudinary free plan: 10 MB images, larger for other types).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const NOTIFICATION_PAGE_SIZE = 30;

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Recursively convert Firestore Timestamps to Dates (objects AND arrays). */
function convertValue(v: unknown): unknown {
  if (!v || typeof v !== "object") return v;
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  if (Array.isArray(v)) return v.map(convertValue);
  // Only walk plain objects — never DocumentReference / GeoPoint / etc.
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = convertValue(val);
  }
  return out;
}

/**
 * Firestore throws on `undefined` field values (e.g. an optional
 * `communityLinks` that was never filled in). Drop them recursively, leaving
 * FieldValue sentinels, Dates and Timestamps untouched.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

function fromDoc<T>(snap: {
  id: string;
  data: (options?: SnapshotOptions) => DocumentData | undefined;
}): T {
  // "estimate" gives pending serverTimestamp() fields a local time instead of
  // null, so optimistic snapshots never crash code that calls createdAt.getTime().
  const data = snap.data({ serverTimestamps: "estimate" }) ?? {};
  return {
    id: snap.id,
    ...(convertValue(data) as Record<string, unknown>),
  } as T;
}

async function commitDeletes(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteQueryDocs(q: Query): Promise<void> {
  const snap = await getDocs(q);
  await commitDeletes(snap.docs.map((d) => d.ref));
}

// ─── File Upload (Cloudinary — unsigned preset) ───────────────────────────────
//
// Uses XMLHttpRequest instead of fetch so we get real upload-progress events.
// Calling code is unchanged: uploadFile(file, path, onProgress?) → URL
// The final path segment becomes the asset name; preceding segments are folders.

/** Mirrors Cloudinary's own "auto" detection so the public ID rules are deterministic. */
function cloudinaryResourceType(file: File): "image" | "video" | "raw" {
  if (file.type.startsWith("image/") || file.type === "application/pdf") {
    return "image";
  }
  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
    return "video";
  }
  return "raw";
}

export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !preset) {
    throw new Error(
      "Cloudinary env vars not set (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)",
    );
  }

  // Validate before spending bandwidth on an upload Cloudinary will reject.
  const resourceType = cloudinaryResourceType(file);
  const maxBytes = resourceType === "image" ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      `"${file.name}" is too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    );
  }

  const pathSegments = path.split("/").filter(Boolean);
  const assetName = pathSegments.pop() || file.name;
  const folder = pathSegments.join("/") || "opportune";
  // Cloudinary keeps the extension as part of a RAW asset's public ID (and the
  // download URL); stripping it would make PDFs-as-docx/zip downloads
  // extension-less. Image/video IDs never include it.
  const publicId =
    resourceType === "raw" ? assetName : assetName.replace(/\.[^.]+$/, "");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);
  formData.append("folder", folder);
  formData.append("public_id", publicId);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    );

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable)
          onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { secure_url: string };
          resolve(data.secure_url);
        } catch {
          reject(new Error("Invalid Cloudinary response"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed — network error"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(formData);
  });
}

/**
 * Upload several files. If ANY upload fails, the ones that already succeeded
 * are deleted so a failed attempt leaves no orphaned assets, and the first
 * error is re-thrown. Progress is the average across all files.
 */
export async function uploadFiles(
  files: File[],
  pathFor: (file: File, index: number) => string,
  onProgress?: (pct: number) => void,
): Promise<string[]> {
  const progress = files.map(() => 0);
  const results = await Promise.allSettled(
    files.map((file, i) =>
      uploadFile(file, pathFor(file, i), (pct) => {
        progress[i] = pct;
        onProgress?.(
          Math.round(progress.reduce((a, b) => a + b, 0) / files.length),
        );
      }),
    ),
  );

  const urls: string[] = [];
  let failure: unknown = null;
  for (const r of results) {
    if (r.status === "fulfilled") urls.push(r.value);
    else failure ??= r.reason;
  }

  if (failure) {
    await Promise.allSettled(urls.map((url) => deleteFile(url)));
    throw failure instanceof Error ? failure : new Error("Upload failed");
  }
  return urls;
}

// ─── File Delete (Cloudinary — server-side API route) ─────────────────────────
//
// Sends the asset URL to the server so it can verify ownership before deletion.

export async function deleteFile(url: string): Promise<void> {
  if (!url) return;

  try {
    const { hostname } = new URL(url);
    if (
      hostname !== "res.cloudinary.com" &&
      !hostname.endsWith(".cloudinary.com")
    )
      return;

    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      console.warn("[deleteFile] Cloudinary delete skipped: no signed-in user");
      return;
    }

    const token = await currentUser.getIdToken();
    const response = await fetch("/api/cloudinary/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ assetUrl: url }),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        result?.error ?? `Cloudinary delete failed (${response.status})`,
      );
    }
  } catch (err) {
    console.warn("[deleteFile] Cloudinary delete skipped:", err);
  }
}

// ─── User Profiles ────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return fromDoc<UserProfile>(snap);
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<Omit<UserProfile, "uid" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    ...stripUndefined(updates),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete all Firestore data for a user prior to deleting their Auth account.
 * Removes: follows (and decrements society follower counts), notifications,
 * then the users doc LAST so a partial failure can simply be retried.
 * Posts and society membership are intentionally kept (soft-delete pattern).
 */
export async function deleteUserAccount(uid: string): Promise<void> {
  // 1. Follows — go through the transaction so followerCount stays correct
  const followsSnap = await getDocs(
    query(collection(db, "follows"), where("followerId", "==", uid)),
  );
  const followResults = await Promise.allSettled(
    followsSnap.docs.map((d) =>
      removeFollow(d.ref, (d.data() as Follow).societyId),
    ),
  );
  const failedFollow = followResults.find((r) => r.status === "rejected");
  if (failedFollow) throw (failedFollow as PromiseRejectedResult).reason;

  // 2. Notifications (batched)
  await deleteQueryDocs(
    query(collection(db, "notifications"), where("userId", "==", uid)),
  );

  // 2b. Uploaded avatar (best-effort). Must happen BEFORE the user doc is
  // deleted: the delete API route verifies ownership using that document.
  const profileSnap = await getDoc(doc(db, "users", uid));
  const photoURL = profileSnap.data()?.photoURL as string | null | undefined;
  if (photoURL) await deleteFile(photoURL);

  // 3. User document last
  await deleteDoc(doc(db, "users", uid));
}

// ─── Societies ────────────────────────────────────────────────────────────────

export async function getSociety(id: string): Promise<Society | null> {
  const snap = await getDoc(doc(db, "societies", id));
  if (!snap.exists()) return null;
  return fromDoc<Society>(snap);
}

export async function getAllSocieties(): Promise<Society[]> {
  const snap = await getDocs(
    query(collection(db, "societies"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => fromDoc<Society>(d));
}

/**
 * Create a new society.
 * The society doc and the creator's profile update are committed atomically,
 * so a failure can't leave an orphan society or a half-promoted user.
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
    website: string;
    contactEmail: string;
    communityLinks?: CommunityLinks;
    logoURL: string;
    bannerURL: string;
  },
  creator: {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string | null;
  },
): Promise<string> {
  const userRef = doc(db, "users", creator.uid);
  const userSnap = await getDoc(userRef);
  const currentRole = (userSnap.data()?.role as string | null | undefined) ?? null;
  if (currentRole !== null && currentRole !== "super_admin") {
    throw new Error("You already manage a society.");
  }

  const societyRef = doc(collection(db, "societies"));
  const batch = writeBatch(db);

  batch.set(
    societyRef,
    stripUndefined({
      ...data,
      followerCount: 0,
      isVerified: false,
      createdBy: creator.uid,
      createdByName: creator.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  // A super admin creating a society must NOT be demoted to "admin".
  if (currentRole === null) {
    batch.update(userRef, {
      role: "admin",
      societyId: societyRef.id,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return societyRef.id;
}

/**
 * Super-admin: delete a society and everything under it — posts (with their
 * attachments and comment subcollections), follows, and images.
 * NOTE: other users' notifications and users.societyId pointers can't be
 * cleaned from the client (rules) — do that in a Cloud Function.
 */
export async function deleteSociety(societyId: string): Promise<void> {
  const societyRef = doc(db, "societies", societyId);
  const assetUrls: string[] = [];

  const societySnap = await getDoc(societyRef);
  if (societySnap.exists()) {
    const society = fromDoc<Society>(societySnap);
    if (society.logoURL) assetUrls.push(society.logoURL);
    if (society.bannerURL) assetUrls.push(society.bannerURL);
  }

  // Posts: comments subcollection + the post itself
  const postsSnap = await getDocs(
    query(collection(db, "posts"), where("societyId", "==", societyId)),
  );
  for (const postDoc of postsSnap.docs) {
    const post = fromDoc<Post>(postDoc);
    for (const att of post.attachments ?? []) {
      if (att.fileURL) assetUrls.push(att.fileURL);
    }
    await deleteQueryDocs(query(collection(postDoc.ref, "comments")));
  }
  await commitDeletes(postsSnap.docs.map((d) => d.ref));

  // Follows
  await deleteQueryDocs(
    query(collection(db, "follows"), where("societyId", "==", societyId)),
  );

  await deleteDoc(societyRef);

  // Cloudinary last and best-effort: if any Firestore step above fails the
  // whole delete can simply be retried with its images still intact.
  await Promise.allSettled(assetUrls.map((url) => deleteFile(url)));
}

export function subscribeToPublicSocieties(
  callback: (societies: Society[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, "societies"),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => fromDoc<Society>(d))),
    onError,
  );
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function createPost(
  data: Omit<
    Post,
    "id" | "createdAt" | "updatedAt" | "likeCount" | "commentCount" | "likedBy"
  >,
): Promise<string> {
  const postRef = doc(collection(db, "posts"));
  await setDoc(
    postRef,
    stripUndefined({
      ...data,
      likeCount: 0,
      commentCount: 0,
      likedBy: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );

  // The post already exists — a notification failure must NOT make the caller
  // think publishing failed (they'd retry and create duplicates).
  try {
    await notifyFollowersOfNewPost(
      data.societyId,
      data.societyName,
      postRef.id,
      data.content,
    );
  } catch (err) {
    console.warn("[createPost] follower notification fan-out failed:", err);
  }

  return postRef.id;
}

/**
 * Internal: fan out a new-post notification to all followers of a society,
 * in batches of <= BATCH_LIMIT. Called automatically by createPost.
 * (Best moved to a Cloud Function trigger so clients never write other
 * users' notifications.)
 */
async function notifyFollowersOfNewPost(
  societyId: string,
  societyName: string,
  postId: string,
  postContent: string,
): Promise<void> {
  const followsSnap = await getDocs(
    query(collection(db, "follows"), where("societyId", "==", societyId)),
  );
  // Array.from so an emoji at the cut-off point isn't split into a broken glyph.
  const chars = Array.from(postContent);
  const preview =
    chars.length > 80 ? chars.slice(0, 80).join("") + "…" : postContent;
  const followerIds = followsSnap.docs.map(
    (d) => (d.data() as Follow).followerId,
  );

  for (let i = 0; i < followerIds.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const userId of followerIds.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(collection(db, "notifications")), {
        userId,
        title: `New post from ${societyName}`,
        message: preview,
        isRead: false,
        relatedPostId: postId,
        relatedSocietyId: societyId,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/** Fetch a single post — used to deep-link from a notification (?post=ID). */
export async function getPost(postId: string): Promise<Post | null> {
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) return null;
  return fromDoc<Post>(snap);
}

/** Global public feed — real-time */
export function subscribeToFeed(
  callback: (posts: Post[]) => void,
  pageSize = 30,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((document) => fromDoc<Post>(document))),
    onError,
  );
}

/** Feed for all followed societies — chunked to Firestore's 30-ID query cap. */
export function subscribeToFollowingFeed(
  followedSocietyIds: string[],
  callback: (posts: Post[]) => void,
  onError?: (error: Error) => void,
  pageSize = 50,
): Unsubscribe | null {
  const ids = [...new Set(followedSocietyIds)];
  if (ids.length === 0) {
    callback([]);
    return null;
  }

  const societyIdGroups: string[][] = [];
  for (let index = 0; index < ids.length; index += 30) {
    societyIdGroups.push(ids.slice(index, index + 30));
  }

  const groupPosts: Post[][] = Array.from(
    { length: societyIdGroups.length },
    () => [],
  );
  const initializedGroups = new Set<number>();
  const unsubscribers: Unsubscribe[] = [];
  let failed = false;

  const time = (p: Post) => p.createdAt?.getTime?.() ?? 0;

  societyIdGroups.forEach((group, groupIndex) => {
    const q = query(
      collection(db, "posts"),
      where("societyId", "in", group),
      orderBy("createdAt", "desc"),
      limit(pageSize),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (failed) return;
        groupPosts[groupIndex] = snap.docs.map((document) =>
          fromDoc<Post>(document),
        );
        initializedGroups.add(groupIndex);
        if (initializedGroups.size !== societyIdGroups.length) return;

        callback(
          groupPosts
            .flat()
            .sort((a, b) => time(b) - time(a))
            .slice(0, pageSize),
        );
      },
      (error) => {
        if (failed) return;
        failed = true;
        unsubscribers.forEach((unsubscribeGroup) => unsubscribeGroup());
        onError?.(error);
      },
    );
    unsubscribers.push(unsubscribe);
  });

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

/** Posts for a single society — used inside My Society page Feed tab.
 *  pageLimit drives Load More: re-subscribe with a higher limit to fetch more. */
export function subscribeToSocietyPosts(
  societyId: string,
  callback: (posts: Post[]) => void,
  pageLimit = 10,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, "posts"),
    where("societyId", "==", societyId),
    orderBy("createdAt", "desc"),
    limit(pageLimit),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((document) => fromDoc<Post>(document))),
    onError,
  );
}

/** Edit post content (and optional opportunity meta) — admin only */
export async function updatePost(
  postId: string,
  updates: Partial<Pick<Post, "content" | "opportunityMeta">>,
): Promise<void> {
  // An explicit `undefined` means "remove this field" (e.g. dropping the
  // opportunity details when a post is turned back into an announcement).
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    fields[key] = value === undefined ? deleteField() : stripUndefined(value);
  }
  await updateDoc(doc(db, "posts", postId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePost(postId: string): Promise<void> {
  const postRef = doc(db, "posts", postId);

  const postSnap = await getDoc(postRef);
  const attachmentUrls = postSnap.exists()
    ? (fromDoc<Post>(postSnap).attachments ?? []).map((att) => att.fileURL)
    : [];

  // Firestore does not cascade — remove the comments subcollection too.
  await deleteQueryDocs(query(collection(postRef, "comments")));
  await deleteDoc(postRef);

  // Files last and best-effort, so a failed Firestore delete never leaves a
  // post pointing at attachments that were already destroyed.
  await Promise.allSettled(
    attachmentUrls.filter(Boolean).map((url) => deleteFile(url)),
  );
}

/**
 * Like / unlike. Runs in a transaction and is idempotent: a double-click or
 * a stale UI state can no longer push likeCount out of sync with likedBy.
 */
export async function togglePostLike(
  postId: string,
  userId: string,
  liked: boolean,
): Promise<void> {
  const postRef = doc(db, "posts", postId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(postRef);
    if (!snap.exists()) return;
    const likedBy = (snap.data().likedBy as string[] | undefined) ?? [];
    if (likedBy.includes(userId) === liked) return; // already in that state

    transaction.update(postRef, {
      likedBy: liked ? arrayUnion(userId) : arrayRemove(userId),
      likeCount: increment(liked ? 1 : -1),
    });
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export function subscribeToComments(
  postId: string,
  callback: (comments: PostComment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, "posts", postId, "comments"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) =>
      callback(snap.docs.map((document) => fromDoc<PostComment>(document))),
    onError,
  );
}

export async function addComment(
  postId: string,
  data: Omit<PostComment, "id" | "createdAt">,
): Promise<string> {
  const content = data.content.trim();
  if (!content || content.length > 100) {
    throw new Error("Comment must be between 1 and 100 characters.");
  }

  // Comment + counter commit together (previously two writes that could drift).
  const commentRef = doc(collection(db, "posts", postId, "comments"));
  const batch = writeBatch(db);
  batch.set(
    commentRef,
    stripUndefined({
      ...data,
      content,
      createdAt: serverTimestamp(),
    }),
  );
  batch.update(doc(db, "posts", postId), { commentCount: increment(1) });
  await batch.commit();
  return commentRef.id;
}

/**
 * Delete a comment (author, society admin or super admin — enforced by rules)
 * and keep the post's commentCount in step. The rules only accept a count
 * change of exactly -1, so the counter is skipped when it is already 0.
 */
export async function deleteComment(
  postId: string,
  commentId: string,
): Promise<void> {
  const postRef = doc(db, "posts", postId);
  const commentRef = doc(db, "posts", postId, "comments", commentId);
  await runTransaction(db, async (transaction) => {
    const [postSnap, commentSnap] = await Promise.all([
      transaction.get(postRef),
      transaction.get(commentRef),
    ]);
    if (!commentSnap.exists()) return;

    transaction.delete(commentRef);
    const count = (postSnap.data()?.commentCount as number | undefined) ?? 0;
    if (postSnap.exists() && count > 0) {
      transaction.update(postRef, { commentCount: increment(-1) });
    }
  });
}

// ─── Follows ─────────────────────────────────────────────────────────────────

export async function isFollowing(
  userId: string,
  societyId: string,
): Promise<boolean> {
  // Follow docs have a deterministic ID, so one document read replaces a query.
  const snap = await getDoc(doc(db, "follows", `${userId}_${societyId}`));
  return snap.exists();
}

export async function followSociety(
  userId: string,
  societyId: string,
): Promise<void> {
  const followRef = doc(db, "follows", `${userId}_${societyId}`);
  const societyRef = doc(db, "societies", societyId);
  await runTransaction(db, async (transaction) => {
    const follow = await transaction.get(followRef);
    if (follow.exists()) return;

    transaction.set(followRef, {
      followerId: userId,
      societyId,
      createdAt: serverTimestamp(),
    });
    transaction.update(societyRef, { followerCount: increment(1) });
  });
}

/** Delete one follow doc and decrement the society counter (if it still exists). */
async function removeFollow(
  followRef: DocumentReference,
  societyId: string,
): Promise<void> {
  const societyRef = doc(db, "societies", societyId);
  await runTransaction(db, async (transaction) => {
    const follow = await transaction.get(followRef);
    if (!follow.exists()) return;
    const society = await transaction.get(societyRef);

    transaction.delete(followRef);
    // A deleted society would make this update throw and block the unfollow.
    // The rules only accept followerCount - 1, so never write a clamped value
    // (a count already at 0 would be rejected and block the unfollow).
    const followerCount =
      (society.data()?.followerCount as number | undefined) ?? 0;
    if (society.exists() && followerCount > 0) {
      transaction.update(societyRef, { followerCount: increment(-1) });
    }
  });
}

export async function unfollowSociety(
  userId: string,
  societyId: string,
): Promise<void> {
  await removeFollow(doc(db, "follows", `${userId}_${societyId}`), societyId);
}

export async function getFollowedSocietyIds(userId: string): Promise<string[]> {
  const q = query(collection(db, "follows"), where("followerId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => (d.data() as Follow).societyId);
}

// ─── Notifications ────────────────────────────────────────────────────────────
// Notifications are only sent for new posts from followed societies.
// Requires a composite index: notifications (userId ASC, createdAt DESC).

/** pageLimit drives "Load more": re-subscribe with a larger limit. */
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  onError?: (error: Error) => void,
  pageLimit = NOTIFICATION_PAGE_SIZE,
): Unsubscribe {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(pageLimit),
  );
  return onSnapshot(
    q,
    (snap) =>
      callback(snap.docs.map((document) => fromDoc<Notification>(document))),
    onError,
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { isRead: true });
}

/** Marks everything read in batches (a single batch is capped at 500 writes). */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  // Loop until nothing unread is left; each pass handles <= BATCH_LIMIT docs.
  for (;;) {
    const snap = await getDocs(
      query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("isRead", "==", false),
        limit(BATCH_LIMIT),
      ),
    );
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
    await batch.commit();

    if (snap.size < BATCH_LIMIT) return;
  }
}