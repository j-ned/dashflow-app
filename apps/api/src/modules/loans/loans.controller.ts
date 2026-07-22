import {
  Body,
  Controller,
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
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { today } from '../../common/today';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';
import {
  createLoanSchema,
  createEncryptedLoanSchema,
  updateLoanSchema,
  updateEncryptedLoanSchema,
  loanTransactionSchema,
  loanPaymentSchema,
} from './dto/loan.dto';
import { toLoanResponse } from './loan.response';

@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: LoansService) {
    super();
  }

  @Get()
  override async list(@CurrentUser() u: AuthUser) {
    const rows = await this.svc.list(u.id);
    return rows.map(toLoanResponse);
  }

  @Get(':id')
  override async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return toLoanResponse(row);
  }

  @UseGuards(CsrfGuard)
  @Post()
  @HttpCode(201)
  override async create(
    @CurrentUser() u: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    const row = await this.svc.create(u.id, this.toCreateValues(body));
    return toLoanResponse(row);
  }

  @UseGuards(CsrfGuard)
  @Put(':id')
  override async update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const row = await this.svc.update(u.id, id, this.toUpdatePatch(body));
    if (!row) throw new NotFoundException('Non trouvé');
    return toLoanResponse(row);
  }

  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, memberId, direction } = parseBody(
        createEncryptedLoanSchema,
        body,
      );
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

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedLoanSchema, body);
      const patch: Record<string, unknown> = { encryptedData: d.encryptedData };
      if (d.memberId !== undefined) patch.memberId = d.memberId;
      if (d.direction !== undefined) patch.direction = d.direction;
      return patch;
    }
    const d = parseBody(updateLoanSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.memberId !== undefined) patch.memberId = d.memberId;
    if (d.person !== undefined) patch.person = d.person;
    if (d.direction !== undefined) patch.direction = d.direction;
    if (d.amount !== undefined) patch.amount = d.amount;
    if (d.remaining !== undefined) patch.remaining = d.remaining;
    if (d.description !== undefined) patch.description = d.description;
    if (d.date !== undefined) patch.date = d.date;
    if (d.dueDate !== undefined) patch.dueDate = d.dueDate;
    if (d.dueDay !== undefined) patch.dueDay = d.dueDay;
    return patch;
  }

  // Static path must come before /:id to avoid capture by param route
  @Get('transactions/all')
  allTransactions(@CurrentUser() u: AuthUser) {
    return this.svc.allTransactions(u.id);
  }

  @Get(':id/transactions')
  async transactionsOf(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const rows = await this.svc.transactionsOf(u.id, id);
    if (rows === undefined) throw new NotFoundException('Non trouvé');
    return rows;
  }

  @UseGuards(CsrfGuard)
  @Post(':id/transactions')
  @HttpCode(201)
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
    const row = await this.svc.addTransaction(u.id, id, {
      amount: String(d.amount),
      date: d.date,
    });
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard)
  @Patch(':id/payment')
  async recordPayment(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const d = parseBody(loanPaymentSchema, body);
    const row = await this.svc.recordPayment(u.id, id, {
      amount: d.amount,
      date: d.date,
      note: d.note ?? null,
    });
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return toLoanResponse(row);
  }
}
