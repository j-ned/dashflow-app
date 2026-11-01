import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { SECURITY_NOTICE_CONTENT } from '../../src/mail/security-notice.content';
import type { NoticeReason } from '../../src/modules/admin/account-security';
import { SmtpSink } from './smtp-sink';

/**
 * Harnais e2e boîte noire : démarre l'API dans un PROCESSUS SÉPARÉ et ne lui parle qu'en HTTP
 * (et en SMTP pour les mails). Rien ici ne dépend du framework de l'API : la même suite valide
 * l'implémentation NestJS et sa remplaçante.
 *
 * - `E2E_API_CMD` : commande de démarrage (défaut `node dist/main.js`, après `nest build`).
 *   Découpée sur les espaces, sans gestion des guillemets.
 * - `E2E_API_LOGS=1` : recopie stdout/stderr du serveur dans la sortie des tests.
 *
 * Un serveur par fichier de spec : les compteurs de throttling sont en mémoire, par processus.
 */
const DEFAULT_CMD = 'node dist/main.js';
// Racine de vitest (`root: './'` dans vitest.e2e.config.ts) = apps/api, comme pour le chargement du .env.
const API_ROOT = resolve(process.cwd());
const READY_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 10_000;

const NOTICE_BY_SUBJECT = new Map(
  (
    Object.entries(SECURITY_NOTICE_CONTENT) as [
      NoticeReason,
      { subject: string },
    ][]
  ).map(([reason, content]) => [content.subject, reason]),
);

export type MailBox = {
  /** Dernier code (vérification ou réinitialisation) envoyé, tous destinataires confondus. */
  readonly lastCode: string;
  /** Relances de sécurité reçues, dans l'ordre d'envoi. */
  readonly notices: { to: string; reason: NoticeReason }[];
  clear(): void;
};

export type E2eApi = {
  readonly url: string;
  readonly mail: MailBox;
  stop(): Promise<void>;
};

const CODE_PATTERN = /code de (?:vérification|réinitialisation) est : (\S+)/;

function mailBox(sink: SmtpSink): MailBox {
  return {
    get lastCode() {
      for (let i = sink.messages.length - 1; i >= 0; i--) {
        const code = CODE_PATTERN.exec(sink.messages[i].text)?.[1];
        if (code) return code;
      }
      return '';
    },
    get notices() {
      return sink.messages.flatMap((m) => {
        const reason = NOTICE_BY_SUBJECT.get(m.subject);
        return reason ? m.to.map((to) => ({ to, reason })) : [];
      });
    },
    clear: () => sink.clear(),
  };
}

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => done(port));
    });
  });
}

function exited(child: ChildProcess): Promise<void> {
  return new Promise((done) => {
    if (child.exitCode !== null || child.signalCode !== null) done();
    else child.once('exit', () => done());
  });
}

async function waitUntilReady(
  url: string,
  child: ChildProcess,
  logs: () => string,
) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `L'API s'est arrêtée au démarrage (code ${child.exitCode}) :\n${logs()}`,
      );
    try {
      if ((await fetch(`${url}/health`)).ok) return;
    } catch {
      // Pas encore à l'écoute.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `L'API n'a pas répondu sur ${url}/health en ${READY_TIMEOUT_MS} ms :\n${logs()}`,
  );
}

export async function startApi(
  opts: {
    env?: Readonly<Record<string, string>>;
    /** Commande imposée (prime sur E2E_API_CMD) : sert à comparer deux implémentations. */
    cmd?: string;
  } = {},
): Promise<E2eApi> {
  const sink = new SmtpSink();
  const smtpPort = await sink.listen();
  const port = await freePort();
  const [cmd, ...args] = (opts.cmd ?? process.env.E2E_API_CMD ?? DEFAULT_CMD)
    .split(/\s+/)
    .filter(Boolean);

  const child = spawn(cmd, args, {
    cwd: API_ROOT,
    env: {
      ...process.env,
      ...opts.env,
      PORT: String(port),
      MAILER: 'smtp',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(smtpPort),
      SMTP_SECURE: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const capture = (chunk: Buffer) => {
    output += chunk.toString();
    if (process.env.E2E_API_LOGS === '1') process.stdout.write(chunk);
  };
  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);

  const url = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS);
      await exited(child);
      clearTimeout(timer);
    }
    await sink.close();
  };

  try {
    await waitUntilReady(url, child, () => output);
  } catch (err) {
    await stop();
    throw err;
  }
  return { url, mail: mailBox(sink), stop };
}
