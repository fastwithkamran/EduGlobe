"use client";

import { TYPE_COLORS, TYPE_TEXTS, daysUntil } from "@/lib/postHelpers";
import type { OpportunityMeta, PostType } from "@/types";

/*
 * Shared opportunity metadata card — shown beneath post content
 * Used in both the global feed PostCard and the my-society SocietyPostCard.
 */
export function OpportunityCard({
  meta,
  type,
}: {
  meta: OpportunityMeta;
  type: PostType;
}) {
  const days = daysUntil(meta.deadline);

  const deadlineColor =
    days === null
      ? "var(--text-muted)"
      : days < 0
        ? "#9ca3af" // past
        : days <= 3
          ? "#ef4444" // urgent
          : days <= 7
            ? "#f97316" // soon
            : "#10b981"; // plenty of time

  const deadlineLabel =
    days === null
      ? ""
      : days < 0
        ? "Deadline passed"
        : days === 0
          ? "Deadline TODAY"
          : `${days}d left`;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "14px 16px",
        background: TYPE_COLORS[type],
        border: `1px solid ${TYPE_TEXTS[type]}30`,
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Top row: deadline + prize + location + country */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
        }}
      >
        {meta.deadline && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13 }}>⏰</span>
            <span
              style={{ fontSize: 12, fontWeight: 600, color: deadlineColor }}
            >
              {deadlineLabel}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              ·{" "}
              {new Date(meta.deadline).toLocaleDateString("en-PK", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        )}
        {meta.prize && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 13 }}>🏅</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>
              {meta.prize}
            </span>
          </div>
        )}
        {meta.location && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 12 }}>📍</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {meta.location}
            </span>
          </div>
        )}
        {meta.country && meta.country !== meta.location && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 12 }}>🌍</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {meta.country}
            </span>
          </div>
        )}
        {meta.organizer && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 12 }}>🏛</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {meta.organizer}
            </span>
          </div>
        )}
      </div>

      {/* Skills */}
      {meta.skills && meta.skills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {meta.skills.map((s) => (
            <span
              key={s}
              style={{
                fontSize: 11,
                padding: "2px 8px",
                background: `${TYPE_TEXTS[type]}18`,
                color: TYPE_TEXTS[type],
                borderRadius: 999,
                fontWeight: 500,
                border: `1px solid ${TYPE_TEXTS[type]}30`,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Apply button */}
      {meta.applyLink && (
        <a
          href={meta.applyLink}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 8,
            background: TYPE_TEXTS[type],
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
            alignSelf: "flex-start",
            opacity: 1,
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          🚀 Apply Now
        </a>
      )}
    </div>
  );
}
