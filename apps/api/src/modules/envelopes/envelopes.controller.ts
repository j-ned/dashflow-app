import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EnvelopesService } from './envelopes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../entitlements/feature.guard';
import { RequiresFeature } from '../entitlements/requires-feature.decorator';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { today } from '../../common/today';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';
import {
  createEnvelopeSchema,
  createEncryptedEnvelopeSchema,
  envelopeTransactionSchema,
  creditEnvelopeSchema,
  creditEncryptedEnvelopeSchema,
} from './dto/envelope.dto';

@RequiresFeature('budget.advanced')
@UseGuards(JwtAuthGuard, FeatureGuard)
@Controller('envelopes')
export class EnvelopesController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: EnvelopesService) {
    super();
  }

  protected toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, memberId } = parseBody(createEncryptedEnvelopeSchema, body);
      return { memberId: memberId ?? null, name: '', type: 'épargne', encryptedData };
    }
    const d = parseBody(createEnvelopeSchema, body);
    return {
      memberId: d.memberId ?? null,
      name: d.name,
      type: d.type,
      balance: d.balance ?? '0',
      target: d.target ?? null,
      color: d.color ?? null,
      dueDay: d.dueDay ?? null,
    };
  }

  protected toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const patch: Record<string, unknown> = { encryptedData: body.encryptedData };
      if (body.memberId !== undefined) patch.memberId = body.memberId;
      return patch;
    }
    const { id: _i, userId: _u, ...rest } = body;
    return rest;
  }

  // Static path must come before /:id to avoid capture by param route
  @Get('transactions/all')
  allTransactions(@CurrentUser() u: AuthUser) { return this.svc.allTransactions(u.id); }

  @Get(':id/transactions')
  async transactionsOf(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const rows = await this.svc.transactionsOf(u.id, id);
    if (rows === undefined) throw new NotFoundException('Non trouvé');
    return rows;
  }

  @UseGuards(CsrfGuard) @Post(':id/transactions') @HttpCode(201)
  async addTransaction(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (body.encryptedData) {
      const row = await this.svc.addTransaction(u.id, id, {
        amount: '0',
        date: today(),
        encryptedData: body.encryptedData as string,
      });
      if (row === undefined) throw new NotFoundException('Non trouvé');
      return row;
    }
    const d = parseBody(envelopeTransactionSchema, body);
    const row = await this.svc.addTransaction(u.id, id, { amount: String(d.amount), date: d.date, note: d.note ?? null });
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Patch(':id/balance')
  async credit(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(creditEncryptedEnvelopeSchema, body);
      const row = await this.svc.credit(u.id, id, { encryptedData });
      if (row === undefined) throw new NotFoundException('Non trouvé');
      return row;
    }
    const d = parseBody(creditEnvelopeSchema, body);
    const row = await this.svc.credit(u.id, id, { amount: d.amount, date: d.date, note: d.note ?? null });
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return row;
  }
}
