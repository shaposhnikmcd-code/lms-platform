'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaGraduationCap, FaCertificate, FaTimes, FaFilePdf } from 'react-icons/fa';

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
  content: {
    sectionLabel: string;
    docs: DiplomaDoc[];
  };
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

export default function DiplomasSection({ content }: Props) {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [mounted, setMounted] = useState(false);

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
      {/* Сітка документів — 2 або 3 колонки */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {content.docs.map((doc, i) => {
          const isDiploma = doc.type === 'diploma';

          const tagStyle: React.CSSProperties = {
            background: isDiploma ? 'rgba(28,58,46,0.08)' : 'rgba(212,168,67,0.12)',
            color: isDiploma ? '#1C3A2E' : '#9a7010',
          };

          const topBarStyle: React.CSSProperties = {
            background: isDiploma
              ? 'linear-gradient(to right, #1C3A2E, #2a4f3f)'
              : 'linear-gradient(to right, #D4A843, #e8b82a)',
            height: '3px',
            width: '100%',
          };

          return (
            <button
              key={i}
              onClick={() => openModal(doc.file, doc.title)}
              className="group flex flex-col rounded-xl overflow-hidden text-left w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              style={{ background: 'white', border: '1px solid rgba(28,58,46,0.08)' }}
            >
              {/* Кольорова смужка зверху */}
              <div style={topBarStyle} />

              <div className="p-4 flex flex-col gap-2 flex-1">
                {/* Тег + рік */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 leading-none"
                    style={tagStyle}
                  >
                    {isDiploma
                      ? <><FaGraduationCap className="text-[8px]" />{doc.tag}</>
                      : <><FaCertificate className="text-[8px]" />{doc.tag}</>
                    }
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">{doc.year}</span>
                </div>

                {/* Назва */}
                <p className="text-xs font-semibold text-[#1C3A2E] leading-snug line-clamp-2">{doc.title}</p>

                {/* Організація */}
                <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2 flex-1">{doc.org}</p>

                {/* PDF іконка при наведенні */}
                <div className="flex items-center gap-1 text-[#D4A843] opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1">
                  <FaFilePdf className="text-[10px]" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider">{"PDF"}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Модалка */}
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