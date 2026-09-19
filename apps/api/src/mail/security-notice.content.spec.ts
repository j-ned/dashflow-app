import { describe, it, expect } from 'vitest';
import { NOTICE_REASONS } from '../modules/admin/account-security';
import {
  SECURITY_NOTICE_CONTENT,
  securityNoticeText,
} from './security-notice.content';
import { webUrlFrom } from './smtp.mailer';

describe('relances de sécurité : contenu des mails', () => {
  it('chaque motif a un sujet, une accroche, des étapes et un bouton vers une route du site', () => {
    for (const reason of NOTICE_REASONS) {
      const c = SECURITY_NOTICE_CONTENT[reason];
      expect(c.subject.length).toBeGreaterThan(10);
      expect(c.intro.length).toBeGreaterThan(40);
      expect(c.steps.length).toBeGreaterThanOrEqual(2);
      expect(c.cta.path).toBe('/auth/login');
    }
  });

  it('la version texte mène au site et rappelle qu’on ne demande jamais de secret par e-mail', () => {
    const text = securityNoticeText(
      SECURITY_NOTICE_CONTENT.reconnect,
      'https://dashflow.example',
    );
    expect(text).toContain('https://dashflow.example/auth/login');
    expect(text).toContain('ne vous demandera jamais votre mot de passe');
    expect(text).toMatch(/^1\. /m);
  });

  it('webUrlFrom : première origine CORS, sans barre finale', () => {
    expect(webUrlFrom('https://dashflow.example/, https://autre.example')).toBe(
      'https://dashflow.example',
    );
    expect(webUrlFrom('http://localhost:4200')).toBe('http://localhost:4200');
  });
});
