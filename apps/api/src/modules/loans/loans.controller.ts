import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { LoansService } from './loans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createLoanSchema,
  createEncryptedLoanSchema,
  loanTransactionSchema,
  loanPaymentSchema,
} from './dto/loan.dto';

@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly svc: LoansService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  // Static path must come before /:id to avoid capture by param route
  @Get('transactions/all')
  allTransactions(@CurrentUser() u: AuthUser) { return this.svc.allTransactions(u.id); }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @Get(':id/transactions')
  async transactionsOf(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const rows = await this.svc.transactionsOf(u.id, id);
    if (rows === undefined) throw new NotFoundException('Non trouvé');
    return rows;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData, memberId, direction } = parseBody(createEncryptedLoanSchema, body);
      return this.svc.create(u.id, {
        memberId: memberId ?? null,
        person: '',
        direction: direction ?? 'lent',
        amount: '0',
        remaining: '0',
        date: new Date().toISOString().slice(0, 10),
        encryptedData,
      });
    }
    const d = parseBody(createLoanSchema, body);
    return this.svc.create(u.id, {
      memberId: d.memberId ?? null,
      person: d.person,
      direction: d.direction,
      amount: d.amount,
      remaining: d.remaining,
      date: d.date,
      description: d.description ?? null,
      dueDate: d.dueDate ?? null,
      dueDay: d.dueDay ?? null,
    });
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
        date: new Date().toISOString().slice(0, 10),
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
    const row = await this.svc.recordPayment(u.id, id, { amount: d.amount, date: d.date });
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return row;
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
      if (body.direction) patch.direction = body.direction;
    } else {
      const { id: _i, userId: _u, ...rest } = body;
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
