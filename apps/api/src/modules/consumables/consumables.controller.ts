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
import { createConsumableSchema } from './dto/consumable.dto';

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
    });
  }

  @UseGuards(CsrfGuard)
  @Put(':id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const { id: _i, userId: _u, ...rest } = body;
    // Coerce numeric fields if present
    const patch: Record<string, unknown> = { ...rest };
    if (
      'unitPrice' in patch &&
      patch.unitPrice !== undefined &&
      patch.unitPrice !== null
    ) {
      patch.unitPrice = String(Number(patch.unitPrice));
    }
    if ('quantity' in patch && patch.quantity !== undefined) {
      patch.quantity = Number(patch.quantity);
    }
    if ('minThreshold' in patch && patch.minThreshold !== undefined) {
      patch.minThreshold = Number(patch.minThreshold);
    }
    if (
      'estimatedLifetimeDays' in patch &&
      patch.estimatedLifetimeDays !== undefined &&
      patch.estimatedLifetimeDays !== null
    ) {
      patch.estimatedLifetimeDays = Number(patch.estimatedLifetimeDays);
    }
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
