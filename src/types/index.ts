// Opportune — Type Definitions

// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = "admin" | "super_admin";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole | null;
  universityName: string;
  societyId: string | null; // ID of the society they administer (null if none)
  bio: string;
  contactInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Society ──────────────────────────────────────────────────────────────────

export interface CommunityLinks {
  discord?: string;
  whatsapp?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
}

export interface Society {
  id: string;
  name: string;
  organization: string;
  city: string;
  country: string;
  description: string;
  logoURL: string;
  bannerURL: string;
  website: string;
  contactEmail: string;
  communityLinks?: CommunityLinks;
  followerCount: number;
  isVerified: boolean;
  createdBy: string; // uid of creator (auto-becomes admin)
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export type PostType =
  "announcement" | "event" | "hackathon" | "scholarship" | "internship";

/** Structured metadata for posts */
export interface OpportunityMeta {
  deadline?: string;
  startDate?: string;
  endDate?: string;
  prize?: string;
  funding?: string;
  eligibility?: string;
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
  attachments: PostAttachment[];
  likeCount: number;
  commentCount: number;
  likedBy: string[];
  opportunityMeta?: OpportunityMeta;
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

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedPostId?: string;
  relatedSocietyId?: string;
  createdAt: Date;
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────
export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
