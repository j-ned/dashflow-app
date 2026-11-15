import { describe, it, expect } from 'vitest';
import type { ErrorEvent } from '@sentry/node';
import { scrubSentryEvent } from './sentry-scrub';

describe('scrubSentryEvent', () => {
  it('retire les valeurs liées des requêtes SQL, dans les exceptions et le fil d’événements', () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          {
            type: 'DrizzleQueryError',
            value:
              'Failed query: update "users" set "email" = $1 where "id" = $2\nparams: victime@example.test,0b7e…',
          },
        ],
      },
      breadcrumbs: [
        {
          message:
            'Failed query: select 1 where x = $1\nparams: Diabète type 1',
        },
      ],
    };

    const scrubbed = JSON.stringify(scrubSentryEvent(event));

    expect(scrubbed).not.toContain('victime@example.test');
    expect(scrubbed).not.toContain('Diabète');
    expect(scrubbed).toContain('Failed query: update \\"users\\"');
  });

  it('laisse intact un événement sans requête SQL', () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: { values: [{ type: 'Error', value: 'Redis injoignable' }] },
    };

    expect(scrubSentryEvent(event)).toEqual(event);
  });
});
