import { describe, expect, it } from 'vitest';
import { summarizeUserAgent } from './user-agent-summary';

describe('summarizeUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0', 'Firefox · Linux'],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0',
      'Edge · Windows',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Safari · iOS',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
      'Chrome · macOS',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36',
      'Chrome · Android',
    ],
  ])('%s → %s', (ua, expected) => {
    expect(summarizeUserAgent(ua)).toBe(expected);
  });

  it('inconnu ou absent → null', () => {
    expect(summarizeUserAgent('curl/8.0')).toBeNull();
    expect(summarizeUserAgent(null)).toBeNull();
  });
});
