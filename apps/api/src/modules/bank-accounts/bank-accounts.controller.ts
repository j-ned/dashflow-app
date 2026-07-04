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
import { excludeSystemFields } from '../../common/crud/exclude-system-fields';
import {
  createBankAccountSchema,
  createEncryptedBankAccountSchema,
} from './dto/bank-account.dto';

@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly svc: BankAccountsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
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
      return this.svc.create(u.id, { name: '', encryptedData });
    }
    const d = parseBody(createBankAccountSchema, body);
    return this.svc.create(u.id, {
      name: d.name,
      type: d.type ?? 'courant',
      initialBalance: String(d.initialBalance ?? 0),
      color: d.color ?? null,
      dotColor: d.dotColor ?? null,
    });
  }

  @UseGuards(CsrfGuard)
  @Put(':id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const patch = body.encryptedData
      ? { encryptedData: body.encryptedData }
      : excludeSystemFields(body);
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(u.id, id);
  }
}
