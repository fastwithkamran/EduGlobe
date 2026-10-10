"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiTrash2,
  FiImage,
  FiPaperclip,
  FiCalendar,
  FiCode,
  FiBriefcase,
  FiFileText,
} from "react-icons/fi";
import { HiOutlineAcademicCap, HiOutlineMegaphone } from "react-icons/hi2";
import {
  POST_TYPE_OPTIONS,
  TYPE_COLORS,
  TYPE_TEXTS,
} from "@/lib/postHelpers";
import { sanitizeImageUrl } from "@/lib/utils";
import type { OpportunityMeta, Post, PostType } from "@/types";

/* ─── Small helpers ──────────────────────────────────────────────────────── */

/** Only ever link to http(s) URLs. Document links must NOT go through the image sanitizer. */
export function safeHref(value: string | undefined | null): string | undefined {
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

export const plural = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

/** First `max` characters without splitting an emoji / surrogate pair in half. */
export function truncateChars(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : text;
}

/** True when the meta object holds at least one real value. */
export function hasOpportunityMeta(meta?: OpportunityMeta | null): boolean {
  if (!meta) return false;
  return Object.values(meta).some((v) =>
    Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v != null,
  );
}

export function getPostTypeLabel(type: PostType): string {
  return POST_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

/* ─── Type badge ─────────────────────────────────────────────────────────── */

const TYPE_ICONS: Record<
  PostType,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  announcement: HiOutlineMegaphone,
  event: FiCalendar,
  hackathon: FiCode,
  scholarship: HiOutlineAcademicCap,
  internship: FiBriefcase,
};

export function PostTypeBadge({ type }: { type: PostType }) {
  const Icon = TYPE_ICONS[type] ?? FiFileText;
  return (
    <span
      style={{
        background: TYPE_COLORS[type],
        color: TYPE_TEXTS[type],
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Icon style={{ width: 12, height: 12 }} aria-hidden="true" />
      {getPostTypeLabel(type)}
    </span>
  );
}

/* ─── Confirm delete modal ───────────────────────────────────────────────── */

export function ConfirmDeleteModal({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the safe option when the modal opens, restore focus on close
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  // Escape closes (unless a delete is in flight); Tab is trapped inside the
  // dialog because aria-modal alone doesn't stop focus escaping behind it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      );
      if (!focusable || focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onCancel]);

  return createPortal(
    <div
      onClick={() => {
        if (!loading) onCancel(); // backdrop click must not dismiss mid-delete
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        // FIX: was 9999, which sat ABOVE the toaster (z 300), so the
        // "Failed to delete" toast rendered underneath the backdrop.
        zIndex: "var(--z-modal)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-post-title"
        aria-describedby="delete-post-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 16,
          padding: "28px 24px",
          width: 400,
          maxWidth: "100%",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.1)",
            border: "2px solid rgba(239,68,68,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <FiTrash2 style={{ width: 24, height: 24, color: "var(--danger-text)" }} />
        </div>
        <h2
          id="delete-post-title"
          style={{
            fontSize: "var(--text-xl)",
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Delete post?
        </h2>
        <p
          id="delete-post-desc"
          style={{
            fontSize: 13,
            textAlign: "center",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {message}
          <br />
          <strong style={{ color: "var(--danger-text)" }}>
            This can’t be undone.
          </strong>
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            type="button"
            ref={cancelRef}
            className="btn btn-outline"
            onClick={onCancel}
            disabled={loading}
            style={{ minWidth: 90 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={loading}
            onClick={onConfirm}
            style={{ minWidth: 120 }}
          >
            {loading ? (
              "Deleting…"
            ) : (
              <>
                <FiTrash2 style={{ width: 14, height: 14 }} aria-hidden="true" />{" "}
                Delete post
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Image with skeleton ────────────────────────────────────────────────── */

export function ImageWithSkeleton({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // FIX: an image that finishes loading (e.g. from cache) before React
  // hydrates never fires onLoad, so it stayed at opacity 0 forever.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) {
      if (img.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    }
  }, []);

  if (failed) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border-primary)",
          borderRadius: 8,
          color: "var(--text-secondary)",
          fontSize: 12,
        }}
      >
        <FiImage style={{ width: 14, height: 14 }} aria-hidden="true" />{" "}
        {alt || "Image"} (preview unavailable, open image)
      </a>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        borderRadius: 8,
        overflow: "hidden",
        display: "block",
        maxWidth: "100%",
        width: 280,
        border: "1px solid var(--border-primary)",
        position: "relative",
        // Reserve space until the image arrives so the feed doesn't jump.
        aspectRatio: loaded ? undefined : "16 / 9",
      }}
    >
      {!loaded && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--bg-tertiary)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      )}
      {/* `unoptimized`: attachment hosts are user-supplied, so they can't all be
          whitelisted in next.config `images.remotePatterns`. */}
      <Image
        ref={imgRef}
        src={src}
        alt={alt}
        width={0}
        height={0}
        sizes="(max-width: 480px) 100vw, 280px"
        unoptimized
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity .3s",
        }}
      />
    </a>
  );
}

/* ─── Attachment list (used by BOTH cards) ───────────────────────────────── */

type Attachment = NonNullable<Post["attachments"]>[number];

export function AttachmentList({
  attachments,
}: {
  attachments: Attachment[];
}) {
  const items: { att: Attachment; href: string; isImage: boolean }[] = [];
  for (const att of attachments) {
    const isImage = !!att.fileType?.startsWith("image/");
    const href = isImage ? sanitizeImageUrl(att.fileURL) : safeHref(att.fileURL);
    // A missing/invalid URL used to reach next/image (which throws on an
    // empty src) and take down the whole feed.
    if (href) items.push({ att, href, isImage });
  }
  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map(({ att, href, isImage }) =>
        isImage ? (
          <ImageWithSkeleton key={att.id} src={href} alt={att.fileName ?? ""} />
        ) : (
          <a
            key={att.id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={att.fileName}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-primary)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 12,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <FiPaperclip
              style={{ width: 13, height: 13, flexShrink: 0 }}
              aria-hidden="true"
            />
            {att.fileName || "Attachment"}
          </a>
        ),
      )}
    </div>
  );
}