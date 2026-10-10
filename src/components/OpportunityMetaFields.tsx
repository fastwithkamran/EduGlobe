"use client";

import type { OpportunityMeta, PostType } from "@/types";

type MetaField = keyof OpportunityMeta;

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

function cleanMetaValue(
  field: MetaField,
  value: string,
): string | string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (field === "skills") {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return trimmed;
}

export function normalizeOpportunityMeta(
  meta: OpportunityMeta,
): OpportunityMeta {
  const clean = (value?: string) => value?.trim() || undefined;
  const skills = meta.skills?.map((skill) => skill.trim()).filter(Boolean);
  return {
    ...(clean(meta.deadline) && { deadline: clean(meta.deadline) }),
    ...(clean(meta.startDate) && { startDate: clean(meta.startDate) }),
    ...(clean(meta.endDate) && { endDate: clean(meta.endDate) }),
    ...(clean(meta.prize) && { prize: clean(meta.prize) }),
    ...(clean(meta.funding) && { funding: clean(meta.funding) }),
    ...(clean(meta.eligibility) && { eligibility: clean(meta.eligibility) }),
    ...(clean(meta.location) && { location: clean(meta.location) }),
    ...(skills?.length && { skills }),
    ...(clean(meta.applyLink) && { applyLink: clean(meta.applyLink) }),
    ...(clean(meta.organizer) && { organizer: clean(meta.organizer) }),
    ...(clean(meta.country) && { country: clean(meta.country) }),
  };
}

export function isValidOpportunityLink(value?: string): boolean {
  if (!value?.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
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
  if (type === "announcement") return null;

  const fields = FIELD_CONFIG[type];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {fields.map(({ field, label, placeholder, type: inputType, wide }) => {
        const rawValue = value[field];
        const fieldValue = Array.isArray(rawValue)
          ? rawValue.join(", ")
          : (rawValue ?? "");

        return (
          <label
            key={field}
            className={wide ? "sm:col-span-2" : undefined}
            style={{
              display: "block",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            {label}
            <input
              type={inputType ?? "text"}
              className="input w-full"
              placeholder={placeholder}
              value={fieldValue}
              disabled={disabled}
              onChange={(event) => {
                const nextValue = cleanMetaValue(field, event.target.value);
                const next = { ...value };
                if (field === "skills") {
                  if (Array.isArray(nextValue)) next.skills = nextValue;
                  else delete next.skills;
                } else {
                  const text =
                    typeof nextValue === "string" ? nextValue : undefined;
                  switch (field) {
                    case "deadline":
                      next.deadline = text;
                      break;
                    case "startDate":
                      next.startDate = text;
                      break;
                    case "endDate":
                      next.endDate = text;
                      break;
                    case "prize":
                      next.prize = text;
                      break;
                    case "funding":
                      next.funding = text;
                      break;
                    case "eligibility":
                      next.eligibility = text;
                      break;
                    case "location":
                      next.location = text;
                      break;
                    case "applyLink":
                      next.applyLink = text;
                      break;
                    case "organizer":
                      next.organizer = text;
                      break;
                    case "country":
                      next.country = text;
                      break;
                  }
                }
                onChange(next);
              }}
              style={{ fontSize: 12, marginTop: 4 }}
            />
          </label>
        );
      })}
    </div>
  );
}
