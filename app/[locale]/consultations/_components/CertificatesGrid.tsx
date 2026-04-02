'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaGraduationCap, FaCertificate, FaTimes, FaExternalLinkAlt } from 'react-icons/fa';

export interface CertificateDoc {
  title: string;
  org: string;
  year: string;
  file?: string;
  tag: string;
  url?: string;
  isdiploma?: boolean;
}

interface Props {
  certs: CertificateDoc[];
}

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const ANIM_CSS = `
  @keyframes cert-overlay-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cert-modal-in {
    from { opacity: 0; transform: scale(0.82) translateY(24px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  .cg-img-wrap::-webkit-scrollbar { display: none; }
  .cg-img-wrap { -ms-overflow-style: none; scrollbar-width: none; }
`;

const HEADER_H = 57;
const PAD = 20;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export default function CertificatesGrid({ certs }: Props) {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [activeUrl, setActiveUrl] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + (e.deltaY < 0 ? 0.15 : -0.15))));
    };
    if (activeFile) {
      document.addEventListener('keydown', onKey);
      document.addEventListener('wheel', onWheel, { passive: false });
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('wheel', onWheel);
    };
  }, [activeFile]);

  const open = (cert: CertificateDoc) => {
    if (!cert.file) return;
    setActiveFile(cert.file);
    setActiveTitle(cert.title);
    setActiveUrl(cert.url);
    setZoom(1);
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    setActiveFile(null);
    setActiveUrl(undefined);
    setZoom(1);
    document.body.style.overflow = '';
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        {certs.map((cert, i) => {
          const isHov = hovered === i;
          const accent = cert.isdiploma ? '#1C3A2E' : '#D4A843';
          const Icon = cert.isdiploma ? FaGraduationCap : FaCertificate;
          const clickable = !!cert.file;

          const row = (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon style={{ color: accent, fontSize: '0.6rem', flexShrink: 0 }} />
              <span style={{
                flex: 1,
                fontSize: '0.67rem',
                fontWeight: 500,
                color: '#374151',
                fontFamily: sysFont,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}>
                {cert.title}
              </span>
              <span style={{
                fontSize: '0.58rem',
                color: '#9ca3af',
                fontFamily: sysFont,
                flexShrink: 0,
              }}>
                {cert.year}
              </span>
            </div>
          );

          const style: React.CSSProperties = {
            display: 'block',
            width: '100%',
            padding: '0.28rem 0.4rem',
            borderRadius: 5,
            background: isHov ? 'rgba(28,58,46,0.04)' : 'transparent',
            transition: 'background 0.12s',
            cursor: clickable ? 'pointer' : 'default',
            textAlign: 'left',
            border: 'none',
          };

          return clickable ? (
            <button
              key={i}
              style={style}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => open(cert)}
              title={`${cert.title} · ${cert.org}`}
            >
              {row}
            </button>
          ) : (
            <div key={i} style={style}>{row}</div>
          );
        })}
      </div>

      {mounted && activeFile && createPortal(
        <>
          <style>{ANIM_CSS}</style>
          <div
            onClick={close}
            style={{
              position: 'fixed', inset: 0, zIndex: 999999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              animation: 'cert-overlay-in 200ms ease forwards',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                height: '88vh', width: 'auto', maxWidth: '92vw',
                borderRadius: 14, overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
                background: '#1C3A2E',
                display: 'flex', flexDirection: 'column',
                animation: 'cert-modal-in 350ms cubic-bezier(0.16,1,0.3,1) forwards',
              }}
            >
              <div style={{
                height: HEADER_H, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '0 1.5rem',
                borderBottom: '1px solid rgba(212,168,67,0.2)', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FaCertificate style={{ color: '#D4A843' }} />
                  <span style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem', fontFamily: sysFont }}>
                    {activeTitle}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {zoom > 1 && (
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {Math.round(zoom * 100)}%
                    </span>
                  )}
                  {activeUrl && (
                    <a
                      href={activeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        color: '#D4A843', fontSize: '0.75rem', textDecoration: 'none',
                        fontFamily: sysFont, padding: '4px 10px',
                        border: '1px solid rgba(212,168,67,0.3)', borderRadius: 6,
                      }}
                    >
                      <FaExternalLinkAlt style={{ fontSize: '0.6rem' }} />
                      visionuniversity.edu.ng
                    </a>
                  )}
                  <button
                    onClick={close}
                    style={{
                      width: '2rem', height: '2rem', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.1)', border: 'none',
                      cursor: 'pointer', color: 'white',
                    }}
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              <div
                className="cg-img-wrap"
                style={{
                  flex: 1, overflow: 'auto', padding: PAD,
                  display: 'flex',
                  alignItems: zoom > 1 ? 'flex-start' : 'center',
                  justifyContent: zoom > 1 ? 'flex-start' : 'center',
                  background: '#1C3A2E',
                  cursor: zoom > 1 ? 'grab' : 'default',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI(activeFile)}
                  alt={activeTitle}
                  style={{
                    display: 'block',
                    height: `calc(${zoom} * (88vh - ${HEADER_H}px - ${PAD * 2}px))`,
                    width: 'auto', borderRadius: 4,
                    transition: 'height 0.12s ease', flexShrink: 0,
                  }}
                />
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
