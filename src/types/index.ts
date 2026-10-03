// EduGlobe — Type Definitions

// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'viewer' | 'admin' | 'super_admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole | null;
  universityName: string;    // University/institution the user belongs to
  societyId: string | null;  // ID of the Academy they admin (null if viewer)
  bio: string;
  contactInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Society (Institute / Academy) ───────────────────────────────────────────

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

export type SocietyPrivacy = 'public';  // All societies are publicly discoverable

export interface Society {
  id: string;
  name: string;
  organization: string;   // University, company, or club running this society
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
  createdBy: string;        // uid of creator (auto-becomes admin)
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLink {
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'website' | 'youtube';
  url: string;
}


// ─── Posts ────────────────────────────────────────────────────────────────────

export type PostType =
  | 'announcement'
  | 'event'
  | 'achievement'
  | 'recruitment'
  | 'general'
  | 'hackathon'  
  | 'scholarship' 
  | 'internship';  

export type PostVisibility = 'public';  // All posts are public — member system removed

/** Structured metadata for hackathon / scholarship / internship posts */
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
  | 'new_post'       
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

// ─── AI Chat ──────────────────────────────────────────────────────────────────
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
