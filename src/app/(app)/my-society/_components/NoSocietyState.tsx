import Link from "next/link";
import { HiOutlineBuildingLibrary } from "react-icons/hi2";
import { FiPlus } from "react-icons/fi";

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
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(16,185,129,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary-400)",
          }}
        >
          <HiOutlineBuildingLibrary style={{ width: 28, height: 28 }} />
        </div>
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
        <Link href="/create-society" className="btn btn-primary inline-flex items-center gap-1.5">
          <FiPlus className="w-4 h-4" /> Create a society
        </Link>
      )}
    </div>
  );
}