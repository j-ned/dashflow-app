import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RecurringEntriesService } from './recurring-entries.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createRecurringEntrySchema,
  createEncryptedRecurringEntrySchema,
} from './dto/recurring-entry.dto';

@UseGuards(JwtAuthGuard)
@Controller('recurring-entries')
export class RecurringEntriesController {
  constructor(
    private readonly svc: RecurringEntriesService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData, memberId, accountId } = parseBody(createEncryptedRecurringEntrySchema, body);
      return this.svc.create(u.id, {
        memberId: memberId ?? null,
        accountId: accountId ?? null,
        label: '',
        amount: '0',
        type: 'income',
        encryptedData,
      });
    }
    const d = parseBody(createRecurringEntrySchema, body);
    return this.svc.create(u.id, {
      memberId: d.memberId ?? null,
      accountId: d.accountId ?? null,
      toAccountId: d.toAccountId ?? null,
      label: d.label,
      amount: d.amount,
      type: d.type,
      dayOfMonth: d.dayOfMonth ?? null,
      date: d.date ?? null,
      endDate: d.endDate ?? null,
      category: d.category ?? null,
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
      if (body.memberId !== undefined) patch.memberId = body.memberId;
      if (body.accountId !== undefined) patch.accountId = body.accountId;
    } else {
      const { id: _i, userId: _u, createdAt: _c, ...rest } = body;
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

  // --- Payslip file sub-routes ---

  @UseGuards(CsrfGuard)
  @Post(':id/payslip')
  @UseInterceptors(FileInterceptor('payslip', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadPayslip(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    const existing = await this.svc.getOne(u.id, id);
    if (!existing) throw new NotFoundException('Non trouvé');
    const key = this.storage.payslipKey(u.id, id, file.mimetype);
    await this.storage.upload(key, file.buffer, file.mimetype);
    return this.svc.update(u.id, id, { payslipKey: key });
  }

  @Get(':id/payslip')
  async getPayslip(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const row = await this.svc.getOne(u.id, id);
    if (!row?.payslipKey) throw new NotFoundException('Fiche de paie introuvable');
    const obj = await this.storage.getStream(row.payslipKey);
    if (!obj) throw new NotFoundException('Fiche de paie introuvable');
    res.setHeader('Content-Type', obj.contentType);
    obj.stream.pipe(res);
  }

  @UseGuards(CsrfGuard)
  @Delete(':id/payslip')
  @HttpCode(204)
  async deletePayslip(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    if (row.payslipKey) await this.storage.delete(row.payslipKey);
    await this.svc.update(u.id, id, { payslipKey: null });
  }
}
