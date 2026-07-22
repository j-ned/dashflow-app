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
import { EnvelopesService } from './envelopes.service';
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
  createEnvelopeSchema,
  createEncryptedEnvelopeSchema,
  updateEnvelopeSchema,
  updateEncryptedEnvelopeSchema,
  envelopeTransactionSchema,
  creditEnvelopeSchema,
  creditEncryptedEnvelopeSchema,
} from './dto/envelope.dto';
import { toEnvelopeResponse } from './envelope.response';

@UseGuards(JwtAuthGuard)
@Controller('envelopes')
export class EnvelopesController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: EnvelopesService) {
    super();
  }

  @Get()
  override async list(@CurrentUser() u: AuthUser) {
    const rows = await this.svc.list(u.id);
    return rows.map(toEnvelopeResponse);
  }

  @Get(':id')
  override async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return toEnvelopeResponse(row);
  }

  @UseGuards(CsrfGuard)
  @Post()
  @HttpCode(201)
  override async create(
    @CurrentUser() u: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    const row = await this.svc.create(u.id, this.toCreateValues(body));
    return toEnvelopeResponse(row);
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
    return toEnvelopeResponse(row);
  }

  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, memberId } = parseBody(
        createEncryptedEnvelopeSchema,
        body,
      );
      return {
        memberId: memberId ?? null,
        name: '',
        type: 'épargne',
        encryptedData,
      };
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

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedEnvelopeSchema, body);
      const patch: Record<string, unknown> = { encryptedData: d.encryptedData };
      if (d.memberId !== undefined) patch.memberId = d.memberId;
      return patch;
    }
    const d = parseBody(updateEnvelopeSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.memberId !== undefined) patch.memberId = d.memberId;
    if (d.name !== undefined) patch.name = d.name;
    if (d.type !== undefined) patch.type = d.type;
    if (d.balance !== undefined) patch.balance = d.balance;
    if (d.target !== undefined) patch.target = d.target;
    if (d.color !== undefined) patch.color = d.color;
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
    const d = parseBody(envelopeTransactionSchema, body);
    const row = await this.svc.addTransaction(u.id, id, {
      amount: String(d.amount),
      date: d.date,
      note: d.note ?? null,
    });
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard)
  @Patch(':id/balance')
  async credit(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(creditEncryptedEnvelopeSchema, body);
      const row = await this.svc.credit(u.id, id, { encryptedData });
      if (row === undefined) throw new NotFoundException('Non trouvé');
      return toEnvelopeResponse(row);
    }
    const d = parseBody(creditEnvelopeSchema, body);
    const row = await this.svc.credit(u.id, id, {
      amount: d.amount,
      date: d.date,
      note: d.note ?? null,
    });
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return toEnvelopeResponse(row);
  }
}
