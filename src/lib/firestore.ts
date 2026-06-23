// ============================================================
// EduGlobe — Firestore Service Layer
// All Firestore + Storage operations live here.
// UI components never import from firebase/firestore directly.
// ============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
  increment, type QuerySnapshot, type Unsubscribe,
  startAfter, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { db, storage } from './firebase';
import type {
  UserProfile, Society, SocietyMember, Post, PostComment,
  Group, Message, Notification, MemberInvitation, Follow,
  PostAttachment, MemberRole, SocietyCategory, SocietyPrivacy,
  GroupPrivacy, GroupType,
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

// ─── File Upload ──────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap: UploadTaskSnapshot) => {
        if (onProgress) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });
}

export async function deleteFile(url: string): Promise<void> {
  await deleteObject(ref(storage, url));
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
    category: SocietyCategory;
    privacy: SocietyPrivacy;
    website: string;
    contactEmail: string;
    tags: string[];
    logoURL: string;
    bannerURL: string;
  },
  creator: { uid: string; displayName: string; email: string; photoURL: string | null },
): Promise<string> {
  // 1. Create society doc
  const societyRef = await addDoc(collection(db, 'societies'), {
    ...data,
    memberCount: 1,
    followerCount: 0,
    isVerified: false,
    createdBy: creator.uid,
    createdByName: creator.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const societyId = societyRef.id;

  // 2. Add creator as 'owner' in the members sub-collection
  await addDoc(collection(db, 'members'), {
    userId: creator.uid,
    societyId,
    displayName: creator.displayName,
    photoURL: creator.photoURL,
    role: 'owner' as MemberRole,
    email: creator.email,
    joinedAt: serverTimestamp(),
  });

  // 3. Update creator's user profile — make them admin of this society
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
  const related: Array<[string, string]> = [
    ['posts',       'societyId'],
    ['members',     'societyId'],
    ['invitations', 'societyId'],
    ['groups',      'societyId'],
    ['follows',     'societyId'],
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

// ─── Members ─────────────────────────────────────────────────────────────────

export function subscribeToMembers(
  societyId: string,
  callback: (members: SocietyMember[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'members'),
    where('societyId', '==', societyId),
    orderBy('joinedAt', 'asc'),
  );
  return onSnapshot(q, (snap: QuerySnapshot) => callback(snap.docs.map(d => fromDoc<SocietyMember>(d))));
}

export async function addMember(data: Omit<SocietyMember, 'id'>): Promise<string> {
  const r = await addDoc(collection(db, 'members'), { ...data, joinedAt: serverTimestamp() });
  await updateDoc(doc(db, 'societies', data.societyId), { memberCount: increment(1) });
  return r.id;
}

export async function removeMember(memberId: string, societyId: string): Promise<void> {
  await deleteDoc(doc(db, 'members', memberId));
  await updateDoc(doc(db, 'societies', societyId), { memberCount: increment(-1) });
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export async function createInvitation(
  data: Omit<MemberInvitation, 'id' | 'createdAt'>,
): Promise<string> {
  const r = await addDoc(collection(db, 'invitations'), {
    ...data, status: 'pending', createdAt: serverTimestamp(),
  });
  return r.id;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

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

/** Posts for a single society — used inside Society page Feed tab */
export function subscribeToSocietyPosts(
  societyId: string,
  callback: (posts: Post[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'posts'),
    where('societyId', '==', societyId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromDoc<Post>(d))));
}

export async function deletePost(postId: string): Promise<void> {
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

// ─── Groups (sub-feature inside Society page) ─────────────────────────────────

export function subscribeToGroups(
  societyId: string,
  callback: (groups: Group[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'groups'),
    where('societyId', '==', societyId),
    orderBy('lastActivityAt', 'desc'),
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromDoc<Group>(d))));
}

export async function createGroup(data: {
  societyId: string;
  name: string;
  description: string;
  type: GroupType;
  privacy: GroupPrivacy;
  iconEmoji: string;
  createdBy: string;
  initialMemberId: string;
}): Promise<string> {
  const r = await addDoc(collection(db, 'groups'), {
    societyId: data.societyId,
    name: data.name,
    description: data.description,
    type: data.type,
    privacy: data.privacy,
    iconEmoji: data.iconEmoji,
    memberIds: [data.initialMemberId],
    memberCount: 1,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    lastMessage: undefined,
  });
  return r.id;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function subscribeToMessages(
  groupId: string,
  callback: (messages: Message[]) => void,
  pageSize = 50,
): Unsubscribe {
  const q = query(
    collection(db, 'groups', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => fromDoc<Message>(d)).reverse());
  });
}

export async function sendMessage(
  groupId: string,
  data: Omit<Message, 'id' | 'createdAt'>,
): Promise<string> {
  const r = await addDoc(collection(db, 'groups', groupId, 'messages'), {
    ...data, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'groups', groupId), {
    lastActivityAt: serverTimestamp(),
    lastMessage: data.content,
  });
  return r.id;
}

export async function getPreviousMessages(
  groupId: string,
  beforeDoc: QueryDocumentSnapshot,
  pageSize = 30,
): Promise<Message[]> {
  const q = query(
    collection(db, 'groups', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(beforeDoc),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => fromDoc<Message>(d)).reverse();
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
