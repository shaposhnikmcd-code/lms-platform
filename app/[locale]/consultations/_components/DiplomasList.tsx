'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaGraduationCap, FaCertificate, FaTimes, FaExternalLinkAlt } from 'react-icons/fa';

export interface DiplomaDoc {
  type: string;
  title: string;
  org: string;
  detail: string;
  year: string;
  file?: string;
  tag: string;
  url?: string;
}

interface Props {
  docs: DiplomaDoc[];
}

const ANIM_CSS = `
  @keyframes cert-overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes cert-modal-in {
    from {
      opacity: 0;
      transform: scale(0.82) translateY(24px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .cert-img-container::-webkit-scrollbar { display: none; }
  .cert-img-container { -ms-overflow-style: none; scrollbar-width: none; }
`;

const HEADER_HEIGHT = 57;
const PADDING = 20;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const colStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  flex: 1,
  minWidth: 0,
};

export default function DiplomasList({ docs }: Props) {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const imgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(prev => {
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
      });
    };
    if (activeFile) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [activeFile]);

  const openModal = (file: string, title: string) => {
    setActiveFile(file);
    setActiveTitle(title);
    setZoom(1);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setActiveFile(null);
    setZoom(1);
    document.body.style.overflow = '';
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '0.4rem', overflow: 'hidden' }}>
        {[docs.filter((_, i) => i % 2 === 0), docs.filter((_, i) => i % 2 !== 0)].map((col, colIdx) => (
          <div key={colIdx} style={colStyle}>
            {col.map((doc, j) => {
              const i = j * 2 + colIdx;
              const isDiploma = doc.type === 'diploma';
              const isHovered = hoveredIndex === i;
              const accentColor = isDiploma ? '#1C3A2E' : '#D4A843';
              return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', ...(doc.url ? { marginTop: 'auto', marginBottom: 'auto' } : {}) }}>
              {doc.file ? (
              <button
                onClick={() => openModal(doc.file!, doc.title)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.65rem',
                  borderRadius: '0',
                  background: isHovered
                    ? (isDiploma ? 'rgba(28,58,46,0.05)' : 'rgba(212,168,67,0.06)')
                    : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  borderTop: `1px solid ${isHovered ? (isDiploma ? 'rgba(28,58,46,0.15)' : 'rgba(212,168,67,0.3)') : 'rgba(28,58,46,0.07)'}`,
                  borderRight: `1px solid ${isHovered ? (isDiploma ? 'rgba(28,58,46,0.15)' : 'rgba(212,168,67,0.3)') : 'rgba(28,58,46,0.07)'}`,
                  borderBottom: doc.url ? 'none' : `1px solid ${isHovered ? (isDiploma ? 'rgba(28,58,46,0.15)' : 'rgba(212,168,67,0.3)') : 'rgba(28,58,46,0.07)'}`,
                  borderLeft: `3px solid ${accentColor}`,
                  boxShadow: isHovered ? '0 2px 8px rgba(28,58,46,0.08)' : 'none',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {isDiploma
                  ? <FaGraduationCap style={{ color: accentColor, fontSize: '0.65rem', flexShrink: 0 }} />
                  : <FaCertificate style={{ color: accentColor, fontSize: '0.65rem', flexShrink: 0 }} />
                }
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#1C3A2E',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  lineHeight: 1.3,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {doc.title}
                </span>
              </button>
              ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.65rem',
                  background: 'white',
                  borderTop: '1px solid rgba(28,58,46,0.07)',
                  borderRight: '1px solid rgba(28,58,46,0.07)',
                  borderBottom: '1px solid rgba(28,58,46,0.07)',
                  borderLeft: `3px solid ${accentColor}`,
                }}
              >
                {isDiploma
                  ? <FaGraduationCap style={{ color: accentColor, fontSize: '0.65rem', flexShrink: 0 }} />
                  : <FaCertificate style={{ color: accentColor, fontSize: '0.65rem', flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#1C3A2E',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    lineHeight: 1.3,
                  }}>
                    {doc.title}
                  </span>
                  {doc.detail && (
                    <span style={{
                      display: 'block',
                      fontSize: '0.62rem',
                      color: '#6b7280',
                      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                      lineHeight: 1.3,
                      marginTop: '0.15rem',
                    }}>
                      {doc.detail}
                    </span>
                  )}
                </div>
              </div>
              )}

              {doc.url && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '0',
                    background: 'linear-gradient(90deg, rgba(28,58,46,0.06) 0%, rgba(212,168,67,0.08) 100%)',
                    border: '1px solid rgba(212,168,67,0.2)',
                    borderTop: '1px solid rgba(212,168,67,0.12)',
                    borderLeft: '3px solid #1C3A2E',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'linear-gradient(90deg, rgba(28,58,46,0.1) 0%, rgba(212,168,67,0.15) 100%)';
                    e.currentTarget.style.borderColor = 'rgba(212,168,67,0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'linear-gradient(90deg, rgba(28,58,46,0.06) 0%, rgba(212,168,67,0.08) 100%)';
                    e.currentTarget.style.borderColor = 'rgba(212,168,67,0.2)';
                  }}
                >
                  <span style={{
                    fontSize: '0.62rem',
                    color: '#8B6914',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    letterSpacing: '0.01em',
                  }}>
                    🌐 visionuniversity.edu.ng
                  </span>
                  <FaExternalLinkAlt style={{ color: '#D4A843', fontSize: '0.5rem', opacity: 0.7 }} />
                </a>
              )}
            </div>
              );
            })}
          </div>
        ))}
      </div>

      {mounted && activeFile && createPortal(
        <>
          <style>{ANIM_CSS}</style>
          {/* Overlay */}
          <div
            onClick={closeModal}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              animation: 'cert-overlay-in 200ms ease forwards',
            }}
          >
            {/* Modal */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                height: '88vh',
                width: 'auto',
                maxWidth: '92vw',
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
                background: '#1C3A2E',
                display: 'flex',
                flexDirection: 'column',
                willChange: 'transform, opacity',
                animation: 'cert-modal-in 350ms cubic-bezier(0.16,1,0.3,1) forwards',
              }}
            >
              {/* Шапка */}
              <div style={{
                height: `${HEADER_HEIGHT}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1.5rem',
                borderBottom: '1px solid rgba(212,168,67,0.2)',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FaCertificate style={{ color: '#D4A843' }} />
                  <span style={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  }}>
                    {activeTitle}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {zoom > 1 && (
                    <span style={{
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                    }}>
                      {Math.round(zoom * 100)}%
                    </span>
                  )}
                  <button
                    onClick={closeModal}
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              {/* Контейнер зображення — скролиться коли zoom > 1 */}
              <div
                ref={imgContainerRef}
                className="cert-img-container"
                style={{
                  flex: 1,
                  overflow: 'auto',
                  display: 'flex',
                  alignItems: zoom > 1 ? 'flex-start' : 'center',
                  justifyContent: zoom > 1 ? 'flex-start' : 'center',
                  padding: `${PADDING}px`,
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
                    height: `calc(${zoom} * (88vh - ${HEADER_HEIGHT}px - ${PADDING * 2}px))`,
                    width: 'auto',
                    borderRadius: '4px',
                    transition: 'height 0.12s ease',
                    flexShrink: 0,
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
