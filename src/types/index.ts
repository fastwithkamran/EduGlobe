// Opportune — Type Definitions

// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = "viewer" | "admin" | "super_admin";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole | null;
  universityName: string; // University/institution the user belongs to
  societyId: string | null; // ID of the society they administer (null if none)
  bio: string;
  contactInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Society ──────────────────────────────────────────────────────────────────

export type SocietyPrivacy = "public"; // All societies are publicly discoverable

/** Where the community lives — all fields optional */
export interface CommunityLinks {
  discord?: string; // Discord server invite
  whatsapp?: string; // WhatsApp group link
  linkedin?: string; // LinkedIn page or profile
  twitter?: string; // Twitter/X handle URL
  instagram?: string; // Instagram page URL
}

export interface Society {
  id: string;
  name: string;
  organization: string; // University, company, or club running this society
  city: string;
  country: string;
  description: string;
  privacy: SocietyPrivacy;
  logoURL: string;
  bannerURL: string;
  website: string;
  contactEmail: string;
  communityLinks?: CommunityLinks;
  memberCount: number;
  followerCount: number;
  isVerified: boolean;
  createdBy: string; // uid of creator (auto-becomes admin)
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export type PostType =
  | "announcement"
  | "event"
  | "hackathon"
  | "scholarship"
  | "internship";

export type PostVisibility = "public"; // All posts are public — member system removed

/** Structured metadata for posts */
export interface OpportunityMeta {
  deadline?: string;
  prize?: string;
  location?: string;
  skills?: string[];
  applyLink?: string;
  organizer?: string;
  country?: string;
}

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
  opportunityMeta?: OpportunityMeta; // Only on hackathon/scholarship/internship posts
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

// ─── Follow ───────────────────────────────────────────────────────────────────

export interface Follow {
  id: string;
  followerId: string;
  societyId: string;
  createdAt: Date;
}

// ─── Notifications ────────────────────────────────────────────────────────────
// Only 'new_post' actively triggers notifications (from followed societies).

export type NotificationType =
  | "new_post"
  | "post_like"
  | "post_comment"
  | "society_followed"
  | "system";

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

// ─── AI Chat ──────────────────────────────────────────────────────────────────
export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
