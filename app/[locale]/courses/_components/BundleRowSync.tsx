'use client';

import { useEffect, useRef } from 'react';

export default function BundleRowSync({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Rule #37: h3-sync minHeight ВІДКЛЮЧЕНО. Лишаємо один-разовий reset застарілого
    // minHeight (на випадок SSR-залишків) і виходимо. RO/MO ловили innerHTML mutations
    // від autoTuner equalizeH4 → MutationObserver fire → можливий loop із синхронізацією.
    root
      .querySelectorAll<HTMLElement>('[data-bundle-title]')
      .forEach((el) => { el.style.minHeight = ''; });
  }, []);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
