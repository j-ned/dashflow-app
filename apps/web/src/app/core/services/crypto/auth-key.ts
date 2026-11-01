const AUTH_KEY_ITERATIONS = 600_000;
const AUTH_KEY_BITS = 256;
const AUTH_KEY_CONTEXT = 'dashflow:auth:v1:';

/**
 * Clé d'authentification : ce que le serveur reçoit à la place du mot de passe. Le mot de passe
 * dérive aussi la clé qui emballe la clé maîtresse (sel aléatoire par compte) ; ici le sel est
 * l'e-mail, connu avant toute réponse du serveur. Les deux dérivations sont indépendantes :
 * connaître cette clé n'apprend rien de l'autre sans retrouver le mot de passe lui-même.
 */
export async function deriveAuthKey(password: string, email: string): Promise<string> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(AUTH_KEY_CONTEXT + email.trim().toLowerCase()),
      iterations: AUTH_KEY_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    AUTH_KEY_BITS,
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
}
