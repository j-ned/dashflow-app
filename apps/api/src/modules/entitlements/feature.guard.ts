import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementService } from './entitlement.service';
import { REQUIRES_FEATURE } from './requires-feature.decorator';
import type { Feature } from './plan-catalog';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Feature[] | undefined>(REQUIRES_FEATURE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Non authentifié');

    const entitlement = await this.entitlements.getForUser(userId);
    const allowed = required.every((feature) => entitlement.features.includes(feature));
    if (!allowed) throw new ForbiddenException('Plan insuffisant pour cette fonctionnalité');
    return true;
  }
}
