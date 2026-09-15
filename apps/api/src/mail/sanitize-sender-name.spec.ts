import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeSenderName } from './sanitize-sender-name';

describe('escapeHtml', () => {
  it('neutralise une balise et un attribut injectés via displayName', () => {
    expect(escapeHtml(`<a href="https://evil.example">Alice</a>`)).toBe(
      '&lt;a href=&quot;https://evil.example&quot;&gt;Alice&lt;/a&gt;',
    );
  });
  it("échappe & et l'apostrophe", () => {
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });
});

describe('sanitizeSenderName', () => {
  it('retire les retours ligne (injection d’en-têtes dans le sujet)', () => {
    expect(sanitizeSenderName('Alice\r\nBcc: victim@x.io')).toBe(
      'Alice Bcc: victim@x.io',
    );
  });
  it('tronque à 60 caractères avec une ellipse', () => {
    const out = sanitizeSenderName('a'.repeat(200));
    expect(out).toHaveLength(60);
    expect(out.endsWith('…')).toBe(true);
  });
  it('vide ou uniquement des caractères de contrôle → nom par défaut', () => {
    expect(sanitizeSenderName('')).toBe('Un utilisateur DashFlow');
    expect(sanitizeSenderName(String.fromCharCode(0, 31, 127))).toBe(
      'Un utilisateur DashFlow',
    );
  });
  it('laisse passer un nom normal, accents compris', () => {
    expect(sanitizeSenderName('  Élodie Nédellec ')).toBe('Élodie Nédellec');
  });
});
