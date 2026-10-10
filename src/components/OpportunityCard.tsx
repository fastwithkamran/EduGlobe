import {
  FiClock,
  FiCalendar,
  FiAward,
  FiMapPin,
  FiGlobe,
  FiExternalLink,
} from "react-icons/fi";
import {
  HiOutlineAcademicCap,
  HiOutlineBuildingLibrary,
} from "react-icons/hi2";
import {
  daysUntil,
  formatOpportunityDate,
  safeExternalUrl,
  TYPE_COLORS,
  TYPE_TEXTS,
} from "@/lib/postHelpers";
import type { OpportunityMeta, PostType } from "@/types";

/**
 * Visual badge and urgency styling for opportunity deadlines.
 */
function getDeadlinePresentation(deadline?: string) {
  const days = daysUntil(deadline);
  if (days === null) {
    return {
      color: "var(--text-muted, #475569)",
      label: "Deadline",
      closed: false,
    };
  }
  if (days < 0) {
    return {
      color: "var(--text-muted, #475569)",
      label: "Deadline passed",
      closed: true,
    };
  }
  if (days === 0) {
    return {
      color: "var(--danger-text, #b91c1c)",
      label: "Deadline today",
      closed: false,
    };
  }
  if (days <= 3) {
    return {
      color: "var(--danger-text, #b91c1c)",
      label: `${days}d left`,
      closed: false,
    };
  }
  if (days <= 7) {
    return {
      color: "var(--warning-text, #c2410c)",
      label: `${days}d left`,
      closed: false,
    };
  }
  return {
    color: "var(--success-text, #047857)",
    label: `${days}d left`,
    closed: false,
  };
}

/**
 * Normalizes raw skills input from an array or comma-separated string into unique, trimmed values.
 */
function normalizeSkills(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const skill = item.trim();
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}

/**
 * Individual opportunity metadata row item (icon + label) with theme-aware contrast.
 */
function MetadataItem({
  icon,
  children,
  emphasized = false,
  color,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  emphasized?: boolean;
  color?: string;
}) {
  return (
    <div
      className="flex min-w-0 max-w-full items-center gap-1.5"
      style={{ color: color ?? "var(--text-primary, #0f172a)" }}
    >
      <span
        aria-hidden="true"
        className="shrink-0 text-[13px] flex items-center opacity-85"
      >
        {icon}
      </span>
      <span
        className="min-w-0 break-words text-xs leading-normal"
        style={{ fontWeight: emphasized ? 700 : 500 }}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * Embedded card displaying structured opportunity metadata (deadlines, dates, prize, location, topics, and apply action).
 */
export function OpportunityCard({
  meta,
  type,
}: {
  meta: OpportunityMeta;
  type: PostType;
}) {
  const deadline = formatOpportunityDate(meta.deadline);
  const deadlinePresentation = getDeadlinePresentation(meta.deadline);
  const startDate = formatOpportunityDate(meta.startDate);
  const endDate = formatOpportunityDate(meta.endDate);
  const sameDay = !!startDate && startDate === endDate;
  const applyLink = safeExternalUrl(meta.applyLink);
  const skills = normalizeSkills(meta.skills);
  const color = TYPE_TEXTS[type];
  const showCountry =
    !!meta.country &&
    meta.country.trim().toLowerCase() !==
      (meta.location ?? "").trim().toLowerCase();

  const actionLabel = deadlinePresentation.closed
    ? "View details"
    : type === "event" || type === "hackathon"
      ? "Register"
      : "Apply now";

  return (
    <section
      aria-label={`${type.charAt(0).toUpperCase()}${type.slice(1)} details`}
      className="mt-3 flex w-full min-w-0 flex-col gap-3 rounded-2xl p-4 sm:p-5"
      style={{
        background: TYPE_COLORS[type],
        border: `1px solid ${color}35`,
      }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {deadline && (
          <MetadataItem
            icon={<FiClock className="w-3.5 h-3.5" />}
            emphasized
            color={deadlinePresentation.color}
          >
            {deadlinePresentation.label} · {deadline}
          </MetadataItem>
        )}
        {(startDate || endDate) && (
          <MetadataItem icon={<FiCalendar className="w-3.5 h-3.5" />}>
            {startDate && endDate && !sameDay
              ? `${startDate} – ${endDate}`
              : (startDate ?? endDate)}
          </MetadataItem>
        )}
        {meta.prize && (
          <MetadataItem
            icon={<FiAward className="w-3.5 h-3.5" />}
            emphasized
            color="var(--text-gold, #b45309)"
          >
            {meta.prize}
          </MetadataItem>
        )}
        {meta.funding && (
          <MetadataItem
            icon={<HiOutlineAcademicCap className="w-3.5 h-3.5" />}
            emphasized
            color="var(--text-gold, #b45309)"
          >
            {meta.funding}
          </MetadataItem>
        )}
        {meta.location && (
          <MetadataItem icon={<FiMapPin className="w-3.5 h-3.5" />}>
            {meta.location}
          </MetadataItem>
        )}
        {showCountry && (
          <MetadataItem icon={<FiGlobe className="w-3.5 h-3.5" />}>
            {meta.country}
          </MetadataItem>
        )}
        {meta.organizer && (
          <MetadataItem
            icon={<HiOutlineBuildingLibrary className="w-3.5 h-3.5" />}
          >
            {meta.organizer}
          </MetadataItem>
        )}
      </div>

      {skills.length > 0 && (
        <ul
          className="m-0 flex list-none flex-wrap gap-2 p-0"
          aria-label={type === "event" ? "Topics" : "Skills and topics"}
        >
          {skills.map((skill) => (
            <li
              key={skill.toLowerCase()}
              className="rounded-full px-3 py-1 text-[11px] sm:text-xs font-medium leading-normal break-words"
              style={{
                background: `${color}18`,
                color,
                border: `1px solid ${color}30`,
              }}
            >
              {skill}
            </li>
          ))}
        </ul>
      )}

      {meta.eligibility && (
        <p className="m-0 break-words text-xs leading-relaxed text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">Eligibility:</strong>{" "}
          {meta.eligibility}
        </p>
      )}

      {applyLink && (
        <a
          href={applyLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn btn-sm self-start ${
            deadlinePresentation.closed ? "btn-outline" : "btn-primary"
          }`}
        >
          <FiExternalLink className="w-4 h-4" aria-hidden="true" />{" "}
          {actionLabel}
        </a>
      )}
    </section>
  );
}
