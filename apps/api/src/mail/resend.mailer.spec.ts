import { describe, it, expect } from 'vitest';
import { ResendMailer } from './resend.mailer';
import { MAIL_SUBJECTS } from './subjects';
import { SECURITY_NOTICE_CONTENT } from './security-notice.content';

const config = {
  RESEND_API_KEY: 're_test_key',
  MAIL_FROM: 'DashFlow <noreply@dashflow.example>',
  CORS_ORIGIN: 'https://dashflow.example, https://other.example',
};

type SentRequest = { url: string; init: RequestInit };

/** Faux Resend : enregistre la requête et répond `status`. */
function fakeResend(status = 200) {
  const sent: SentRequest[] = [];
  const fetchFn: typeof fetch = (url, init) => {
    sent.push({
      url: url instanceof Request ? url.url : url.toString(),
      init: init ?? {},
    });
    return Promise.resolve(
      new Response(JSON.stringify({ id: 'msg_1' }), { status }),
    );
  };
  /** Seule requête envoyée ; échoue si l'envoi n'a rien envoyé. */
  const only = (): SentRequest => {
    expect(sent).toHaveLength(1);
    const [req] = sent;
    if (!req) throw new Error('aucune requête envoyée');
    return req;
  };
  return { only, fetchFn };
}

function bodyOf(req: SentRequest): Record<string, unknown> {
  if (typeof req.init.body !== 'string')
    throw new Error('corps JSON attendu dans la requête');
  return JSON.parse(req.init.body) as Record<string, unknown>;
}

describe('ResendMailer', () => {
  it("envoie le code de vérification par l'API Resend, avec la clé en Bearer", async () => {
    const { only, fetchFn } = fakeResend();

    await new ResendMailer(config, fetchFn).sendVerificationCode(
      'alice@example.test',
      '123456',
    );

    const req = only();
    expect(req.url).toBe('https://api.resend.com/emails');
    expect(req.init.method).toBe('POST');
    expect(new Headers(req.init.headers).get('authorization')).toBe(
      'Bearer re_test_key',
    );
    const body = bodyOf(req);
    expect(body).toMatchObject({
      from: 'DashFlow <noreply@dashflow.example>',
      to: 'alice@example.test',
      subject: MAIL_SUBJECTS.verification,
    });
    expect(body.text).toContain('123456');
    expect(body.html).toContain('123456');
  });

  it('les liens des mails mènent au site (première origine CORS), pas à l’API', async () => {
    const { only, fetchFn } = fakeResend();

    await new ResendMailer(config, fetchFn).sendSecurityNotice(
      'alice@example.test',
      'reconnect',
    );

    const body = bodyOf(only());
    expect(body.subject).toBe(SECURITY_NOTICE_CONTENT.reconnect.subject);
    expect(body.html).toContain(
      `href="https://dashflow.example${SECURITY_NOTICE_CONTENT.reconnect.cta.path}"`,
    );
  });

  it('un refus de Resend fait échouer l’envoi, sans citer le destinataire', async () => {
    const { fetchFn } = fakeResend(422);

    const sending = new ResendMailer(config, fetchFn).sendPasswordResetCode(
      'alice@example.test',
      '654321',
    );

    await expect(sending).rejects.toThrow(/Resend.*422/);
    await expect(sending).rejects.not.toThrow(/alice/);
  });

  it('Resend injoignable : l’envoi échoue et garde la cause', async () => {
    const network = new TypeError('fetch failed');
    const fetchFn: typeof fetch = () => Promise.reject(network);

    const sending = new ResendMailer(config, fetchFn).sendAccountExists(
      'alice@example.test',
    );

    await expect(sending).rejects.toMatchObject({ cause: network });
  });
});
