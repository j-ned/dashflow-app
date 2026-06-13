import { HttpException, HttpStatus } from '@nestjs/common';

export type LimitKey = 'bankAccounts' | 'members' | 'storageBytes';

/** 402 Payment Required : quota du plan atteint. Le front traduit `code` en paywall ciblé. */
export class LimitExceededException extends HttpException {
  constructor(limit: LimitKey, max: number) {
    super({ code: 'LIMIT_REACHED', limit, max, message: `Limite atteinte (${limit})` }, HttpStatus.PAYMENT_REQUIRED);
  }
}
