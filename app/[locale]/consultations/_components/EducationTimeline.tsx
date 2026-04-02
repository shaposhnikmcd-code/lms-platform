'use client';

import { useState } from 'react';
import { FaGraduationCap } from 'react-icons/fa';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

export interface EducationItem {
  title: string;
  org: string;
  period: string;
  status?: string;
}

export interface EducationCategory {
  category: string;
  items: EducationItem[];
  fullWidth?: boolean;
}

interface Props {
  categories: EducationCategory[];
  twoColumn?: boolean;
}

export default function EducationTimeline({ categories, twoColumn }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {categories.map((cat, ci) => (
        <div key={ci}>
          {/* Категорія-роздільник */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.3rem' }}>
            <span style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#9ca3af',
              fontFamily: sysFont,
              whiteSpace: 'nowrap',
            }}>
              {cat.category}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(28,58,46,0.08)' }} />
          </div>

          {/* Елементи */}
          <div className={twoColumn && cat.items.length >= 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-[0.3rem]' : 'flex flex-col gap-[0.3rem]'}>
            {cat.items.map((item, ii) => {
              const isOngoing = item.status === 'ongoing';
              const accent = isOngoing ? '#D4A843' : '#1C3A2E';
              const key = `${ci}-${ii}`;
              const isHov = hovered === key;

              return (
                <div
                  key={ii}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.5rem 0.65rem',
                    borderLeft: `3px solid ${accent}`,
                    borderTop: `1px solid ${isHov ? (isOngoing ? 'rgba(212,168,67,0.25)' : 'rgba(28,58,46,0.15)') : 'rgba(28,58,46,0.07)'}`,
                    borderRight: `1px solid ${isHov ? (isOngoing ? 'rgba(212,168,67,0.25)' : 'rgba(28,58,46,0.15)') : 'rgba(28,58,46,0.07)'}`,
                    borderBottom: `1px solid ${isHov ? (isOngoing ? 'rgba(212,168,67,0.25)' : 'rgba(28,58,46,0.15)') : 'rgba(28,58,46,0.07)'}`,
                    background: isHov
                      ? (isOngoing ? 'rgba(212,168,67,0.05)' : 'rgba(28,58,46,0.03)')
                      : 'white',
                    boxShadow: isHov ? '0 2px 8px rgba(28,58,46,0.08)' : 'none',
                    transform: isHov ? 'translateY(-1px)' : 'none',
                    transition: 'all 0.15s ease',
                    cursor: 'default',
                  }}
                >
                  <FaGraduationCap style={{ color: accent, fontSize: '0.65rem', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#1C3A2E',
                        fontFamily: sysFont,
                        lineHeight: 1.3,
                      }}>
                        {item.title}
                      </span>
                      {isOngoing && (
                        <span style={{
                          fontSize: '0.52rem',
                          fontWeight: 700,
                          color: '#B8861E',
                          background: 'rgba(212,168,67,0.1)',
                          border: '1px solid rgba(212,168,67,0.3)',
                          borderRadius: 3,
                          padding: '0 4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          lineHeight: 1.8,
                          flexShrink: 0,
                        }}>
                          В процесі
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: '0.62rem',
                      color: '#6b7280',
                      fontFamily: sysFont,
                      margin: '1px 0 0',
                      lineHeight: 1.35,
                    }}>
                      {item.org} · {item.period}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
