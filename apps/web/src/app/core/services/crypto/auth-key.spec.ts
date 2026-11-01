import { describe, expect, it } from 'vitest';
import { deriveAuthKey } from './auth-key';

describe('deriveAuthKey', () => {
  it('produit 32 octets en hex, le seul format que le serveur accepte', async () => {
    expect(await deriveAuthKey('correct horse battery', 'a@b.fr')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('est déterministe et insensible à la casse et aux espaces de l’e-mail (même clé sur tout appareil)', async () => {
    const key = await deriveAuthKey('correct horse battery', 'julie@dash.flow');

    expect(await deriveAuthKey('correct horse battery', '  Julie@Dash.Flow ')).toBe(key);
  });

  it.each([
    ['un autre mot de passe', 'correct horse batterz', 'julie@dash.flow'],
    ['un autre e-mail (le sel)', 'correct horse battery', 'marc@dash.flow'],
  ])('change avec %s', async (_label, password, email) => {
    const key = await deriveAuthKey('correct horse battery', 'julie@dash.flow');

    expect(await deriveAuthKey(password, email)).not.toBe(key);
  });

  it('ne contient ni le mot de passe ni sa forme hexadécimale', async () => {
    const password = 'abc';
    const key = await deriveAuthKey(password, 'julie@dash.flow');

    expect(key).not.toContain(password);
    expect(key).not.toContain('616263');
  });
});
