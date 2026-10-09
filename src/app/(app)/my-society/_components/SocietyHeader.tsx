import Image from "next/image";
import { sanitizeImageUrl } from "@/lib/utils";
import type { Society } from "@/types";

export function SocietyHeader({ society }: { society: Society }) {
  // FIX: "📍 , " was rendered when city/country were missing.
  const location = [society.city, society.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

  return (
    <header
      style={{
        position: "relative",
        height: 160,
        flexShrink: 0,
        overflow: "hidden",
        background: "var(--gradient-hero)",
      }}
    >
      {/* FIX: banner used an unquoted CSS url(...) which breaks on URLs
          containing parentheses/quotes/spaces. next/image avoids that. */}
      {society.bannerURL && (
        <Image
          src={sanitizeImageUrl(society.bannerURL)}
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
      )}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, transparent 40%, rgba(6,11,24,0.9))",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "0 var(--page-padding-x) 16px",
          display: "flex",
          alignItems: "flex-end",
          gap: 16,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 72,
            height: 72,
            borderRadius: 14,
            background: "var(--gradient-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            overflow: "hidden",
            flexShrink: 0,
            border: "3px solid rgba(255,255,255,0.1)",
          }}
        >
          {society.logoURL ? (
            <Image
              src={sanitizeImageUrl(society.logoURL)}
              alt={`${society.name} logo`}
              fill
              sizes="72px"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <span aria-hidden="true">🌐</span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 20,
                fontWeight: 800,
                color: "#fff",
                margin: 0,
                overflowWrap: "anywhere",
              }}
            >
              {society.name}
            </h1>
            {society.isVerified && (
              <span
                style={{
                  background: "rgba(16,185,129,0.2)",
                  color: "#10b981",
                  border: "1px solid rgba(16,185,129,0.3)",
                  padding: "1px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                ✓ Verified
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.75)",
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {society.organization && <span>{society.organization}</span>}
            {location && <span>📍 {location}</span>}
          </div>
        </div>
      </div>
    </header>
  );
}