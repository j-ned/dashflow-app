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
import { DocumentsService } from './documents.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { createDocumentSchema, createEncryptedDocumentSchema } from './dto/document.dto';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly svc: DocumentsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  // Static route must come before /:id to avoid param capture
  @Get('by-patient/:patientId')
  byPatient(@CurrentUser() u: AuthUser, @Param('patientId') patientId: string) {
    return this.svc.byPatient(u.id, patientId);
  }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData, patientId, practitionerId } = parseBody(createEncryptedDocumentSchema, body);
      return this.svc.create(u.id, {
        patientId,
        practitionerId: practitionerId ?? null,
        type: 'autre',
        title: '',
        date: '1970-01-01',
        encryptedData,
      });
    }
    const d = parseBody(createDocumentSchema, body);
    return this.svc.create(u.id, {
      patientId: d.patientId,
      practitionerId: d.practitionerId ?? null,
      type: d.type,
      title: d.title,
      date: d.date,
      fileUrl: d.fileUrl ?? null,
      notes: d.notes ?? null,
    });
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      patch = { encryptedData: body.encryptedData };
      if (body.patientId !== undefined) patch.patientId = body.patientId;
      if (body.practitionerId !== undefined) patch.practitionerId = body.practitionerId ?? null;
    } else {
      const { id: _i, userId: _u, ...rest } = body;
      patch = rest;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { await this.svc.remove(u.id, id); }

  // --- File sub-routes ---

  @UseGuards(CsrfGuard)
  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadFile(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    const existing = await this.svc.getOne(u.id, id);
    if (!existing) throw new NotFoundException('Non trouvé');
    const key = this.storage.documentKey(u.id, id, file.mimetype);
    await this.storage.upload(key, file.buffer, file.mimetype);
    return this.svc.update(u.id, id, { fileUrl: key });
  }

  @Get(':id/file')
  async getFile(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const doc = await this.svc.getOne(u.id, id);
    if (!doc?.fileUrl) throw new NotFoundException('Fichier introuvable');
    const obj = await this.storage.getStream(doc.fileUrl);
    if (!obj) throw new NotFoundException('Fichier introuvable');
    res.setHeader('Content-Type', obj.contentType);
    obj.stream.pipe(res);
  }

  @UseGuards(CsrfGuard)
  @Delete(':id/file')
  @HttpCode(204)
  async deleteFile(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    const doc = await this.svc.getOne(u.id, id);
    if (!doc) throw new NotFoundException('Non trouvé');
    if (doc.fileUrl) await this.storage.delete(doc.fileUrl);
    await this.svc.update(u.id, id, { fileUrl: null });
  }
}
