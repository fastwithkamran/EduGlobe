'use client';

import Image from 'next/image';
import { sanitizeImageUrl } from '@/lib/utils';
import type { Society, CommunityLinks } from '@/types';

const COMMUNITY_LINK_CONFIG: {
  key: keyof CommunityLinks;
  icon: string;
  label: string;
  color: string;
}[] = [
  { key: 'discord',   icon: '🎮', label: 'Discord',   color: '#5865F2' },
  { key: 'whatsapp',  icon: '💬', label: 'WhatsApp',  color: '#25D366' },
  { key: 'linkedin',  icon: '💼', label: 'LinkedIn',  color: '#0A66C2' },
  { key: 'twitter',   icon: '🐦', label: 'Twitter/X', color: '#1DA1F2' },
  { key: 'instagram', icon: '📸', label: 'Instagram', color: '#E1306C' },
];

const DETAIL_ROWS: Array<{ label: string; getValue: (s: Society) => string | null }> = [
  { label: 'Organization', getValue: s => s.organization || null },
  { label: 'City',         getValue: s => s.city },
  { label: 'Country',      getValue: s => s.country },
  { label: 'Website',      getValue: s => s.website || null },
  { label: 'Contact',      getValue: s => s.contactEmail || null },
];

export function AboutTab({ society }: { society: Society }) {
  const links = society.communityLinks ?? {};
  const activeLinks = COMMUNITY_LINK_CONFIG.filter(c => links[c.key]);

  return (
    <div style={{ maxWidth: 600 }}>

      {/* Description */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 14,
      }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>About</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          {society.description}
        </p>
      </div>

      {/* Details */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 14,
      }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Details</h3>
        {DETAIL_ROWS.map(({ label, getValue }) => {
          const value = getValue(society);
          if (!value) return null;
          const isUrl = value.startsWith('http');
          return (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid var(--border-secondary)', fontSize: 13,
            }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
              {isUrl ? (
                <a
                  href={value}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--primary-400)', fontWeight: 500, textDecoration: 'none', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {value.replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Community Links — only shown if at least one is set */}
      {activeLinks.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-xl)', padding: 20,
        }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
            Community Links
          </h3>
          <div className="flex flex-col gap-2.5">
            {activeLinks.map(({ key, icon, label, color }) => {
              const url = links[key]!;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                  style={{
                    background: `${color}14`,
                    border: `1px solid ${color}30`,
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color }}>{label}</div>
                    <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {url.replace(/^https?:\/\//, '')}
                    </div>
                  </div>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>→</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
