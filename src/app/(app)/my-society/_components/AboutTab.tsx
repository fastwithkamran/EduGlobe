"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { sanitizeImageUrl } from "@/lib/utils";
import { displayUrl, normalizeHttpUrl } from "@/lib/url";
import type { CommunityLinks, Society } from "@/types";
import {
  FaDiscord,
  FaWhatsapp,
  FaLinkedinIn,
  FaXTwitter,
  FaInstagram,
} from "react-icons/fa6";
import { FiExternalLink } from "react-icons/fi";

const COMMUNITY_LINK_CONFIG: {
  key: keyof CommunityLinks;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  label: string;
  color: string;
}[] = [
  { key: "discord", icon: FaDiscord, label: "Discord", color: "#5865F2" },
  { key: "whatsapp", icon: FaWhatsapp, label: "WhatsApp", color: "#25D366" },
  { key: "linkedin", icon: FaLinkedinIn, label: "LinkedIn", color: "#0A66C2" },
  { key: "twitter", icon: FaXTwitter, label: "Twitter/X", color: "#1DA1F2" },
  { key: "instagram", icon: FaInstagram, label: "Instagram", color: "#E1306C" },
];

const cardStyle: CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-primary)",
  borderRadius: "var(--radius-xl)",
  padding: 20,
  marginBottom: 14,
};

const sectionTitleStyle: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: 15,
  margin: "0 0 14px",
  color: "var(--text-primary)",
};

const linkStyle: CSSProperties = {
  color: "var(--primary-400)",
  textDecoration: "none",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Detail = { label: string; value: string; href?: string };

/**
 * Profile "About" tab presenting society overview, contact info, social links, and images.
 */
export function AboutTab({ society }: { society: Society }) {
  const links = society.communityLinks ?? {};
  // Filter and normalize valid external social & community links
  const activeLinks = COMMUNITY_LINK_CONFIG.flatMap((config) => {
    const url = normalizeHttpUrl(links[config.key]);
    return url ? [{ ...config, url }] : [];
  });

  const website = normalizeHttpUrl(society.website);
  const email = society.contactEmail?.trim() ?? "";

  const details: Detail[] = [
    { label: "Organization", value: society.organization?.trim() ?? "" },
    { label: "City", value: society.city?.trim() ?? "" },
    { label: "Country", value: society.country?.trim() ?? "" },
    {
      label: "Website",
      value: website ? displayUrl(website) : (society.website?.trim() ?? ""),
      href: website ?? undefined,
    },
    {
      label: "Contact email",
      value: email,
      href: EMAIL_RE.test(email)
        ? `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`
        : undefined,
    },
  ].filter((detail) => detail.value);

  // Sanitized logo and banner URLs for safe rendering
  const logoSrc = society.logoURL ? sanitizeImageUrl(society.logoURL) : "";
  const bannerSrc = society.bannerURL
    ? sanitizeImageUrl(society.bannerURL)
    : "";

  const hasDescription = Boolean(society.description?.trim());
  const hasImages = Boolean(logoSrc || bannerSrc);

  // Fallback state for sparse profiles
  if (
    !hasDescription &&
    details.length === 0 &&
    !hasImages &&
    activeLinks.length === 0
  ) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 0",
          color: "var(--text-tertiary)",
          fontSize: 13,
        }}
      >
        This society hasn’t added any details yet.
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
      {hasDescription && (
        <section style={cardStyle} aria-labelledby="society-about-heading">
          <h2 id="society-about-heading" style={sectionTitleStyle}>
            About
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.75,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              margin: 0,
            }}
          >
            {society.description}
          </p>
        </section>
      )}

      {details.length > 0 && (
        <section style={cardStyle} aria-labelledby="society-details-heading">
          <h2 id="society-details-heading" style={sectionTitleStyle}>
            Details
          </h2>
          <dl style={{ margin: 0 }}>
            {details.map(({ label, value, href }) => (
              <div
                key={label}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border-secondary)",
                  fontSize: 13,
                }}
              >
                <dt style={{ color: "var(--text-tertiary)" }}>{label}</dt>
                <dd
                  className="m-0 max-w-full break-words text-right sm:max-w-[65%]"
                  style={{ color: "var(--text-primary)", fontWeight: 500 }}
                >
                  {href ? (
                    <a
                      href={href}
                      {...(href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      style={linkStyle}
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {hasImages && (
        <section style={cardStyle} aria-labelledby="society-images-heading">
          <h2 id="society-images-heading" style={sectionTitleStyle}>
            Society images
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {logoSrc && (
              <figure className="m-0 min-w-0">
                <figcaption className="mb-2 text-xs text-[var(--text-tertiary)]">
                  Logo
                </figcaption>
                <div className="relative aspect-square max-h-64 overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                  <Image
                    src={logoSrc}
                    alt={`${society.name} logo`}
                    fill
                    sizes="(max-width: 640px) 100vw, 320px"
                    className="object-contain p-3"
                  />
                </div>
              </figure>
            )}
            {bannerSrc && (
              <figure className="m-0 min-w-0">
                <figcaption className="mb-2 text-xs text-[var(--text-tertiary)]">
                  Banner
                </figcaption>
                <div className="relative aspect-[3/1] overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                  <Image
                    src={bannerSrc}
                    alt={`${society.name} banner`}
                    fill
                    sizes="(max-width: 640px) 100vw, 480px"
                    className="object-cover"
                  />
                </div>
              </figure>
            )}
          </div>
        </section>
      )}

      {activeLinks.length > 0 && (
        <section style={cardStyle} aria-labelledby="society-community-heading">
          <h2 id="society-community-heading" style={sectionTitleStyle}>
            Community links
          </h2>
          <div className="flex flex-col gap-2.5">
            {activeLinks.map(({ key, icon: LinkIcon, label, color, url }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl p-3 transition-colors"
                style={{
                  background: `${color}14`,
                  border: `1px solid ${color}30`,
                  textDecoration: "none",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    color,
                  }}
                >
                  <LinkIcon style={{ width: 18, height: 18 }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[13px] font-semibold"
                    style={{ color }}
                  >
                    {label}
                  </span>
                  <span
                    className="block truncate text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {displayUrl(url)}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-[11px] flex items-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  <FiExternalLink style={{ width: 13, height: 13 }} />
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
