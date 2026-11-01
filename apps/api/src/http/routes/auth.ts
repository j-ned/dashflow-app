import { Hono } from 'hono';
import { Readable } from 'node:stream';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../../common/errors';
import { assertValidImageUpload } from '../../common/files/validate-upload';
import { toKeyMaterial, toPublicUser } from '../../auth/auth.response';
import {
  backupCodesRegenerateSchema,
  forgotPasswordSchema,
  loginSchema,
  migrateEncryptionSchema,
  preloginSchema,
  registerSchema,
  resendSchema,
  resetPasswordSchema,
  resetWithRecoverySchema,
  setPasswordSchema,
  setupEncryptionKeysSchema,
  totpDisableSchema,
  totpVerifySchema,
  updatePasswordSchema,
  updateProfileSchema,
  upgradeAuthSchema,
  verifySchema,
} from '../../auth/dto/auth.dto';
import type { HttpDeps } from '../deps';
import {
  resultError,
  securityEvent,
  uploadLimit,
  uploadedFile,
  uuidParam,
} from '../kit';
import { csrfOnMutations, rejectDemo, requireAuth } from '../middleware/auth';
import {
  STRICT_THROTTLE,
  throttle,
  throttleByEmail,
} from '../middleware/rate-limit';
import type { AppEnv } from '../types';
import { jsonBody } from '../validate';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Routes /auth (contrôleurs Nest AuthController + EncryptionController). */
export function authRoutes(d: HttpDeps) {
  const demoEnabled = d.env.DEMO_ENABLED;
  // Session + CSRF sur toute mutation : appliqué ensemble à chaque route authentifiée.
  const authed = [
    requireAuth(d.sessions),
    csrfOnMutations(d.csrfPolicy),
  ] as const;
  const strict = throttle(STRICT_THROTTLE);
  const byEmail = throttleByEmail(d.rateLimits, STRICT_THROTTLE);
  const event = (opts: Parameters<typeof securityEvent>[1]) =>
    securityEvent(d.securityEvents, opts);

  return (
    new Hono<AppEnv>()
      .post('/register', strict, async (c) => {
        const r = await d.auth.register(await jsonBody(c, registerSchema));
        if (!r.success) throw resultError(r);
        return c.json({ message: 'Compte créé, vérifiez votre email' }, 201);
      })

      .post(
        '/verify',
        strict,
        byEmail,
        event({ success: 'email_verified' }),
        async (c) => {
          const r = await d.auth.verify(await jsonBody(c, verifySchema));
          if (!r.success) throw resultError(r);
          const csrfToken = await d.sessionCookies.open(c, r.data);
          return c.json({
            user: toPublicUser(r.data),
            keyMaterial: toKeyMaterial(r.data),
            csrfToken,
          });
        },
      )

      .post('/resend-code', strict, byEmail, async (c) => {
        const dto = await jsonBody(c, resendSchema);
        await d.auth.resendCode(dto.email);
        return c.json({ message: 'Si le compte existe, un code a été envoyé' });
      })

      .post('/prelogin', strict, byEmail, async (c) => {
        const dto = await jsonBody(c, preloginSchema);
        return c.json(await d.auth.prelogin(dto.email));
      })

      .post('/me/upgrade-auth', strict, ...authed, rejectDemo(), async (c) => {
        const r = await d.auth.upgradeAuth(
          c.get('user').id,
          await jsonBody(c, upgradeAuthSchema),
        );
        if (!r.success) throw resultError(r);
        return c.json(toPublicUser(r.data));
      })

      .post(
        '/login',
        strict,
        byEmail,
        event({ success: 'login_success', failure: 'login_failed' }),
        async (c) => {
          const r = await d.auth.login(await jsonBody(c, loginSchema));
          if (!r.success) throw resultError(r);
          if (r.data.kind === 'mfa_required')
            return c.json({ mfaRequired: true });
          const csrfToken = await d.sessionCookies.open(c, r.data.user);
          return c.json({
            user: toPublicUser(r.data.user),
            keyMaterial: toKeyMaterial(r.data.user),
            csrfToken,
            // Présent seulement si la connexion a consommé un code de secours : le front prévient.
            ...(r.data.backupCodesRemaining !== undefined
              ? { backupCodesRemaining: r.data.backupCodesRemaining }
              : {}),
          });
        },
      )

      // Session démo publique, derrière DEMO_ENABLED.
      .post('/demo-login', strict, async (c) => {
        if (!demoEnabled) throw new NotFoundError('Not Found');
        const r = await d.auth.demoLogin();
        if (!r.success) throw resultError(r);
        const csrfToken = await d.sessionCookies.open(c, r.data, {
          demo: true,
        });
        return c.json({
          user: toPublicUser(r.data),
          keyMaterial: null,
          csrfToken,
        });
      })

      .post('/demo-reset', strict, ...authed, async (c) => {
        if (!demoEnabled) throw new NotFoundError('Not Found');
        await d.demo.reset(c.get('user').id);
        return c.json({ message: 'Démo réinitialisée' });
      })

      .post(
        '/forgot-password',
        strict,
        byEmail,
        event({ success: 'password_reset_requested' }),
        async (c) => {
          const dto = await jsonBody(c, forgotPasswordSchema);
          await d.auth.forgotPassword(dto.email);
          return c.json({
            message: 'Si le compte existe, un code a été envoyé',
          });
        },
      )

      .post(
        '/reset-password',
        strict,
        byEmail,
        event({ success: 'password_reset' }),
        async (c) => {
          const r = await d.auth.resetPassword(
            await jsonBody(c, resetPasswordSchema),
          );
          if (!r.success) throw resultError(r);
          return c.json({ message: 'Mot de passe réinitialisé' });
        },
      )

      /** Jeton CSRF de la session courante (HMAC, sans cookie) : 401 sans session. */
      .get('/csrf', ...authed, (c) => {
        const u = c.get('user');
        return c.json({ csrfToken: d.csrf.tokenFor(u.id, u.sessionVersion) });
      })

      /** Activité récente du compte (connexions, changements sensibles), la plus récente d'abord. */
      .get('/me/security-events', ...authed, async (c) => {
        const n = Number(c.req.query('limit'));
        return c.json(
          await d.securityEvents.listFor(
            c.get('user').id,
            Number.isInteger(n) && n > 0 ? n : 50,
          ),
        );
      })

      .get('/me', ...authed, async (c) => {
        const user = await d.auth.getById(c.get('user').id);
        if (!user) throw new UnauthorizedError('Unauthorized');
        return c.json({
          ...toPublicUser(user),
          keyMaterial: toKeyMaterial(user),
        });
      })

      .patch('/me', ...authed, rejectDemo(), async (c) => {
        const dto = await jsonBody(c, updateProfileSchema);
        const user = await d.auth.updateProfile(
          c.get('user').id,
          dto.displayName,
        );
        return c.json({
          ...toPublicUser(user),
          keyMaterial: toKeyMaterial(user),
        });
      })

      .patch(
        '/me/password',
        strict,
        ...authed,
        rejectDemo(),
        event({ success: 'password_changed' }),
        async (c) => {
          const r = await d.auth.changePassword(
            c.get('user').id,
            await jsonBody(c, updatePasswordSchema),
          );
          if (!r.success) throw resultError(r);
          // Les autres appareils sont déconnectés ; celui-ci reçoit un cookie à jour.
          await d.sessionCookies.open(c, r.data);
          return c.json({ message: 'Mot de passe mis à jour' });
        },
      )

      .post(
        '/me/set-password',
        strict,
        ...authed,
        rejectDemo(),
        event({ success: 'password_set' }),
        async (c) => {
          const r = await d.auth.setPassword(
            c.get('user').id,
            await jsonBody(c, setPasswordSchema),
          );
          if (!r.success) throw resultError(r);
          return c.json({ message: 'Mot de passe défini' });
        },
      )

      .post('/me/2fa/setup', strict, ...authed, rejectDemo(), async (c) => {
        const r = await d.auth.setupTotp(c.get('user').id);
        if (!r.success) throw resultError(r);
        return c.json(r.data);
      })

      .post(
        '/me/2fa/verify',
        strict,
        ...authed,
        rejectDemo(),
        event({ success: 'totp_enabled' }),
        async (c) => {
          const dto = await jsonBody(c, totpVerifySchema);
          const r = await d.auth.enableTotp(c.get('user').id, dto.code);
          if (!r.success) throw resultError(r);
          // Les codes de secours ne sont montrés qu'ici, une fois ; seul leur HMAC est conservé.
          return c.json({
            message: '2FA activée',
            totpEnabled: true,
            backupCodes: r.data.backupCodes,
          });
        },
      )

      .get('/me/2fa/backup-codes', ...authed, async (c) => {
        const r = await d.auth.backupCodesStatus(c.get('user').id);
        if (!r.success) throw resultError(r);
        return c.json(r.data);
      })

      .post(
        '/me/2fa/backup-codes',
        strict,
        ...authed,
        rejectDemo(),
        event({ success: 'backup_codes_regenerated' }),
        async (c) => {
          const dto = await jsonBody(c, backupCodesRegenerateSchema);
          const r = await d.auth.regenerateBackupCodes(
            c.get('user').id,
            dto.password,
          );
          if (!r.success) throw resultError(r);
          return c.json({ backupCodes: r.data.backupCodes });
        },
      )

      .post(
        '/me/2fa/disable',
        strict,
        ...authed,
        rejectDemo(),
        event({ success: 'totp_disabled' }),
        async (c) => {
          const dto = await jsonBody(c, totpDisableSchema);
          const r = await d.auth.disableTotp(c.get('user').id, dto.password);
          if (!r.success) throw resultError(r);
          await d.sessionCookies.open(c, r.data);
          return c.json({ message: '2FA désactivée', totpEnabled: false });
        },
      )

      .delete('/me', ...authed, rejectDemo(), async (c) => {
        const r = await d.auth.deleteAccount(c.get('user').id);
        if (!r.success) throw resultError(r);
        d.sessionCookies.clear(c);
        return c.body(null, 204);
      })

      .post('/logout', ...authed, event({ success: 'logout' }), async (c) => {
        await d.auth.revokeSessions(c.get('user').id);
        d.sessionCookies.clear(c);
        return c.json({ message: 'Déconnecté' });
      })

      .post(
        '/me/avatar',
        ...authed,
        rejectDemo(),
        uploadLimit(AVATAR_MAX_BYTES),
        async (c) => {
          const userId = c.get('user').id;
          const { file } = await uploadedFile(c, 'file', AVATAR_MAX_BYTES);
          if (!file) throw new BadRequestError('Fichier requis');
          await assertValidImageUpload(file);
          // Un changement de format (png → jpg) change la clé : purge l'ancien objet, sinon il
          // reste public et immuable dans R2 pour toujours.
          await d.storage.deletePrefix(`avatars/${userId}.`);
          const key = d.storage.avatarKey(userId, file.mimetype);
          await d.storage.upload(
            key,
            file.buffer,
            file.mimetype,
            'public, max-age=31536000, immutable',
          );
          const updated = await d.auth.setAvatar(userId, key);
          return c.json(
            { ...toPublicUser(updated), keyMaterial: toKeyMaterial(updated) },
            201,
          );
        },
      )

      .get('/avatar/:userId', ...authed, async (c) => {
        const user = await d.auth.getById(uuidParam(c, 'userId'));
        if (!user?.avatarUrl) throw new NotFoundError('Avatar introuvable');
        const obj = await d.storage.getStream(user.avatarUrl);
        if (!obj) throw new NotFoundError('Avatar introuvable');
        return c.body(Readable.toWeb(obj.stream) as ReadableStream, 200, {
          'Content-Type': obj.contentType,
        });
      })

      // ── Chiffrement de bout en bout (EncryptionController) ──
      .patch(
        '/me/encryption-keys',
        ...authed,
        rejectDemo(),
        event({ success: 'encryption_keys_set' }),
        async (c) => {
          const r = await d.encryption.setKeys(
            c.get('user').id,
            await jsonBody(c, setupEncryptionKeysSchema),
          );
          if (!r.success) throw resultError(r);
          return c.json({ message: 'Clés de chiffrement configurées' });
        },
      )

      .post('/me/encryption-passphrase', ...authed, rejectDemo(), async (c) => {
        // Ne pose qu'un indicateur : la passphrase elle-même ne quitte jamais le client.
        await d.encryption.setPassphrase(c.get('user').id);
        return c.json({ message: 'Passphrase de chiffrement définie' });
      })

      .post(
        '/me/migrate-encryption',
        ...authed,
        rejectDemo(),
        event({ success: 'encryption_migrated' }),
        async (c) => {
          const r = await d.encryption.migrate(
            c.get('user').id,
            await jsonBody(c, migrateEncryptionSchema),
          );
          if (!r.success) throw resultError(r);
          return c.json({ message: 'Migration chiffrement terminée' });
        },
      )

      .post(
        '/reset-password-with-recovery',
        strict,
        byEmail,
        event({ success: 'recovery_reset' }),
        async (c) => {
          const r = await d.encryption.resetPasswordWithRecovery(
            await jsonBody(c, resetWithRecoverySchema),
          );
          if (!r.success) throw resultError(r);
          return c.json({ message: 'Mot de passe réinitialisé avec succès' });
        },
      )
  );
}
