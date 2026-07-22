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
import { DocumentsService } from './documents.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { assertValidUpload } from '../../common/files/validate-upload';
import {
  createDocumentSchema,
  createEncryptedDocumentSchema,
  updateDocumentSchema,
  updateEncryptedDocumentSchema,
} from './dto/document.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController extends OwnedCrudController<unknown> {
  constructor(
    protected readonly svc: DocumentsService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, patientId, practitionerId } = parseBody(
        createEncryptedDocumentSchema,
        body,
      );
      return {
        patientId,
        practitionerId: practitionerId ?? null,
        type: 'autre',
        title: '',
        date: '1970-01-01',
        encryptedData,
      };
    }
    const d = parseBody(createDocumentSchema, body);
    return {
      patientId: d.patientId,
      practitionerId: d.practitionerId ?? null,
      type: d.type,
      title: d.title,
      date: d.date,
      fileUrl: d.fileUrl ?? null,
      notes: d.notes ?? null,
    };
  }

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedDocumentSchema, body);
      const patch: Record<string, unknown> = { encryptedData: d.encryptedData };
      if (d.patientId !== undefined) patch.patientId = d.patientId;
      if (d.practitionerId !== undefined)
        patch.practitionerId = d.practitionerId ?? null;
      return patch;
    }
    const d = parseBody(updateDocumentSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.patientId !== undefined) patch.patientId = d.patientId;
    if (d.practitionerId !== undefined)
      patch.practitionerId = d.practitionerId ?? null;
    if (d.type !== undefined) patch.type = d.type;
    if (d.title !== undefined) patch.title = d.title;
    if (d.date !== undefined) patch.date = d.date;
    if (d.fileUrl !== undefined) patch.fileUrl = d.fileUrl ?? null;
    if (d.notes !== undefined) patch.notes = d.notes ?? null;
    return patch;
  }

  // Static route must come before /:id to avoid param capture
  @Get('by-patient/:patientId')
  byPatient(@CurrentUser() u: AuthUser, @Param('patientId') patientId: string) {
    return this.svc.byPatient(u.id, patientId);
  }

  // --- File sub-routes ---

  @UseGuards(CsrfGuard)
  @Post(':id/file')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async uploadFile(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    await assertValidUpload(file);
    const existing = await this.svc.getOne(u.id, id);
    if (!existing) throw new NotFoundException('Non trouvé');
    const key = this.storage.documentKey(u.id, id, file.mimetype);
    await this.storage.upload(key, file.buffer, file.mimetype);
    return this.svc.update(u.id, id, { fileUrl: key });
  }

  @Get(':id/file')
  async getFile(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.svc.getOne(u.id, id);
    if (!doc?.fileUrl) throw new NotFoundException('Fichier introuvable');
    const obj = await this.storage.getStream(doc.fileUrl);
    if (!obj) throw new NotFoundException('Fichier introuvable');
    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('Content-Disposition', 'attachment');
    obj.stream.pipe(res);
  }

  @UseGuards(CsrfGuard)
  @Delete(':id/file')
  @HttpCode(204)
  async deleteFile(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    const doc = await this.svc.getOne(u.id, id);
    if (!doc) throw new NotFoundException('Non trouvé');
    if (doc.fileUrl) await this.storage.delete(doc.fileUrl);
    await this.svc.update(u.id, id, { fileUrl: null });
  }
}
