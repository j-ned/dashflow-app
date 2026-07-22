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
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createBankAccountSchema,
  createEncryptedBankAccountSchema,
  updateBankAccountSchema,
  updateEncryptedBankAccountSchema,
} from './dto/bank-account.dto';
import { toBankAccountResponse } from './bank-account.response';

@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly svc: BankAccountsService) {}

  @Get()
  async list(@CurrentUser() u: AuthUser) {
    const rows = await this.svc.list(u.id);
    return rows.map(toBankAccountResponse);
  }

  @UseGuards(CsrfGuard)
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() u: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(
        createEncryptedBankAccountSchema,
        body,
      );
      const row = await this.svc.create(u.id, { name: '', encryptedData });
      return toBankAccountResponse(row);
    }
    const d = parseBody(createBankAccountSchema, body);
    const row = await this.svc.create(u.id, {
      name: d.name,
      type: d.type ?? 'courant',
      initialBalance: String(d.initialBalance ?? 0),
      color: d.color ?? null,
      dotColor: d.dotColor ?? null,
    });
    return toBankAccountResponse(row);
  }

  @UseGuards(CsrfGuard)
  @Put(':id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedBankAccountSchema, body);
      patch = { encryptedData: d.encryptedData };
    } else {
      const d = parseBody(updateBankAccountSchema, body);
      patch = {};
      if (d.name !== undefined) patch.name = d.name;
      if (d.type !== undefined) patch.type = d.type;
      if (d.initialBalance !== undefined)
        patch.initialBalance = String(d.initialBalance);
      if (d.color !== undefined) patch.color = d.color;
      if (d.dotColor !== undefined) patch.dotColor = d.dotColor;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return toBankAccountResponse(row);
  }

  @UseGuards(CsrfGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(u.id, id);
  }
}
