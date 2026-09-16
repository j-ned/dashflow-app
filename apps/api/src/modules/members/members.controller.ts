import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { parsePageQuery, sendPage } from '../../common/crud/keyset';
import { clientRowId } from '../../common/crud/client-row-id';
import {
  updateMemberColorSchema,
  createMemberSchema,
  updateMemberSchema,
  encryptedMemberSchema,
} from './dto/member.dto';

export const MEMBER_HAS_MEDICAL_DATA = 'MEMBER_HAS_MEDICAL_DATA';

@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly svc: MembersService) {}

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Query() query: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendPage(res, await this.svc.list(u.id, parsePageQuery(query)));
  }

  @UseGuards(CsrfGuard)
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() u: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(encryptedMemberSchema, body);
      return this.svc.create(u.id, { encryptedData, ...clientRowId(body) });
    }
    const d = parseBody(createMemberSchema, body);
    return this.svc.create(u.id, {
      firstName: d.firstName,
      lastName: d.lastName ?? '',
      color: d.color ?? null,
    });
  }

  @UseGuards(CsrfGuard)
  @Put(':id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      const { encryptedData } = parseBody(encryptedMemberSchema, body);
      patch = { encryptedData };
    } else {
      const d = parseBody(updateMemberSchema, body);
      patch = {
        firstName: d.firstName,
        lastName: d.lastName ?? '',
        color: d.color ?? null,
      };
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  /**
   * Un membre est aussi un patient : le supprimer efface (cascade) ses RDV, ordonnances,
   * médicaments et documents. Sans `?force=true`, on refuse (409) en renvoyant les compteurs
   * pour que le front énumère ce qui va disparaître avant de redemander avec `force`.
   */
  @UseGuards(CsrfGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ) {
    const footprint = await this.svc.medicalFootprint(u.id, id);
    if (!footprint) return; // idempotent : déjà supprimé ou inconnu → 204
    const total = Object.values(footprint).reduce((s, n) => s + n, 0);
    if (total > 0 && force !== 'true') {
      throw new ConflictException({
        message: 'Ce membre a un dossier médical qui serait supprimé avec lui',
        code: MEMBER_HAS_MEDICAL_DATA,
        details: footprint,
      });
    }
    await this.svc.remove(u.id, id);
  }

  @UseGuards(CsrfGuard)
  @Patch(':id/color')
  async color(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { color } = parseBody(updateMemberColorSchema, body);
    const row = await this.svc.updateColor(u.id, id, color);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }
}
