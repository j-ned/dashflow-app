import {
  Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import { AccountTransactionsService } from './account-transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../entitlements/feature.guard';
import { RequiresFeature } from '../entitlements/requires-feature.decorator';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { createTransactionSchema, createEncryptedTransactionSchema, batchTransactionSchema } from './dto/account-transaction.dto';
import { today } from '../../common/today';

@UseGuards(JwtAuthGuard)
@Controller()
export class AccountTransactionsController {
  constructor(private readonly svc: AccountTransactionsService) {}

  @Get('transactions/all')
  listAll(@CurrentUser() u: AuthUser) { return this.svc.listAll(u.id); }

  @Get('bank-accounts/:accountId/transactions')
  listOfAccount(@CurrentUser() u: AuthUser, @Param('accountId') accountId: string) {
    return this.svc.listOfAccount(u.id, accountId);
  }

  @UseGuards(CsrfGuard) @Post('bank-accounts/:accountId/transactions') @HttpCode(201)
  async create(
    @CurrentUser() u: AuthUser,
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (body.encryptedData) {
      const d = parseBody(createEncryptedTransactionSchema, body);
      const row = await this.svc.addTransaction(u.id, accountId, {
        amount: '0', date: today(),
        direction: d.direction, toAccountId: d.toAccountId ?? null,
        memberId: d.memberId ?? null, recurringEntryId: d.recurringEntryId ?? null,
        encryptedData: d.encryptedData,
      });
      if (row === undefined) throw new NotFoundException('Compte non trouvé');
      return row;
    }
    const d = parseBody(createTransactionSchema, body);
    const row = await this.svc.addTransaction(u.id, accountId, {
      amount: d.amount, direction: d.direction, date: d.date,
      toAccountId: d.toAccountId ?? null, category: d.category ?? null, note: d.note ?? null,
      memberId: d.memberId ?? null, recurringEntryId: d.recurringEntryId ?? null,
    });
    if (row === undefined) throw new NotFoundException('Compte non trouvé');
    return row;
  }

  @RequiresFeature('budget.import')
  @UseGuards(FeatureGuard)
  @UseGuards(CsrfGuard) @Post('bank-accounts/:accountId/transactions/batch') @HttpCode(201)
  async createBatch(
    @CurrentUser() u: AuthUser,
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const { items } = parseBody(batchTransactionSchema, body);
    const mapped = items.map((raw) => {
      if (raw.encryptedData) {
        const d = parseBody(createEncryptedTransactionSchema, raw);
        return {
          amount: '0', date: today(), direction: d.direction, toAccountId: d.toAccountId ?? null,
          memberId: d.memberId ?? null, recurringEntryId: d.recurringEntryId ?? null, encryptedData: d.encryptedData,
        };
      }
      const d = parseBody(createTransactionSchema, raw);
      return {
        amount: d.amount, direction: d.direction, date: d.date, toAccountId: d.toAccountId ?? null,
        category: d.category ?? null, note: d.note ?? null, memberId: d.memberId ?? null, recurringEntryId: d.recurringEntryId ?? null,
      };
    });
    const rows = await this.svc.addBatch(u.id, accountId, mapped);
    if (rows === undefined) throw new NotFoundException('Compte non trouvé');
    return rows;
  }

  @UseGuards(CsrfGuard) @Put('transactions/:id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      patch = { encryptedData: body.encryptedData };
      for (const k of ['direction', 'toAccountId', 'memberId', 'recurringEntryId'] as const) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
    } else {
      const { id: _i, userId: _u, accountId: _a, createdAt: _c, ...rest } = body;
      patch = rest;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete('transactions/:id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(u.id, id);
  }
}
