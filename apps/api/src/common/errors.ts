/**
 * Erreurs métier indépendantes du framework HTTP. La couche HTTP (filtre global) les traduit
 * en réponse `{ statusCode, error, message }`, comme les exceptions HTTP de Nest avant elles.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Code stable lu par le front (ex. `EMAIL_NOT_VERIFIED`). */
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

/**
 * Surcharge attendue (trop de hachages de mot de passe en cours) : 503 avec `Retry-After`, sans
 * alerte Sentry — ce n'est pas un bug, et une rafale de requêtes ne doit pas inonder les alertes.
 */
export class ServerBusyError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super(
      503,
      'Serveur occupé, réessayez dans quelques secondes',
      'SERVER_BUSY',
    );
  }
}

export class InternalError extends AppError {
  constructor(message: string) {
    super(500, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(503, message);
  }
}
