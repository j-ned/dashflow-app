import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ConsumablesService } from './consumables.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createConsumableSchema,
  updateConsumableSchema,
} from './dto/consumable.dto';

@UseGuards(JwtAuthGuard)
@Controller('consumables')
export class ConsumablesController {
  constructor(private readonly svc: ConsumablesService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }

  @UseGuards(CsrfGuard)
  @Post()
  @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: unknown) {
    const d = parseBody(createConsumableSchema, body);
    return this.svc.create(u.id, {
      name: d.name,
      category: d.category,
      quantity: d.quantity,
      minThreshold: d.minThreshold,
      unitPrice: String(d.unitPrice),
      lastRestocked: d.lastRestocked ?? null,
      installedAt: d.installedAt ?? null,
      estimatedLifetimeDays: d.estimatedLifetimeDays ?? null,
      memberId: d.memberId ?? null,
    });
  }

  @UseGuards(CsrfGuard)
  @Put(':id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const d = parseBody(updateConsumableSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.name !== undefined) patch.name = d.name;
    if (d.category !== undefined) patch.category = d.category;
    if (d.quantity !== undefined) patch.quantity = d.quantity;
    if (d.minThreshold !== undefined) patch.minThreshold = d.minThreshold;
    if (d.unitPrice !== undefined) patch.unitPrice = String(d.unitPrice);
    if (d.lastRestocked !== undefined) patch.lastRestocked = d.lastRestocked;
    if (d.installedAt !== undefined) patch.installedAt = d.installedAt;
    if (d.estimatedLifetimeDays !== undefined)
      patch.estimatedLifetimeDays = d.estimatedLifetimeDays;
    if (d.memberId !== undefined) patch.memberId = d.memberId;
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(u.id, id);
  }
}
