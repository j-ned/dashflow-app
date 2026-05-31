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
import { RecurringEntriesService } from './recurring-entries.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createRecurringEntrySchema,
  createEncryptedRecurringEntrySchema,
} from './dto/recurring-entry.dto';

@UseGuards(JwtAuthGuard)
@Controller('recurring-entries')
export class RecurringEntriesController {
  constructor(private readonly svc: RecurringEntriesService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData, memberId, accountId } = parseBody(createEncryptedRecurringEntrySchema, body);
      return this.svc.create(u.id, {
        memberId: memberId ?? null,
        accountId: accountId ?? null,
        label: '',
        amount: '0',
        type: 'income',
        encryptedData,
      });
    }
    const d = parseBody(createRecurringEntrySchema, body);
    return this.svc.create(u.id, {
      memberId: d.memberId ?? null,
      accountId: d.accountId ?? null,
      toAccountId: d.toAccountId ?? null,
      label: d.label,
      amount: d.amount,
      type: d.type,
      dayOfMonth: d.dayOfMonth ?? null,
      date: d.date ?? null,
      endDate: d.endDate ?? null,
      category: d.category ?? null,
    });
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      patch = { encryptedData: body.encryptedData };
      if (body.memberId !== undefined) patch.memberId = body.memberId;
      if (body.accountId !== undefined) patch.accountId = body.accountId;
    } else {
      const { id: _i, userId: _u, createdAt: _c, ...rest } = body;
      patch = rest;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(u.id, id);
  }
}
