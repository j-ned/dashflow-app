import { Logger as NestLogger } from '@nestjs/common';

/** Journal applicatif vu du code métier : aucune dépendance au framework HTTP. */
export type AppLogger = {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, stack?: string): void;
};

/**
 * Seul point d'attache au logger du framework (format et niveaux de Nest tant que l'API tourne
 * sous Nest). La couche métier n'appelle que cette fabrique.
 */
export const createLogger = (context: string): AppLogger =>
  new NestLogger(context);
