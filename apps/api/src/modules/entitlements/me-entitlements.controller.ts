import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { EntitlementService } from './entitlement.service';
import type { ResolvedEntitlement } from './entitlement.resolver';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeEntitlementsController {
  constructor(private readonly entitlements: EntitlementService) {}

  @Get('entitlements')
  me(@CurrentUser() user: AuthUser): Promise<ResolvedEntitlement> {
    return this.entitlements.getForUser(user.id);
  }
}
