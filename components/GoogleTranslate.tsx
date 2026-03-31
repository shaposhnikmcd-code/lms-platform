'use client';

import { useEffect } from 'react';

export default function GoogleTranslate() {
  useEffect(() => {
    const styleId = 'google-translate-hide';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .goog-te-banner-frame { display: none !important; }
        body { top: 0 !important; }
        .goog-tooltip { display: none !important; }
        .goog-tooltip:hover { display: none !important; }
        .goog-text-highlight { background-color: transparent !important; box-shadow: none !important; }
        .VIpgJd-ZVi9od-aZ2wEe-wOHMyf { display: none !important; }
        .VIpgJd-ZVi9od-aZ2wEe-OiiCO { display: none !important; }
        .skiptranslate { display: none !important; }
        .goog-te-gadget { display: none !important; }
        iframe.goog-te-banner-frame { display: none !important; }
        .goog-te-spinner-pos { display: none !important; }
      `;
      document.head.appendChild(style);
    }

    const addScript = () => {
      if (document.getElementById('google-translate-script')) return;
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    };

    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement(
        {
          pageLanguage: 'uk',
          includedLanguages: 'uk,pl,en',
          autoDisplay: false,
        },
        'google_translate_element'
      );
    };

    addScript();
  }, []);

  return <div id="google_translate_element" style={{ display: 'none' }} />;
}