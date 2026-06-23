// ============================================================
// EduGlobe — Type Definitions
// ============================================================

// --- User & Auth ---
export type UserRole = 'viewer' | 'admin' | 'super_admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole | null;
  universityName: string;
  societyId: string | null;
  bio: string;
  contactInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- Society ---
export type SocietyCategory =
  | 'educational'
  | 'professional'
  | 'cultural'
  | 'sports'
  | 'religious'
  | 'technology'
  | 'arts'
  | 'debate'
  | 'community'
  | 'entrepreneurship'
  | 'media'
  | 'other';

export type SocietyPrivacy = 'public' | 'private';

export interface Society {
  id: string;
  name: string;
  // Organization replaces old "university" — can be university, company, club etc.
  organization: string;
  city: string;
  country: string;
  description: string;
  category: SocietyCategory;
  privacy: SocietyPrivacy;
  logoURL: string;
  bannerURL: string;
  website: string;
  contactEmail: string;
  tags: string[];
  memberCount: number;
  followerCount: number;
  isVerified: boolean;
  // Creator is automatically admin/owner
  createdBy: string;           // uid
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLink {
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'website' | 'youtube';
  url: string;
}

// --- Society Members (lightweight — shown inside Society page, no separate page) ---
export type MemberRole =
  | 'owner'
  | 'admin'
  | 'moderator'
  | 'member';

export interface SocietyMember {
  id: string;
  userId: string;
  societyId: string;
  displayName: string;
  photoURL: string | null;
  role: MemberRole;
  email: string;
  joinedAt: Date;
}

// --- Member Invitation ---
export interface MemberInvitation {
  id: string;
  societyId: string;
  societyName: string;
  invitedByUid: string;
  invitedByName: string;
  invitedByEmail: string;
  invitedEmail: string;
  role: MemberRole;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  expiresAt: Date;
}

// --- Posts ---
export type PostType = 'announcement' | 'event' | 'achievement' | 'recruitment' | 'general';
export type PostVisibility = 'public' | 'members_only';

export interface Post {
  id: string;
  societyId: string;
  societyName: string;
  societyLogoURL: string | null;
  authorId: string;
  authorName: string;
  content: string;
  type: PostType;
  visibility: PostVisibility;
  attachments: PostAttachment[];
  likeCount: number;
  commentCount: number;
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PostAttachment {
  id: string;
  fileName: string;
  fileURL: string;
  fileType: string;
  fileSize: number;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  createdAt: Date;
}

// --- Follow ---
export interface Follow {
  id: string;
  followerId: string;
  societyId: string;
  createdAt: Date;
}

// --- Groups (sub-feature inside Society page, not a top-level nav item) ---
export type GroupType = 'general' | 'committee' | 'project' | 'announcement';
export type GroupPrivacy = 'public' | 'private';  // public = all society members, private = invite-only

export interface Group {
  id: string;
  societyId: string;
  name: string;
  description: string;
  type: GroupType;
  privacy: GroupPrivacy;
  iconEmoji: string;
  memberIds: string[];
  memberCount: number;
  createdBy: string;
  createdAt: Date;
  lastActivityAt: Date;
  lastMessage?: string;
}

export interface Message {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string | null;
  content: string;
  type: 'text' | 'file' | 'system';
  fileURL?: string;
  fileName?: string;
  fileType?: string;
  isPinned: boolean;
  createdAt: Date;
}

// --- Notifications ---
// Only 'new_post' from followed societies triggers notifications per updated spec.
export type NotificationType =
  | 'new_post'          // followed society posted — PRIMARY notification type
  | 'post_like'
  | 'post_comment'
  | 'society_followed'
  | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedPostId?: string;
  relatedSocietyId?: string;
  relatedUserId?: string;
  createdAt: Date;
}

// --- AI Chat ---
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
