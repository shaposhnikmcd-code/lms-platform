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

    const compute = () => {
      const titles = Array.from(root.querySelectorAll<HTMLElement>('[data-bundle-title]'));
      if (titles.length < 2) return;
      let max = 0;
      for (const el of titles) {
        if (el.scrollHeight > max) max = el.scrollHeight;
      }
      max = Math.ceil(max);
      titles.forEach((el) => {
        el.style.minHeight = `${max}px`;
      });
    };

    compute();

    const ro = new ResizeObserver(() => compute());
    const observeTitles = () => {
      ro.disconnect();
      root
        .querySelectorAll<HTMLElement>('[data-bundle-title]')
        .forEach((el) => ro.observe(el));
    };
    observeTitles();

    const mo = new MutationObserver(() => {
      observeTitles();
      compute();
    });
    mo.observe(root, { childList: true, subtree: true });

    const onResize = () => compute();
    window.addEventListener('resize', onResize);

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
