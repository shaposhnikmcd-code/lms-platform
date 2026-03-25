'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaGraduationCap, FaCertificate, FaTimes } from 'react-icons/fa';

interface DiplomaDoc {
  type: string;
  title: string;
  org: string;
  detail: string;
  year: string;
  file: string;
  tag: string;
}

interface Props {
  docs: DiplomaDoc[];
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
};

const modalBoxStyle: React.CSSProperties = {
  width: '85vw', height: '88vh', borderRadius: '1rem', overflow: 'hidden',
  boxShadow: '0 25px 60px rgba(0,0,0,0.5)', background: '#1C3A2E',
  display: 'flex', flexDirection: 'column',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(212,168,67,0.2)', flexShrink: 0,
};

const modalCloseBtnStyle: React.CSSProperties = {
  width: '2rem', height: '2rem', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'white',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.4rem',
};

export default function DiplomasList({ docs }: Props) {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const openModal = (file: string, title: string) => {
    setActiveFile(file);
    setActiveTitle(title);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setActiveFile(null);
    document.body.style.overflow = '';
  };

  return (
    <>
      <div style={gridStyle}>
        {docs.map((doc, i) => {
          const isDiploma = doc.type === 'diploma';
          const isHovered = hoveredIndex === i;
          const accentColor = isDiploma ? '#1C3A2E' : '#D4A843';

          const cardStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.65rem',
            borderRadius: '8px',
            background: isHovered
              ? (isDiploma ? 'rgba(28,58,46,0.05)' : 'rgba(212,168,67,0.06)')
              : 'white',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            borderTop: `1px solid ${isHovered ? (isDiploma ? 'rgba(28,58,46,0.15)' : 'rgba(212,168,67,0.3)') : 'rgba(28,58,46,0.07)'}`,
            borderRight: `1px solid ${isHovered ? (isDiploma ? 'rgba(28,58,46,0.15)' : 'rgba(212,168,67,0.3)') : 'rgba(28,58,46,0.07)'}`,
            borderBottom: `1px solid ${isHovered ? (isDiploma ? 'rgba(28,58,46,0.15)' : 'rgba(212,168,67,0.3)') : 'rgba(28,58,46,0.07)'}`,
            borderLeft: `3px solid ${accentColor}`,
            boxShadow: isHovered ? '0 2px 8px rgba(28,58,46,0.08)' : 'none',
            transform: isHovered ? 'translateY(-1px)' : 'none',
            transition: 'all 0.15s ease',
          };

          const iconStyle: React.CSSProperties = {
            color: accentColor,
            fontSize: '0.65rem',
            flexShrink: 0,
          };

          const titleStyle: React.CSSProperties = {
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#1C3A2E',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            lineHeight: 1.3,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          };

          return (
            <button
              key={i}
              onClick={() => openModal(doc.file, doc.title)}
              style={cardStyle}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {isDiploma
                ? <FaGraduationCap style={iconStyle} />
                : <FaCertificate style={iconStyle} />
              }
              <span style={titleStyle}>{doc.title}</span>
            </button>
          );
        })}
      </div>

      {mounted && activeFile && createPortal(
        <div onClick={closeModal} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FaCertificate style={{ color: '#D4A843' }} />
                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>{activeTitle}</span>
              </div>
              <button onClick={closeModal} style={modalCloseBtnStyle}>
                <FaTimes />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <iframe
                src={`${activeFile}#toolbar=0&view=Fit&zoom=page-fit`}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title={activeTitle}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}