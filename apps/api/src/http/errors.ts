import { AppError } from '../common/errors';

/** Erreurs propres à la couche HTTP (pas de sens métier). */
export class PayloadTooLargeError extends AppError {
  constructor() {
    super(413, 'Corps de requête trop volumineux');
  }
}

export class TooManyRequestsError extends AppError {
  constructor() {
    // Message historique de @nestjs/throttler, conservé pour le front.
    super(429, 'ThrottlerException: Too Many Requests');
  }
}
