import { createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

export type CapturedMail = {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
};

/**
 * Serveur SMTP minimal en mémoire : l'API testée envoie ses vrais mails (MAILER=smtp) et les
 * specs lisent ce qui est arrivé. Aucun accès aux internes de l'API → indépendant du framework.
 * Ni AUTH ni STARTTLS annoncés : nodemailer reste en clair, sans authentification.
 */
export class SmtpSink {
  private readonly _messages: CapturedMail[] = [];
  private readonly server: Server = createServer((socket) =>
    this.serve(socket),
  );

  get messages(): readonly CapturedMail[] {
    return this._messages;
  }

  clear(): void {
    this._messages.length = 0;
  }

  listen(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', () =>
        resolve((this.server.address() as AddressInfo).port),
      );
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private serve(socket: Socket): void {
    let buffer = '';
    let inData = false;
    let data: string[] = [];
    let rcpt: string[] = [];
    const reply = (line: string) => socket.write(`${line}\r\n`);

    reply('220 sink ESMTP');
    socket.setEncoding('utf8');
    socket.on('error', () => socket.destroy());
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let eol: number;
      while ((eol = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            this._messages.push(parseMail(rcpt, data.join('\r\n')));
            reply('250 OK');
          } else {
            // Dot-stuffing (RFC 5321 §4.5.2).
            data.push(line.startsWith('..') ? line.slice(1) : line);
          }
          continue;
        }
        const verb = line.slice(0, 4).toUpperCase();
        if (verb === 'EHLO') reply('250 sink');
        else if (verb === 'HELO') reply('250 sink');
        else if (verb === 'MAIL') {
          rcpt = [];
          reply('250 OK');
        } else if (verb === 'RCPT') {
          rcpt.push(/<([^>]*)>/.exec(line)?.[1] ?? '');
          reply('250 OK');
        } else if (verb === 'DATA') {
          inData = true;
          data = [];
          reply('354 End data with <CR><LF>.<CR><LF>');
        } else if (verb === 'QUIT') {
          reply('221 Bye');
          socket.end();
        } else if (verb === 'RSET' || verb === 'NOOP') reply('250 OK');
        else reply('502 Command not implemented');
      }
    });
  }
}

type Part = { headers: Map<string, string>; body: string };

function splitPart(raw: string): Part {
  const sep = raw.indexOf('\r\n\r\n');
  const head = sep === -1 ? raw : raw.slice(0, sep);
  const body = sep === -1 ? '' : raw.slice(sep + 4);
  const headers = new Map<string, string>();
  // Dépliage des en-têtes (RFC 5322 §2.2.3).
  for (const line of head.replace(/\r\n[ \t]+/g, ' ').split('\r\n')) {
    const i = line.indexOf(':');
    if (i > 0)
      headers.set(
        line.slice(0, i).trim().toLowerCase(),
        line.slice(i + 1).trim(),
      );
  }
  return { headers, body };
}

function decodeBody(part: Part): string {
  const encoding = (
    part.headers.get('content-transfer-encoding') ?? ''
  ).toLowerCase();
  if (encoding === 'base64')
    return Buffer.from(part.body.replace(/\s+/g, ''), 'base64').toString(
      'utf8',
    );
  if (encoding === 'quoted-printable') return decodeQuotedPrintable(part.body);
  return part.body;
}

function decodeQuotedPrintable(input: string): string {
  const soft = input.replace(/=\r\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < soft.length; i++) {
    const hex = soft.slice(i + 1, i + 3);
    if (soft[i] === '=' && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...Buffer.from(soft[i], 'utf8'));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

/** Mots encodés RFC 2047 (`=?UTF-8?Q?...?=` / `=?UTF-8?B?...?=`) des en-têtes. */
function decodeHeader(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(
      /=\?[^?]+\?([QBqb])\?([^?]*)\?=/g,
      (_, enc: string, text: string) =>
        enc.toUpperCase() === 'B'
          ? Buffer.from(text, 'base64').toString('utf8')
          : decodeQuotedPrintable(text.replace(/_/g, ' ')),
    );
}

function findTextPlain(part: Part): string | undefined {
  const type = part.headers.get('content-type') ?? 'text/plain';
  const boundary = /boundary="?([^";]+)"?/i.exec(type)?.[1];
  if (type.toLowerCase().startsWith('multipart/') && boundary) {
    for (const chunk of part.body.split(`--${boundary}`).slice(1)) {
      if (chunk.startsWith('--')) break;
      const found = findTextPlain(splitPart(chunk.replace(/^\r\n/, '')));
      if (found !== undefined) return found;
    }
    return undefined;
  }
  return type.toLowerCase().startsWith('text/plain')
    ? decodeBody(part)
    : undefined;
}

function parseMail(to: readonly string[], raw: string): CapturedMail {
  const root = splitPart(raw);
  return {
    to: [...to],
    subject: decodeHeader(root.headers.get('subject') ?? ''),
    text: findTextPlain(root) ?? '',
  };
}
