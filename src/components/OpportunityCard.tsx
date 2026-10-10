import {
  FiClock,
  FiCalendar,
  FiAward,
  FiMapPin,
  FiGlobe,
  FiExternalLink,
} from "react-icons/fi";
import { HiOutlineAcademicCap, HiOutlineBuildingLibrary } from "react-icons/hi2";
import {
  daysUntil,
  formatOpportunityDate,
  safeExternalUrl,
  TYPE_COLORS,
  TYPE_TEXTS,
} from "@/lib/postHelpers";
import type { OpportunityMeta, PostType } from "@/types";

function getDeadlinePresentation(deadline?: string) {
  const days = daysUntil(deadline);
  if (days === null) {
    return { color: "var(--text-muted)", label: "Deadline" };
  }
  if (days < 0) return { color: "#9ca3af", label: "Deadline passed" };
  if (days === 0) return { color: "#ef4444", label: "Deadline today" };
  if (days <= 3) return { color: "#ef4444", label: `${days}d left` };
  if (days <= 7) return { color: "#f97316", label: `${days}d left` };
  return { color: "#10b981", label: `${days}d left` };
}

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
    <div className="flex min-w-0 max-w-full items-center gap-1.5">
      <span aria-hidden="true" className="shrink-0 text-[13px] flex items-center">
        {icon}
      </span>
      <span
        className="min-w-0 break-words text-xs leading-normal"
        style={{
          color: color ?? "var(--text-secondary)",
          fontWeight: emphasized ? 700 : 400,
        }}
      >
        {children}
      </span>
    </div>
  );
}

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
  const applyLink = safeExternalUrl(meta.applyLink);
  const actionLabel =
    type === "event" || type === "hackathon" ? "Register" : "Apply Now";
  const skills = [
    ...new Set(meta.skills?.map((skill) => skill.trim()).filter(Boolean)),
  ];
  const color = TYPE_TEXTS[type];

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
            {startDate && endDate
              ? `${startDate} – ${endDate}`
              : (startDate ?? endDate)}
          </MetadataItem>
        )}
        {meta.prize && (
          <MetadataItem
            icon={<FiAward className="w-3.5 h-3.5" />}
            emphasized
            color="#fbbf24"
          >
            {meta.prize}
          </MetadataItem>
        )}
        {meta.funding && (
          <MetadataItem
            icon={<HiOutlineAcademicCap className="w-3.5 h-3.5" />}
            emphasized
            color="#fbbf24"
          >
            {meta.funding}
          </MetadataItem>
        )}
        {meta.location && (
          <MetadataItem icon={<FiMapPin className="w-3.5 h-3.5" />}>
            {meta.location}
          </MetadataItem>
        )}
        {meta.country && meta.country !== meta.location && (
          <MetadataItem icon={<FiGlobe className="w-3.5 h-3.5" />}>
            {meta.country}
          </MetadataItem>
        )}
        {meta.organizer && (
          <MetadataItem icon={<HiOutlineBuildingLibrary className="w-3.5 h-3.5" />}>
            {meta.organizer}
          </MetadataItem>
        )}
      </div>

      {skills.length > 0 && (
        <ul
          className="m-0 flex list-none flex-wrap gap-2 p-0"
          aria-label={type === "event" ? "Topics" : "Skills and topics"}
        >
          {skills.map((skill, index) => (
            <li
              key={`${skill}-${index}`}
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
          className="mt-1 inline-flex min-h-9 self-start items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold shadow-sm transition-opacity hover:opacity-90"
          style={{ background: color, color: "#ffffff" }}
        >
          <FiExternalLink className="w-4 h-4" /> {actionLabel}
        </a>
      )}
    </section>
  );
}
