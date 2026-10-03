// ============================================================
// EduGlobe — Post Helper Utilities
// Shared across society feed, global feed, and post cards.
// ============================================================

import type { PostType } from '@/types';

/** Convert a Firestore Timestamp or Date to a human-readable relative string */
export function timeAgo(date: unknown): string {
  if (!date) return 'just now';
  const d = (date as { toDate?: () => Date }).toDate?.() ?? new Date(date as string | number);
  if (isNaN(d.getTime())) return 'just now';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60)      return 'just now';
  if (s < 3_600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400)  return `${Math.floor(s / 3_600)}h ago`;
  if (s < 604_800) return `${Math.floor(s / 86_400)}d ago`;
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

/** Get 2-letter initials from a display name */
export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Background tint per post type */
export const TYPE_COLORS: Record<PostType, string> = {
  announcement: 'rgba(96,165,250,0.15)',
  event:        'rgba(16,185,129,0.15)',
  achievement:  'rgba(251,191,36,0.15)',
  recruitment:  'rgba(139,92,246,0.15)',
  general:      'rgba(107,114,128,0.15)',
  hackathon:    'rgba(168,85,247,0.18)',
  scholarship:  'rgba(245,158,11,0.15)',
  internship:   'rgba(6,182,212,0.15)',
};

/** Accent text color per post type */
export const TYPE_TEXTS: Record<PostType, string> = {
  announcement: '#60a5fa',
  event:        '#10b981',
  achievement:  '#fbbf24',
  recruitment:  '#a78bfa',
  general:      '#9ca3af',
  hackathon:    '#a855f7',
  scholarship:  '#f59e0b',
  internship:   '#06b6d4',
};

/** Post type dropdown options — includes opportunity types */
export const POST_TYPE_OPTIONS: Array<{ value: PostType; label: string }> = [
  { value: 'announcement', label: '📢 Announcement' },
  { value: 'event',        label: '📅 Event'        },
  { value: 'achievement',  label: '🏆 Achievement'  },
  { value: 'recruitment',  label: '🎯 Recruitment'  },
  { value: 'general',      label: '💬 General'      },
  { value: 'hackathon',    label: '💻 Hackathon'    },
  { value: 'scholarship',  label: '🎓 Scholarship'  },
  { value: 'internship',   label: '💼 Internship'   },
];

/** Post types that carry opportunity metadata (deadline, apply link, etc.) */
export const OPPORTUNITY_TYPES: PostType[] = ['hackathon', 'scholarship', 'internship'];
