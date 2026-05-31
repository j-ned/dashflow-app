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
import { EnvelopesService } from './envelopes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createEnvelopeSchema,
  createEncryptedEnvelopeSchema,
  envelopeTransactionSchema,
  creditEnvelopeSchema,
  creditEncryptedEnvelopeSchema,
} from './dto/envelope.dto';

@UseGuards(JwtAuthGuard)
@Controller('envelopes')
export class EnvelopesController {
  constructor(private readonly svc: EnvelopesService) {}

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
      const { encryptedData, memberId } = parseBody(createEncryptedEnvelopeSchema, body);
      return this.svc.create(u.id, { memberId: memberId ?? null, name: '', type: 'épargne', encryptedData });
    }
    const d = parseBody(createEnvelopeSchema, body);
    return this.svc.create(u.id, {
      memberId: d.memberId ?? null,
      name: d.name,
      type: d.type,
      balance: d.balance ?? '0',
      target: d.target ?? null,
      color: d.color ?? null,
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
    const d = parseBody(envelopeTransactionSchema, body);
    const row = await this.svc.addTransaction(u.id, id, { amount: String(d.amount), date: d.date });
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
    const row = await this.svc.credit(u.id, id, { amount: d.amount, date: d.date });
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
