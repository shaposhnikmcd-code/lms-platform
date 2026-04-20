'use client';

import Image from 'next/image';
import { useState } from 'react';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const peopleMeta = [
  { photo: '/yearly-program/Tetiana-Shaposhnyk.webp', objectPosition: 'center top' },
  { photo: '/yearly-program/Oleksandra-Janush-v2.webp', objectPosition: 'center 20%' },
  { photo: '/yearly-program/Anna-Gudzenko.webp',       objectPosition: 'center 65%' },
  { photo: '/yearly-program/Marta-Kholyava.jpg',      objectPosition: 'center 15%' },
];

type PersonContent = { name: string; role: string; education: readonly string[] };
type Props = {
  t: {
    label: string;
    title: string;
    people: readonly PersonContent[];
  };
};
type Person = PersonContent & typeof peopleMeta[number];

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2);

function PersonCard({ person, index }: { person: Person; index: number }) {
  const [hovered, setHovered] = useState(false);
  const isFounder = index === 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isFounder
          ? hovered ? 'rgba(212,168,67,0.1)' : 'rgba(212,168,67,0.06)'
          : hovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        border: isFounder
          ? `1px solid ${hovered ? 'rgba(212,168,67,0.45)' : 'rgba(212,168,67,0.2)'}`
          : `1px solid ${hovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '20px',
        overflow: 'hidden',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: hovered
          ? isFounder
            ? '0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,168,67,0.15)'
            : '0 24px 48px rgba(0,0,0,0.35)'
          : '0 4px 16px rgba(0,0,0,0.15)',
        transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
        cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', height: '400px', background: 'rgba(28,46,35,0.9)', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {person.photo ? (
            <Image
              src={person.photo}
              alt={person.name}
              fill
              style={{ objectFit: 'cover', objectPosition: person.objectPosition }}
              sizes="540px"
              quality={85}
              loading="lazy"
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: sysFont, fontSize: '60px', fontWeight: 700, color: 'rgba(212,168,67,0.25)' }}>
                {initials(person.name)}
              </span>
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to top, rgba(15,35,22,0.98), rgba(15,35,22,0.4), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, rgba(212,168,67,${hovered ? '0.8' : '0'}), transparent)`, transition: 'all 0.4s ease', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px' }}>
          <p style={{ fontFamily: sysFont, fontSize: '19px', fontWeight: 700, color: '#F5EDD6', margin: '0 0 3px', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {person.name}
          </p>
          <p style={{ fontFamily: sysFont, fontSize: '10px', color: 'rgba(212,168,67,0.8)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
            {person.role}
          </p>
        </div>
      </div>

      <div style={{ padding: '16px 20px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
          {person.education.map((edu, j) => (
            <div key={j} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: '3px', height: '3px', borderRadius: '50%', background: hovered ? '#D4A843' : 'rgba(212,168,67,0.4)', marginTop: '8px', transition: 'background 0.3s ease' }} />
              <span style={{ fontFamily: sysFont, fontSize: '12px', color: hovered ? 'rgba(245,237,214,0.7)' : 'rgba(245,237,214,0.45)', lineHeight: 1.6, transition: 'color 0.3s ease' }}>
                {edu}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TeacherSection({ t }: Props) {
  const people: Person[] = t.people.map((p, i) => ({ ...p, ...peopleMeta[i] }));
  return (
    <section style={{ background: '#1C3A2E', position: 'relative', overflow: 'hidden' }} className="py-12 sm:py-[72px] px-4 sm:px-12">
      <div style={{ position: 'absolute', top: -120, right: -80, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,67,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,67,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '1080px', margin: '0 auto', position: 'relative' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ height: '1px', width: '32px', background: '#D4A843', opacity: 0.6 }} />
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>
              {t.label}
            </span>
          </div>
          <h2 style={{ fontFamily: sysFont, fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700, color: '#F5EDD6', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {t.title}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="yearly-teachers-grid">
          {people.map((person, i) => (
            <PersonCard key={i} person={person} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}