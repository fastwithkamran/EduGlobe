"use client";

import { useId, useState } from "react";
import type { OpportunityMeta, PostType } from "@/types";

type MetaField = keyof OpportunityMeta;
type TextField = Exclude<MetaField, "skills">;

const FIELD_CONFIG: Record<
  Exclude<PostType, "announcement">,
  Array<{
    field: MetaField;
    label: string;
    placeholder?: string;
    type?: "date" | "url";
    wide?: boolean;
  }>
> = {
  event: [
    { field: "deadline", label: "Registration deadline", type: "date" },
    { field: "startDate", label: "Start date", type: "date" },
    { field: "endDate", label: "End date", type: "date" },
    {
      field: "location",
      label: "Location / mode",
      placeholder: "Online / Karachi / Remote",
    },
    { field: "country", label: "Country", placeholder: "Pakistan" },
    {
      field: "organizer",
      label: "Organizer",
      placeholder: "University or organization",
    },
    {
      field: "applyLink",
      label: "Registration link",
      placeholder: "https://...",
      type: "url",
      wide: true,
    },
  ],
  hackathon: [
    { field: "deadline", label: "Registration deadline", type: "date" },
    { field: "startDate", label: "Start date", type: "date" },
    { field: "endDate", label: "End date", type: "date" },
    {
      field: "prize",
      label: "Prize / reward",
      placeholder: "PKR 2.5M, USD 10K…",
    },
    {
      field: "location",
      label: "Location / mode",
      placeholder: "Online / Karachi / Remote",
    },
    {
      field: "skills",
      label: "Topics / skills",
      placeholder: "AI, web development, design",
      wide: true,
    },
    {
      field: "organizer",
      label: "Organizer",
      placeholder: "University or organization",
    },
    {
      field: "applyLink",
      label: "Registration link",
      placeholder: "https://...",
      type: "url",
      wide: true,
    },
  ],
  scholarship: [
    { field: "deadline", label: "Application deadline", type: "date" },
    {
      field: "funding",
      label: "Funding / benefits",
      placeholder: "Full tuition, stipend…",
    },
    {
      field: "eligibility",
      label: "Eligibility",
      placeholder: "Degree level, field, nationality…",
      wide: true,
    },
    { field: "country", label: "Country", placeholder: "Pakistan" },
    {
      field: "organizer",
      label: "Provider",
      placeholder: "University or organization",
    },
    {
      field: "applyLink",
      label: "Application link",
      placeholder: "https://...",
      type: "url",
      wide: true,
    },
  ],
  internship: [
    { field: "deadline", label: "Application deadline", type: "date" },
    {
      field: "location",
      label: "Location / mode",
      placeholder: "On-site / Hybrid / Remote",
    },
    {
      field: "eligibility",
      label: "Eligibility",
      placeholder: "Study level, field, requirements…",
      wide: true,
    },
    {
      field: "skills",
      label: "Skills",
      placeholder: "React, Python, data analysis",
      wide: true,
    },
    {
      field: "organizer",
      label: "Organization",
      placeholder: "Company or institution",
    },
    {
      field: "applyLink",
      label: "Application link",
      placeholder: "https://...",
      type: "url",
      wide: true,
    },
  ],
};

const MAX_SKILLS = 12;
const MAX_SKILL_LENGTH = 40;

function maxLengthFor(field: MetaField): number {
  switch (field) {
    case "applyLink":
    case "eligibility":
      return 500;
    case "skills":
      return 300;
    default:
      return 120;
  }
}

/** Split a comma-separated string into trimmed, non-empty items (no de-duping while typing). */
function parseSkills(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const skillsKey = (skills: unknown) =>
  (Array.isArray(skills) ? skills : []).join("\u0000");

/** De-duplicate (case-insensitive), trim, and cap the skills list. */
function cleanSkills(skills: unknown): string[] {
  const list = Array.isArray(skills)
    ? skills
    : typeof skills === "string"
      ? skills.split(",")
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const skill = item.trim().slice(0, MAX_SKILL_LENGTH);
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
    if (out.length >= MAX_SKILLS) break;
  }
  return out;
}

/**
 * Adds https:// when the user typed a bare domain ("example.com/apply").
 * Anything that already has "scheme://" is left alone so it can be validated.
 */
export function normalizeOpportunityLink(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
}

export function isValidOpportunityLink(value?: string): boolean {
  const link = normalizeOpportunityLink(value);
  if (!link) return true; // empty is fine; the link is optional
  try {
    const url = new URL(link);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      // "https://abc" is technically a URL but never a real application page
      url.hostname.includes(".") &&
      // blocks things like "mailto:a@b.com" turning into https://mailto:a@b.com
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function normalizeOpportunityMeta(
  meta: OpportunityMeta,
): OpportunityMeta {
  const clean = (value?: string) => value?.trim() || undefined;
  const skills = cleanSkills(meta.skills);
  const applyLink = normalizeOpportunityLink(meta.applyLink);
  return {
    ...(clean(meta.deadline) && { deadline: clean(meta.deadline) }),
    ...(clean(meta.startDate) && { startDate: clean(meta.startDate) }),
    ...(clean(meta.endDate) && { endDate: clean(meta.endDate) }),
    ...(clean(meta.prize) && { prize: clean(meta.prize) }),
    ...(clean(meta.funding) && { funding: clean(meta.funding) }),
    ...(clean(meta.eligibility) && { eligibility: clean(meta.eligibility) }),
    ...(clean(meta.location) && { location: clean(meta.location) }),
    ...(skills.length > 0 && { skills }),
    ...(applyLink && { applyLink }),
    ...(clean(meta.organizer) && { organizer: clean(meta.organizer) }),
    ...(clean(meta.country) && { country: clean(meta.country) }),
  };
}

/** Field-level problems, shown inline under the input. */
export function getOpportunityMetaErrors(
  meta: OpportunityMeta,
): Partial<Record<MetaField, string>> {
  const errors: Partial<Record<MetaField, string>> = {};
  if (!isValidOpportunityLink(meta.applyLink)) {
    errors.applyLink = "Enter a valid web address, like https://example.com/apply";
  }
  // yyyy-mm-dd strings compare correctly as text
  if (meta.startDate && meta.endDate && meta.endDate < meta.startDate) {
    errors.endDate = "End date can’t be before the start date";
  }
  return errors;
}

/** First error message, or null when the meta is OK to save. */
export function validateOpportunityMeta(meta: OpportunityMeta): string | null {
  const errors = Object.values(getOpportunityMetaErrors(meta));
  return errors[0] ?? null;
}

export function OpportunityMetaFields({
  type,
  value,
  onChange,
  disabled = false,
}: {
  type: PostType;
  value: OpportunityMeta;
  onChange: (meta: OpportunityMeta) => void;
  disabled?: boolean;
}) {
  const baseId = useId();

  // FIX: the old code trimmed and re-split on EVERY keystroke, so you could not
  // type a space ("Online" + " " became "Online" again) or a comma in the
  // skills field. Keep exactly what the user typed here and only clean it up
  // when the post is saved (normalizeOpportunityMeta).
  const [skillsDraft, setSkillsDraft] = useState(() =>
    Array.isArray(value.skills) ? value.skills.join(", ") : "",
  );
  const [syncedSkillsKey, setSyncedSkillsKey] = useState(() =>
    skillsKey(value.skills),
  );
  // If the parent replaces the skills (e.g. "Cancel" resets the form), follow it.
  if (skillsKey(value.skills) !== syncedSkillsKey) {
    setSyncedSkillsKey(skillsKey(value.skills));
    setSkillsDraft(Array.isArray(value.skills) ? value.skills.join(", ") : "");
  }

  // Hooks above must run on every render, so the early return comes after them.
  if (type === "announcement") return null;
  const fields = FIELD_CONFIG[type];
  if (!fields) return null;

  const errors = getOpportunityMetaErrors(value);

  const setText = (field: TextField, raw: string) => {
    const next: OpportunityMeta = { ...value };
    if (raw === "") delete next[field];
    else next[field] = raw;
    onChange(next);
  };

  const setSkills = (raw: string) => {
    const parsed = parseSkills(raw);
    const next: OpportunityMeta = { ...value };
    if (parsed.length > 0) next.skills = parsed;
    else delete next.skills;
    setSkillsDraft(raw);
    setSyncedSkillsKey(skillsKey(next.skills));
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {fields.map(({ field, label, placeholder, type: inputType, wide }) => {
        const isSkills = field === "skills";
        const rawValue = value[field];
        const fieldValue = isSkills
          ? skillsDraft
          : Array.isArray(rawValue)
            ? rawValue.join(", ")
            : (rawValue ?? "");
        const error = errors[field];
        const errorId = `${baseId}-${field}-error`;

        return (
          <label
            key={field}
            className={wide ? "sm:col-span-2" : undefined}
            style={{
              display: "block",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            {label}
            {isSkills && " (separate with commas)"}
            <input
              type={inputType ?? "text"}
              inputMode={inputType === "url" ? "url" : undefined}
              autoComplete="off"
              className="input w-full"
              placeholder={placeholder}
              value={fieldValue}
              disabled={disabled}
              maxLength={maxLengthFor(field)}
              min={field === "endDate" ? value.startDate || undefined : undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) =>
                isSkills
                  ? setSkills(event.target.value)
                  : setText(field as TextField, event.target.value)
              }
              // No inline fontSize: globals.css forces 16px on mobile so iOS
              // doesn't zoom on focus, and an inline size would override that.
              style={{ marginTop: 4 }}
            />
            {error && (
              <span id={errorId} role="alert" className="field-error" style={{ display: "block" }}>
                {error}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}