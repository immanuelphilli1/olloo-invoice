import { FONT_OPTIONS, type DocumentStyle } from '@olloo/shared';
import { useEffect } from 'react';

/** Inject the Google Fonts stylesheet for each family once per page. */
export function ensureFonts(families: string[]) {
  for (const family of new Set(families)) {
    const option = FONT_OPTIONS.find((f) => f.family === family);
    if (!option || document.querySelector(`link[data-font="${family}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${option.google}&display=swap`;
    // CORS mode lets html-to-image read the @font-face rules when it embeds fonts in WhatsApp/PDF images.
    link.crossOrigin = 'anonymous';
    link.dataset.font = family;
    document.head.appendChild(link);
  }
}

export function useDocumentFonts(style: DocumentStyle) {
  useEffect(() => {
    ensureFonts([style.headingFont, style.bodyFont, style.inkFont]);
  }, [style.headingFont, style.bodyFont, style.inkFont]);
}

/** Every family, for the font pickers in Settings → Branding. */
export function useAllFonts() {
  useEffect(() => {
    ensureFonts(FONT_OPTIONS.map((f) => f.family));
  }, []);
}
