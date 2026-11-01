/** Journal applicatif : aucune dépendance au framework HTTP. */
export type AppLogger = {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, stack?: string): void;
};

const line = (level: string, context: string, message: string): string =>
  `${new Date().toISOString()} ${level} [${context}] ${message}`;

/**
 * Une ligne par événement sur la sortie standard (stdout ; stderr pour warn/error), lue par les
 * logs Docker/Dokploy. Jamais de corps de requête ni de secret : les appelants passent des
 * messages déjà rédigés.
 */
export const createLogger = (context: string): AppLogger => ({
  log: (message) => console.log(line('LOG', context, message)),
  warn: (message) => console.warn(line('WARN', context, message)),
  error: (message, stack) =>
    console.error(
      line('ERROR', context, message) + (stack ? `\n${stack}` : ''),
    ),
});
