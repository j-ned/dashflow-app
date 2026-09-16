import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccountTransactionsService } from './account-transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createTransactionSchema,
  createEncryptedTransactionSchema,
  updateTransactionSchema,
  updateEncryptedTransactionSchema,
  batchTransactionSchema,
} from './dto/account-transaction.dto';
import { today } from '../../common/today';
import { parsePageQuery, sendPage } from '../../common/crud/keyset';

@UseGuards(JwtAuthGuard)
@Controller()
export class AccountTransactionsController {
  constructor(private readonly svc: AccountTransactionsService) {}

  @Get('transactions/all')
  async listAll(
    @CurrentUser() u: AuthUser,
    @Query() query: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendPage(res, await this.svc.listAll(u.id, parsePageQuery(query)));
  }

  @Get('bank-accounts/:accountId/transactions')
  async listOfAccount(
    @CurrentUser() u: AuthUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query() query: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendPage(
      res,
      await this.svc.listOfAccount(u.id, accountId, parsePageQuery(query)),
    );
  }

  @UseGuards(CsrfGuard)
  @Post('bank-accounts/:accountId/transactions')
  @HttpCode(201)
  async create(
    @CurrentUser() u: AuthUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (body.encryptedData) {
      const d = parseBody(createEncryptedTransactionSchema, body);
      const row = await this.svc.addTransaction(u.id, accountId, {
        amount: '0',
        date: today(),
        direction: d.direction,
        toAccountId: d.toAccountId ?? null,
        memberId: d.memberId ?? null,
        recurringEntryId: d.recurringEntryId ?? null,
        encryptedData: d.encryptedData,
      });
      if (row === undefined) throw new NotFoundException('Compte non trouvé');
      return row;
    }
    const d = parseBody(createTransactionSchema, body);
    const row = await this.svc.addTransaction(u.id, accountId, {
      amount: d.amount,
      direction: d.direction,
      date: d.date,
      toAccountId: d.toAccountId ?? null,
      category: d.category ?? null,
      note: d.note ?? null,
      memberId: d.memberId ?? null,
      recurringEntryId: d.recurringEntryId ?? null,
    });
    if (row === undefined) throw new NotFoundException('Compte non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard)
  @Post('bank-accounts/:accountId/transactions/batch')
  @HttpCode(201)
  async createBatch(
    @CurrentUser() u: AuthUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const { items } = parseBody(batchTransactionSchema, body);
    const mapped = items.map((raw) => {
      if (raw.encryptedData) {
        const d = parseBody(createEncryptedTransactionSchema, raw);
        return {
          amount: '0',
          date: today(),
          direction: d.direction,
          toAccountId: d.toAccountId ?? null,
          memberId: d.memberId ?? null,
          recurringEntryId: d.recurringEntryId ?? null,
          encryptedData: d.encryptedData,
        };
      }
      const d = parseBody(createTransactionSchema, raw);
      return {
        amount: d.amount,
        direction: d.direction,
        date: d.date,
        toAccountId: d.toAccountId ?? null,
        category: d.category ?? null,
        note: d.note ?? null,
        memberId: d.memberId ?? null,
        recurringEntryId: d.recurringEntryId ?? null,
      };
    });
    const rows = await this.svc.addBatch(u.id, accountId, mapped);
    if (rows === undefined) throw new NotFoundException('Compte non trouvé');
    return rows;
  }

  @UseGuards(CsrfGuard)
  @Put('transactions/:id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedTransactionSchema, body);
      patch = { encryptedData: d.encryptedData };
      if (d.direction !== undefined) patch.direction = d.direction;
      if (d.toAccountId !== undefined) patch.toAccountId = d.toAccountId;
      if (d.memberId !== undefined) patch.memberId = d.memberId;
      if (d.recurringEntryId !== undefined)
        patch.recurringEntryId = d.recurringEntryId;
    } else {
      const d = parseBody(updateTransactionSchema, body);
      patch = {};
      if (d.amount !== undefined) patch.amount = d.amount;
      if (d.direction !== undefined) patch.direction = d.direction;
      if (d.toAccountId !== undefined) patch.toAccountId = d.toAccountId;
      if (d.date !== undefined) patch.date = d.date;
      if (d.category !== undefined) patch.category = d.category;
      if (d.note !== undefined) patch.note = d.note;
      if (d.memberId !== undefined) patch.memberId = d.memberId;
      if (d.recurringEntryId !== undefined)
        patch.recurringEntryId = d.recurringEntryId;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard)
  @Delete('transactions/:id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.svc.remove(u.id, id);
  }
}
