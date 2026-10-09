import Link from "next/link";

export function NoSocietyState({
  missingSociety = false,
}: {
  missingSociety?: boolean;
}) {
  return (
    <div
      style={{
        padding: "40px 28px",
        textAlign: "center",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 16 }}>
        🏛️
      </div>
      <h1
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 20,
          fontWeight: 800,
          marginBottom: 8,
          color: "var(--text-primary)",
        }}
      >
        {missingSociety ? "Society not found" : "No society yet"}
      </h1>
      <p
        style={{
          color: "var(--text-tertiary)",
          fontSize: 13,
          lineHeight: 1.6,
          marginBottom: 24,
        }}
      >
        {missingSociety
          ? "The society linked to your account could not be found. Return to the feed or contact support."
          : "You don’t manage a society yet. Create one to share opportunities, events, and updates with the Opportune community."}
      </p>
      {missingSociety ? (
        <Link href="/feed" className="btn btn-outline">
          Return to feed
        </Link>
      ) : (
        <Link href="/create-society" className="btn btn-primary">
          + Create a society
        </Link>
      )}
    </div>
  );
}