/**
 * Shared URL helpers. Previously CreateSocietyPage, AboutTab and
 * SocietyPostCard each had their own slightly different copy, and they
 * disagreed (e.g. "example.com:8080" was rejected on save but accepted on
 * display). Keep ONE implementation so what is saved is what is rendered.
 */

/**
 * Returns a normalised http(s) URL, or null when the value is empty/invalid.
 * - Adds https:// when no scheme is given ("discord.gg/abc").
 * - Rejects javascript:, data:, ftp:, mailto: etc.
 * - Still accepts "host.com:8080/path" (a host:port is not a scheme).
 * - Rejects embedded credentials ("https://user:pass@host").
 */
export function normalizeHttpUrl(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const isHttp = /^https?:\/\//i.test(value);
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  const looksLikeHostPort = /^[^\s/:?#]+:\d+(?:[/?#]|$)/.test(value);
  if (hasScheme && !isHttp && !looksLikeHostPort) return null;

  try {
    const url = new URL(isHttp ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Only ever returns http(s) URLs (for stored file/document links). */
export function safeHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/** "https://example.com/" -> "example.com" */
export const displayUrl = (url: string) =>
  url.replace(/^https?:\/\//, "").replace(/\/$/, "");
