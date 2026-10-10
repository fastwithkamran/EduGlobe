import Image from "next/image";
import { sanitizeImageUrl } from "@/lib/utils";
import type { Society } from "@/types";
import { FiMapPin, FiHeart } from "react-icons/fi";
import { HiOutlineBuildingLibrary, HiCheckBadge } from "react-icons/hi2";

export function SocietyHeader({ society }: { society: Society }) {
  const location = [society.city, society.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

  return (
    <header className="flex-shrink-0 bg-[var(--bg-secondary)]">
      {/* ── Banner Canvas ─────────────────────────────────────────── */}
      <div className="relative h-44 w-full overflow-hidden bg-[var(--gradient-hero)] sm:h-56 md:h-64">
        {society.bannerURL && (
          <Image
            src={sanitizeImageUrl(society.bannerURL)}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
      </div>

      {/* ── Profile Info Bar (Overlapping Logo + Details) ─────────── */}
      <div className="px-[var(--page-padding-x)] pb-4">
        {/* Overlapping Logo */}
        <div className="relative -mt-10 mb-3 flex items-end justify-between sm:-mt-14">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-[var(--bg-secondary)] bg-[var(--gradient-primary)] shadow-md sm:h-28 sm:w-28 sm:rounded-3xl">
            {society.logoURL ? (
              <Image
                src={sanitizeImageUrl(society.logoURL)}
                alt={`${society.name} logo`}
                fill
                sizes="(max-width: 640px) 80px, 112px"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-white">
                <HiOutlineBuildingLibrary className="h-8 w-8 sm:h-12 sm:w-12" />
              </div>
            )}
          </div>
        </div>

        {/* Identity & Metadata */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="m-0 break-words text-xl font-extrabold text-[var(--text-primary)] sm:text-2xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {society.name}
            </h1>
            {society.isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-500">
                <HiCheckBadge className="h-3.5 w-3.5 text-emerald-500" />
                Verified
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
            {society.organization && (
              <span className="font-medium text-[var(--text-secondary)]">
                {society.organization}
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1">
                <FiMapPin className="h-3.5 w-3.5 opacity-80" />
                {location}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
              <FiHeart className="h-3 w-3 text-rose-500" />
              {society.followerCount} followers
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}