import { provideTransloco } from '@jsverse/transloco';
import { isDevMode } from '@angular/core';
import { HttpTranslocoLoader } from './transloco-loader';

export function readInitialLang(): 'fr' | 'en' {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('locale');
    if (stored === 'fr' || stored === 'en') return stored;
  }
  if (typeof navigator !== 'undefined') {
    const browser = navigator.language?.slice(0, 2).toLowerCase();
    if (browser === 'en') return 'en';
  }
  return 'fr';
}

export const transloco = provideTransloco({
  config: {
    availableLangs: ['fr', 'en'],
    defaultLang: readInitialLang(),
    fallbackLang: 'fr',
    reRenderOnLangChange: true,
    prodMode: !isDevMode(),
  },
  loader: HttpTranslocoLoader,
});
