'use client';

import { useEffect } from 'react';

/// Блокування скролу сторінки під відкритим оверлеєм — ЄДИНИЙ механізм на всі модалки
/// розділу «Сертифікати» (ModalShell, фулскрін-прев'ю, довідник Річної).
///
/// Лічильник (а не простий set/restore у кожному компоненті) обов'язковий: оверлеї
/// живуть одночасно — фулскрін-прев'ю відкривається ПОВЕРХ форми видачі і закривається
/// раніше за неї. Якби кожен відновлював `overflow` самостійно, закриття верхнього
/// повертало б скрол сторінці, поки нижня модалка ще відкрита.
///
/// Оригінальні значення знімаємо при першому локі й повертаємо при останньому анлоку.
let scrollLockCount = 0;
let scrollLockSaved: { overflow: string; paddingRight: string } | null = null;

export function useBodyScrollLock() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (scrollLockCount === 0) {
      scrollLockSaved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      /// Компенсація ширини скролбара — інакше при хованні скролу контент стрибає вправо.
      const gap = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (gap > 0) body.style.paddingRight = `${gap}px`;
    }
    scrollLockCount += 1;
    return () => {
      scrollLockCount -= 1;
      if (scrollLockCount === 0 && scrollLockSaved) {
        body.style.overflow = scrollLockSaved.overflow;
        body.style.paddingRight = scrollLockSaved.paddingRight;
        scrollLockSaved = null;
      }
    };
  }, []);
}
