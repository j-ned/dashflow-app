import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { BillingService } from './billing.service';
import { checkoutSchema } from './dto/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('checkout-session')
  async checkout(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const { planKey } = parseBody(checkoutSchema, body);
    const url = await this.billing.createCheckoutSession(user.id, user.email, planKey);
    return { url };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('portal')
  async portal(@CurrentUser() user: AuthUser) {
    const url = await this.billing.createPortalSession(user.id);
    return { url };
  }

  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    if (!req.rawBody) throw new BadRequestException('Body brut requis');
    await this.billing.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
