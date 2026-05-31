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
import { SalaryArchivesService } from './salary-archives.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createSalaryArchiveSchema,
  createEncryptedSalaryArchiveSchema,
} from './dto/salary-archive.dto';

@UseGuards(JwtAuthGuard)
@Controller('salary-archives')
export class SalaryArchivesController {
  constructor(private readonly svc: SalaryArchivesService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Not found');
    return row;
  }

  /**
   * POST / — create an archive.
   * Encrypted mode: JSON body with encryptedData → minimal placeholders stored.
   * Plaintext mode: JSON body with month/salary/etc. → parsed fields stored.
   * Note: the Hono route also accepts multipart/form-data with an optional payslip
   * file upload (stored in S3/R2). File upload is deferred until a StorageModule
   * is implemented; the payslipKey field remains null on create in this port.
   */
  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData, accountId } = parseBody(createEncryptedSalaryArchiveSchema, body);
      return this.svc.create(u.id, {
        accountId: accountId ?? null,
        month: '0000-00',
        salary: '0',
        encryptedData,
      });
    }
    const d = parseBody(createSalaryArchiveSchema, body);
    return this.svc.create(u.id, {
      accountId: d.accountId ?? null,
      month: d.month,
      salary: d.salary,
      totalExpenses: d.totalExpenses ?? '0',
      totalSpendings: d.totalSpendings ?? '0',
      spendings: d.spendings ?? [],
    });
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
      if (body.accountId !== undefined) patch.accountId = body.accountId;
    } else {
      const { id: _i, userId: _u, createdAt: _c, ...rest } = body;
      patch = rest;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Not found');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Not found');
    await this.svc.remove(u.id, id);
  }
}
