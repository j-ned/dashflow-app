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
import { LoansService } from './loans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { today } from '../../common/today';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';
import {
  createLoanSchema,
  createEncryptedLoanSchema,
  loanTransactionSchema,
  loanPaymentSchema,
} from './dto/loan.dto';

@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: LoansService) {
    super();
  }

  protected toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, memberId, direction } = parseBody(createEncryptedLoanSchema, body);
      return {
        memberId: memberId ?? null,
        person: '',
        direction: direction ?? 'lent',
        amount: '0',
        remaining: '0',
        date: today(),
        encryptedData,
      };
    }
    const d = parseBody(createLoanSchema, body);
    return {
      memberId: d.memberId ?? null,
      person: d.person,
      direction: d.direction,
      amount: d.amount,
      remaining: d.remaining,
      date: d.date,
      description: d.description ?? null,
      dueDate: d.dueDate ?? null,
      dueDay: d.dueDay ?? null,
    };
  }

  protected toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const patch: Record<string, unknown> = { encryptedData: body.encryptedData };
      if (body.memberId !== undefined) patch.memberId = body.memberId;
      if (body.direction) patch.direction = body.direction;
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
    const d = parseBody(loanTransactionSchema, body);
    const row = await this.svc.addTransaction(u.id, id, { amount: String(d.amount), date: d.date });
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Patch(':id/payment')
  async recordPayment(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const d = parseBody(loanPaymentSchema, body);
    const row = await this.svc.recordPayment(u.id, id, { amount: d.amount, date: d.date, note: d.note ?? null });
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return row;
  }
}
