import type { CommunityLinks } from "@/types";
import {
  FaDiscord,
  FaWhatsapp,
  FaLinkedinIn,
  FaXTwitter,
  FaInstagram,
} from "react-icons/fa6";

export interface SocietyFormValues {
  name: string;
  organization: string;
  city: string;
  country: string;
  description: string;
  website: string;
  contactEmail: string;
  communityLinks: Record<keyof CommunityLinks, string>;
}

export type BasicField =
  "name" | "organization" | "city" | "country" | "description";
export type ContactField = "website" | "contactEmail";

/** Keys are field keys ("name", "website", "community.discord", ...). */
export type FormErrors = Partial<Record<string, string>>;

export const LIMITS = {
  name: 80,
  organization: 120,
  city: 60,
  country: 60,
  description: 1000,
  url: 300,
  email: 254,
} as const;

/** DOM id for a field key, so the page can focus the first invalid field. */
export function fieldId(key: string): string {
  switch (key) {
    case "contactEmail":
      return "society-contact-email";
    case "name":
    case "organization":
    case "city":
    case "country":
    case "description":
    case "website":
      return `society-${key}`;
    default:
      return `community-${key.replace("community.", "")}`;
  }
}

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-primary)",
  borderRadius: "var(--radius-xl)",
  overflow: "hidden",
  marginBottom: 16,
};

const heading: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid var(--border-primary)",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
  fontFamily: "var(--font-heading)",
  letterSpacing: 0,
};

const sectionBody: React.CSSProperties = { padding: 20 };
const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
};
const fieldGap: React.CSSProperties = { marginBottom: 14 };
const optionalNote: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: "var(--text-muted)",
};

const COMMUNITY_LINKS: {
  key: keyof CommunityLinks;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "discord",
    icon: FaDiscord,
    label: "Discord Server",
    placeholder: "https://discord.gg/...",
  },
  {
    key: "whatsapp",
    icon: FaWhatsapp,
    label: "WhatsApp Group",
    placeholder: "https://chat.whatsapp.com/...",
  },
  {
    key: "linkedin",
    icon: FaLinkedinIn,
    label: "LinkedIn Page",
    placeholder: "https://linkedin.com/company/...",
  },
  {
    key: "twitter",
    icon: FaXTwitter,
    label: "X / Twitter",
    placeholder: "https://x.com/...",
  },
  {
    key: "instagram",
    icon: FaInstagram,
    label: "Instagram",
    placeholder: "https://instagram.com/...",
  },
];

/** Shared card + heading used by every section (also the Logo & Banner one). */
export function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={card}>
      <h2 style={heading}>{title}</h2>
      <div style={sectionBody}>{children}</div>
    </section>
  );
}

function TextField({
  id,
  label,
  icon,
  value,
  onChange,
  error,
  required,
  maxLength,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  type?: "text" | "email";
  inputMode?: "url" | "email" | "text";
  autoComplete?: string;
}) {
  return (
    <div>
      <label style={fieldLabel} htmlFor={id}>
        {icon && (
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginRight: 6,
              verticalAlign: "-0.15em",
            }}
          >
            {icon}
          </span>
        )}
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function BasicInformationFields({
  form,
  errors = {},
  onChange,
}: {
  form: SocietyFormValues;
  errors?: FormErrors;
  onChange: (field: BasicField, value: string) => void;
}) {
  const descriptionId = fieldId("description");
  return (
    <Section title="Basic Information">
      <div style={fieldGap}>
        <TextField
          id={fieldId("name")}
          label="Society Name"
          required
          maxLength={LIMITS.name}
          placeholder="e.g. FAST Computing Society"
          value={form.name}
          error={errors.name}
          onChange={(value) => onChange("name", value)}
        />
      </div>
      <div style={fieldGap}>
        <TextField
          id={fieldId("organization")}
          label="Organization (University / Company / Club)"
          maxLength={LIMITS.organization}
          placeholder="e.g. FAST-NUCES Karachi"
          value={form.organization}
          error={errors.organization}
          onChange={(value) => onChange("organization", value)}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          ...fieldGap,
        }}
      >
        <TextField
          id={fieldId("city")}
          label="City"
          required
          maxLength={LIMITS.city}
          placeholder="Karachi"
          autoComplete="address-level2"
          value={form.city}
          error={errors.city}
          onChange={(value) => onChange("city", value)}
        />
        <TextField
          id={fieldId("country")}
          label="Country"
          required
          maxLength={LIMITS.country}
          placeholder="Pakistan"
          autoComplete="country-name"
          value={form.country}
          error={errors.country}
          onChange={(value) => onChange("country", value)}
        />
      </div>
      <div>
        <label style={fieldLabel} htmlFor={descriptionId}>
          Description<span aria-hidden="true"> *</span>
        </label>
        <textarea
          id={descriptionId}
          className="input"
          style={{ resize: "vertical" }}
          rows={4}
          maxLength={LIMITS.description}
          placeholder="What does your society do? Who is it for?"
          value={form.description}
          aria-required="true"
          aria-invalid={errors.description ? true : undefined}
          // Associate both error and counter for screen readers
          aria-describedby={
            errors.description
              ? `${descriptionId}-error ${descriptionId}-count`
              : `${descriptionId}-count`
          }
          onChange={(event) => onChange("description", event.target.value)}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {errors.description ? (
            <p
              id={`${descriptionId}-error`}
              className="field-error"
              role="alert"
            >
              {errors.description}
            </p>
          ) : (
            <span />
          )}
          <p
            id={`${descriptionId}-count`}
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {form.description.length}/{LIMITS.description}
          </p>
        </div>
      </div>
    </Section>
  );
}

export function ContactFields({
  form,
  errors = {},
  onChange,
}: {
  form: SocietyFormValues;
  errors?: FormErrors;
  onChange: (field: ContactField, value: string) => void;
}) {
  return (
    <Section
      title={
        <>
          Contact <span style={optionalNote}>— optional</span>
        </>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {/* type="text" + inputMode="url": native type="url" rejects "site.com"
            and accepts "javascript:..."; the page normalises and validates. */}
        <TextField
          id={fieldId("website")}
          label="Website"
          inputMode="url"
          autoComplete="url"
          maxLength={LIMITS.url}
          placeholder="https://yoursociety.com"
          value={form.website}
          error={errors.website}
          onChange={(value) => onChange("website", value)}
        />
        <TextField
          id={fieldId("contactEmail")}
          label="Contact Email"
          type="email"
          autoComplete="email"
          maxLength={LIMITS.email}
          placeholder="contact@society.com"
          value={form.contactEmail}
          error={errors.contactEmail}
          onChange={(value) => onChange("contactEmail", value)}
        />
      </div>
    </Section>
  );
}

export function CommunityLinkFields({
  form,
  errors = {},
  onChange,
}: {
  form: SocietyFormValues;
  errors?: FormErrors;
  onChange: (key: keyof CommunityLinks, value: string) => void;
}) {
  return (
    <Section
      title={
        <>
          Community Links{" "}
          <span style={optionalNote}>— where your community hangs out</span>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {COMMUNITY_LINKS.map(({ key, icon: Icon, label, placeholder }) => (
          <TextField
            key={key}
            id={fieldId(`community.${key}`)}
            icon={<Icon style={{ width: 14, height: 14 }} />}
            label={label}
            inputMode="url"
            autoComplete="off"
            maxLength={LIMITS.url}
            placeholder={placeholder}
            value={form.communityLinks[key] ?? ""}
            error={errors[`community.${key}`]}
            onChange={(value) => onChange(key, value)}
          />
        ))}
      </div>
    </Section>
  );
}
