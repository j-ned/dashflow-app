import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SalaryArchivesService } from './salary-archives.service';
import { StorageService } from '../../storage/storage.service';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createSalaryArchiveSchema,
  createEncryptedSalaryArchiveSchema,
} from './dto/salary-archive.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';

@Controller('salary-archives')
export class SalaryArchivesController extends OwnedCrudController<unknown> {
  constructor(
    protected readonly svc: SalaryArchivesService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  /**
   * POST / — create an archive.
   * Encrypted mode: JSON body with encryptedData → minimal placeholders stored.
   * Plaintext mode: JSON body with month/salary/etc. → parsed fields stored.
   * Note: the Hono route also accepts multipart/form-data with an optional payslip
   * file upload (stored in S3/R2). File upload is deferred until a StorageModule
   * is implemented; the payslipKey field remains null on create in this port.
   */
  protected toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, accountId } = parseBody(createEncryptedSalaryArchiveSchema, body);
      return {
        accountId: accountId ?? null,
        month: '0000-00',
        salary: '0',
        encryptedData,
      };
    }
    const d = parseBody(createSalaryArchiveSchema, body);
    return {
      accountId: d.accountId ?? null,
      month: d.month,
      salary: d.salary,
      totalExpenses: d.totalExpenses ?? '0',
      totalSpendings: d.totalSpendings ?? '0',
      spendings: d.spendings ?? [],
    };
  }

  protected toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const patch: Record<string, unknown> = { encryptedData: body.encryptedData };
      if (body.accountId !== undefined) patch.accountId = body.accountId;
      return patch;
    }
    const { id: _i, userId: _u, createdAt: _c, ...rest } = body;
    return rest;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  override async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Not found');
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
