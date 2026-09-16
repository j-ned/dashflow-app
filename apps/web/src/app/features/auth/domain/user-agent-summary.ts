/** « Firefox · Linux », « Safari · iPhone »… à partir d'un User-Agent brut. `null` si inconnu. */
export function summarizeUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('OPR/') || ua.includes('Opera')
      ? 'Opera'
      : ua.includes('Firefox/')
        ? 'Firefox'
        : ua.includes('Chrome/') || ua.includes('CriOS/')
          ? 'Chrome'
          : ua.includes('Safari/')
            ? 'Safari'
            : null;
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : ua.includes('Android')
      ? 'Android'
      : ua.includes('Windows')
        ? 'Windows'
        : ua.includes('Mac OS X')
          ? 'macOS'
          : ua.includes('CrOS')
            ? 'ChromeOS'
            : ua.includes('Linux')
              ? 'Linux'
              : null;
  if (!browser && !os) return null;
  return [browser, os].filter(Boolean).join(' · ');
}
