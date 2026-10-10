"use client";

const pulse = "pulse 1.5s ease-in-out infinite";

function Bar({
  width = "100%",
  height = 12,
  mb = 0,
}: {
  width?: string | number;
  height?: number;
  mb?: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        width,
        marginBottom: mb,
        background: "var(--bg-tertiary)",
        borderRadius: 6,
        animation: pulse,
      }}
    />
  );
}

/** Skeleton placeholder cards shown while the feed is loading */
export function FeedSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading posts…</span>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-xl)",
            padding: 20,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: "50%",
                background: "var(--bg-tertiary)",
                animation: pulse,
              }}
            />
            <div style={{ flex: 1 }}>
              <Bar width="40%" mb={6} />
              <Bar width="25%" height={10} />
            </div>
          </div>
          <Bar mb={8} />
          <Bar width="80%" mb={8} />
          <Bar width="60%" />
        </div>
      ))}
    </div>
  );
}
