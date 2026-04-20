'use client';

import type { CSSProperties } from 'react';

export type SaleSource = 'UIMP' | 'TETYANA';

interface SourceBadgeProps {
  source: SaleSource | null | undefined;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/// Маркер джерела продажу. UIMP (дефолтне джерело) не показуємо — badge рендериться
/// лише коли source !== 'UIMP'. Для TETYANA — кремова кругла печатка з ініціалами "ТШ"
/// в amber-кольорах (той самий стиль що і UIMP wax seal на пакетах).
export default function SourceBadge({ source, size = 18, className, style }: SourceBadgeProps) {
  if (!source || source === 'UIMP') return null;

  if (source === 'TETYANA') {
    return (
      <span
        title="Продаж з персонального сайту Тетяни Шапошник (shaposhnyktetiana.com.ua)"
        aria-label="З сайту Тетяни Шапошник"
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          minWidth: size,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 30% 30%, rgba(255,244,220,0.95) 0%, rgba(240,222,186,0.9) 100%)',
          border: '1px solid rgba(164,122,40,0.65)',
          color: 'rgba(120,86,24,0.9)',
          fontSize: Math.round(size * 0.45),
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(120,86,24,0.15), inset 0 0 0 1px rgba(255,255,255,0.4)',
          ...style,
        }}
      >
        ТШ
      </span>
    );
  }

  return null;
}
