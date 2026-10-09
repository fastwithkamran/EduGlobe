"use client";

import Image from "next/image";
import { sanitizeImageUrl } from "@/lib/utils";
import type { Society } from "@/types";

export function SocietyRow({
  society,
  onDelete,
  deleteDisabled,
}: {
  society: Society;
  onDelete: () => void;
  deleteDisabled: boolean;
}) {
  const location = [society.city, society.country].filter(Boolean).join(", ");

  return (
    <article className="flex min-w-0 flex-wrap items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--border-primary)] bg-[var(--bg-card)] p-3 transition-colors hover:border-white/15 sm:flex-nowrap sm:gap-4 sm:px-5 sm:py-4">
      <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--gradient-primary)] text-lg font-bold text-white">
        {society.logoURL ? (
          <Image
            src={sanitizeImageUrl(society.logoURL)}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          society.name.slice(0, 2).toUpperCase()
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2
            className="m-0 break-words text-sm font-bold text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {society.name}
          </h2>
          {society.isVerified && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
              ✓ Verified
            </span>
          )}
        </div>
        {(society.organization || location) && (
          <p className="mb-1 truncate text-xs text-[var(--text-tertiary)]">
            {society.organization}
            {society.organization && location ? " · " : ""}
            {location}
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 text-[11px] text-[var(--text-muted)]">
          <span>❤️ {society.followerCount} followers</span>
          <span className="font-mono text-[10px]">
            ID: {society.id.slice(0, 8)}…
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onDelete}
        disabled={deleteDisabled}
        aria-label={`Delete ${society.name}`}
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3.5 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
      >
        🗑️ Delete
      </button>
    </article>
  );
}
