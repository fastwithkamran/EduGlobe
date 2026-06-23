import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize a URL for use in an <img src> attribute.
 * Only allows https:, http:, and blob: schemes to prevent XSS via
 * javascript: or data: URL injection (CodeQL js/xss-through-dom).
 */
export function sanitizeImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (['https:', 'http:', 'blob:'].includes(parsed.protocol)) {
      return url;
    }
  } catch {
    // Not a valid absolute URL — reject it
  }
  return '';
}
