// ============================================================
// Opportune — Post Helper Utilities
// Shared across society feed, global feed, and post cards.
// ============================================================

import type { PostType } from "@/types";

/** Convert a Firestore Timestamp or Date to a human-readable relative string */
export function timeAgo(date: unknown): string {
  if (!date) return "just now";
  const d =
    (date as { toDate?: () => Date }).toDate?.() ??
    new Date(date as string | number);
  if (Number.isNaN(d.getTime())) return "just now";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3_600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  if (s < 604_800) return `${Math.floor(s / 86_400)}d ago`;
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

/** Get 2-letter initials from a display name */
export function getInitials(name?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  // First + LAST name ("John Michael Smith" → "JS", not "JM").
  // Array.from keeps emoji / astral characters intact (w[0] would split them).
  const first = Array.from(words[0] ?? "")[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1]!)[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Background tint per post type */
export const TYPE_COLORS: Record<PostType, string> = {
  announcement: "rgba(96,165,250,0.15)",
  event: "rgba(16,185,129,0.15)",
  hackathon: "rgba(168,85,247,0.18)",
  scholarship: "rgba(245,158,11,0.15)",
  internship: "rgba(6,182,212,0.15)",
};

/** Accent text color per post type */
export const TYPE_TEXTS: Record<PostType, string> = {
  announcement: "#60a5fa",
  event: "#10b981",
  hackathon: "#a855f7",
  scholarship: "#f59e0b",
  internship: "#06b6d4",
};

/** Post type dropdown options — includes opportunity types */
export const POST_TYPE_OPTIONS: Array<{ value: PostType; label: string }> = [
  { value: "announcement", label: "Announcement" },
  { value: "event", label: "Event" },
  { value: "hackathon", label: "Hackathon" },
  { value: "scholarship", label: "Scholarship" },
  { value: "internship", label: "Internship" },
];

/** Fallback emoji icon per post type (prefer React Icons in UI components) */
export const TYPE_EMOJI: Record<PostType, string> = {
  announcement: "",
  event: "",
  hackathon: "",
  scholarship: "",
  internship: "",
};

/** Days remaining until a deadline string, or null if not set.
 *  Negative = past, 0 = today */
export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const today = new Date();
  const currentDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  return Math.round((targetDay - currentDay) / 86_400_000);
}

/** Format a YYYY-MM-DD value as a date without timezone-induced day shifts. */
export function formatOpportunityDate(value?: string): string | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Return only absolute HTTP(S) URLs suitable for external links. */
export function safeExternalUrl(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // Organizers often paste "example.com/apply" without a scheme. A scheme is
  // "word:" NOT followed by a digit (that would be a port, e.g. example.com:8080).
  const hasScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // Reject scheme-less junk like "hello" that would become https://hello/
    if (!hasScheme && !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Post types that carry opportunity metadata */
export const OPPORTUNITY_TYPES: PostType[] = [
  "event",
  "hackathon",
  "scholarship",
  "internship",
];