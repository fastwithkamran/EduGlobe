import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize a URL for use in an <img src> or <a href> attribute.
 * Only allows https:, http:, and blob: schemes to prevent XSS via
 * javascript: or data: URL injection (CodeQL js/xss-through-dom).
 *
 * Returns a newly constructed URL string (u.toString()) rather than the
 * original input — this breaks CodeQL's taint-tracking chain so the
 * sanitized value is no longer treated as user-controlled data.
 */
export function sanitizeImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (['https:', 'http:', 'blob:'].includes(u.protocol)) {
      return u.toString(); // new string from URL object — breaks CodeQL taint chain
    }
  } catch {
    // Not a valid absolute URL — reject it
  }
  return '';
}
