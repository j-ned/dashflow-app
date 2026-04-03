import { Hono } from 'hono';
import { eq, and, gt, sql } from 'drizzle-orm';
import { hash, verify } from 'argon2';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { db } from '@db/client';
import { users, verificationCodes } from '@db/schema';
import { authMiddleware, signToken } from '@middleware/auth';
import { sendVerificationCode, sendPasswordResetCode } from '../mail/mailer.js';
import { uploadAvatar, deleteAvatar, getAvatar, avatarKey } from '../storage/s3.js';
import { validate, registerSchema, verifySchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema, updatePasswordSchema, setPasswordSchema, setupEncryptionKeysSchema, encryptionPassphraseSchema, migrateEncryptionSchema } from '../validation.js';
import type { AppEnv } from '../types.js';

const auth = new Hono<AppEnv>();

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toPublicUser(user: { id: string; email: string; password: string | null; displayName: string | null; avatarUrl: string | null; totpEnabled: Date | null; googleId: string | null; encryptionVersion: number; encryptionPassphrase: boolean; encryptionSalt: string | null; wrappedMasterKey: string | null; recoveryWrappedKey: string | null }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ? `/api/auth/avatar/${user.id}` : null,
    totpEnabled: !!user.totpEnabled,
    hasPassword: !!user.password,
    googleLinked: !!user.googleId,
    encryptionVersion: user.encryptionVersion,
    hasEncryptionPassphrase: user.encryptionPassphrase,
  };
}

function toKeyMaterial(user: { encryptionSalt: string | null; wrappedMasterKey: string | null; recoveryWrappedKey: string | null }) {
  if (!user.encryptionSalt || !user.wrappedMasterKey) return null;
  return {
    salt: user.encryptionSalt,
    wrappedMasterKey: user.wrappedMasterKey,
    recoveryWrappedKey: user.recoveryWrappedKey,
  };
}

// ── Register (step 1: create pending user + send code) ──
auth.post('/register', async (c) => {
  const v = validate(registerSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const { email, password, displayName } = v.data;

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0 && existing[0].emailVerified) {
    return c.json({ error: 'Email deja utilise' }, 409);
  }

  // If unverified user exists, update password and resend code
  if (existing.length > 0 && !existing[0].emailVerified) {
    const hashed = await hash(password);
    await db.update(users)
      .set({ password: hashed, displayName: displayName ?? email.split('@')[0] })
      .where(eq(users.id, existing[0].id));
  } else {
    const hashed = await hash(password);
    await db.insert(users).values({
      email,
      password: hashed,
      displayName: displayName ?? email.split('@')[0],
    });
  }

  // Delete old codes for this email
  await db.delete(verificationCodes).where(eq(verificationCodes.email, email));

  // Generate new code (expires in 10 minutes)
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(verificationCodes).values({ email, code, expiresAt });

  try {
    await sendVerificationCode(email, code);
    console.log(`[AUTH] Verification code sent successfully to: ${email}`);
  } catch (err) {
    console.error(`[MAIL] Failed to send code to ${email}:`, (err as Error).message);
    return c.json({ error: 'Impossible d\'envoyer l\'email de verification. Reessayez plus tard.' }, 502);
  }

  return c.json({ message: 'Code de verification envoye', email }, 201);
});

// ── Verify Code (step 2: confirm email + login) ──
auth.post('/verify', async (c) => {
  const v = validate(verifySchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const { email, code } = v.data;

  const [record] = await db.select()
    .from(verificationCodes)
    .where(and(
      eq(verificationCodes.email, email),
      eq(verificationCodes.code, code),
      gt(verificationCodes.expiresAt, new Date()),
    ))
    .limit(1);

  if (!record) {
    return c.json({ error: 'Code invalide ou expire' }, 400);
  }

  // Mark user as verified
  const [user] = await db.update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.email, email))
    .returning();

  if (!user) {
    return c.json({ error: 'Utilisateur non trouve' }, 404);
  }

  // Cleanup codes
  await db.delete(verificationCodes).where(eq(verificationCodes.email, email));

  // Auto-login after verification
  const token = await signToken({ sub: user.id, email: user.email });

  return c.json({ token, user: toPublicUser(user), keyMaterial: toKeyMaterial(user) });
});

// ── Resend Code ──
auth.post('/resend-code', async (c) => {
  const { email } = await c.req.json<{ email: string }>();

  if (!email) {
    return c.json({ error: 'Email requis' }, 400);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return c.json({ error: 'Aucun compte avec cet email' }, 404);
  }

  if (user.emailVerified) {
    return c.json({ error: 'Email deja verifie' }, 400);
  }

  // Delete old codes
  await db.delete(verificationCodes).where(eq(verificationCodes.email, email));

  // Generate new code
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(verificationCodes).values({ email, code, expiresAt });

  try {
    await sendVerificationCode(email, code);
    console.log(`[AUTH] Verification code sent successfully to: ${email}`);
  } catch (err) {
    console.error(`[MAIL] Failed to send code to ${email}:`, (err as Error).message);
    return c.json({ error: 'Impossible d\'envoyer l\'email. Reessayez plus tard.' }, 502);
  }

  return c.json({ message: 'Code renvoye' });
});

// ── Login ──
auth.post('/login', async (c) => {
  const v = validate(loginSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const { email, password, totpCode } = v.data;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return c.json({ error: 'Identifiants invalides' }, 401);
  }

  if (!user.emailVerified) {
    return c.json({ error: 'Email non verifie', code: 'EMAIL_NOT_VERIFIED' }, 403);
  }

  if (!user.password) {
    return c.json({ error: 'Ce compte utilise la connexion Google. Utilisez le bouton correspondant.' }, 400);
  }

  const valid = await verify(user.password, password);
  if (!valid) {
    return c.json({ error: 'Identifiants invalides' }, 401);
  }

  // 2FA check
  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return c.json({ error: 'Code 2FA requis', code: 'TOTP_REQUIRED' }, 403);
    }
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totpSecret) });
    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      return c.json({ error: 'Code 2FA invalide' }, 401);
    }
  }

  const token = await signToken({ sub: user.id, email: user.email });

  return c.json({ token, user: toPublicUser(user), keyMaterial: toKeyMaterial(user) });
});

// ── Forgot Password (step 1: send reset code) ──
auth.post('/forgot-password', async (c) => {
  const v = validate(forgotPasswordSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const { email } = v.data;

  console.log(`[AUTH] Forgot password request received for: ${email}`);

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    console.log(`[AUTH] Forgot password request for non-existent email: ${email}`);
    return c.json({ message: 'Si un compte existe avec cet email, un code a ete envoye' });
  }

  if (!user.emailVerified) {
    console.log(`[AUTH] Forgot password request for unverified account: ${email}`);
    return c.json({ message: 'Si un compte existe avec cet email, un code a ete envoye' });
  }

  console.log(`[AUTH] Sending reset code to: ${email}`);

  // Delete old codes for this email
  await db.delete(verificationCodes).where(eq(verificationCodes.email, email));

  // Generate new code (expires in 10 minutes)
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(verificationCodes).values({ email, code, expiresAt });

  try {
    await sendPasswordResetCode(email, code);
    console.log(`[AUTH] Reset code sent successfully to: ${email}`);
  } catch (err) {
    console.error(`[MAIL] Failed to send reset code to ${email}:`, (err as Error).message);
    return c.json({ error: 'Impossible d\'envoyer l\'email. Reessayez plus tard.' }, 502);
  }

  return c.json({ message: 'Si un compte existe avec cet email, un code a ete envoye' });
});

// ── Reset Password (step 2: verify code + set new password) ──
auth.post('/reset-password', async (c) => {
  const v = validate(resetPasswordSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const { email, code, newPassword } = v.data;

  const [record] = await db.select()
    .from(verificationCodes)
    .where(and(
      eq(verificationCodes.email, email),
      eq(verificationCodes.code, code),
      gt(verificationCodes.expiresAt, new Date()),
    ))
    .limit(1);

  if (!record) {
    return c.json({ error: 'Code invalide ou expire' }, 400);
  }

  // Update password
  const hashed = await hash(newPassword);
  const [user] = await db.update(users)
    .set({ password: hashed })
    .where(eq(users.email, email))
    .returning();

  if (!user) {
    return c.json({ error: 'Utilisateur non trouve' }, 404);
  }

  // Cleanup codes
  await db.delete(verificationCodes).where(eq(verificationCodes.email, email));

  return c.json({ message: 'Mot de passe reinitialise avec succes' });
});

// ── Get Profile (protected) ──
auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return c.json({ error: 'Utilisateur non trouve' }, 404);
  }

  return c.json({ ...toPublicUser(user), createdAt: user.createdAt, keyMaterial: toKeyMaterial(user) });
});

// ── Update Profile (protected) ──
auth.patch('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const v = validate(updateProfileSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const { displayName } = v.data;

  const [user] = await db.update(users)
    .set({ displayName })
    .where(eq(users.id, userId))
    .returning();

  return c.json(toPublicUser(user));
});

// ── Update Password (protected) ──
auth.patch('/me/password', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const v = validate(updatePasswordSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const { currentPassword, newPassword } = v.data;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return c.json({ error: 'Utilisateur non trouve' }, 404);
  }
  if (!user.password) {
    return c.json({ error: 'Ce compte utilise la connexion Google' }, 400);
  }

  const valid = await verify(user.password, currentPassword);
  if (!valid) {
    return c.json({ error: 'Mot de passe actuel incorrect' }, 401);
  }

  const hashed = await hash(newPassword);
  const updateData: Record<string, unknown> = { password: hashed };

  // Re-wrap master key with new password if provided
  if (body.newSalt && body.newWrappedMasterKey) {
    updateData.encryptionSalt = body.newSalt;
    updateData.wrappedMasterKey = body.newWrappedMasterKey;
  }

  await db.update(users).set(updateData).where(eq(users.id, userId));

  return c.json({ message: 'Mot de passe mis a jour' });
});

// ── Set Password (for OAuth-only accounts or passphrase-only accounts) ──
auth.post('/me/set-password', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const v = validate(setPasswordSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const { newPassword } = v.data;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return c.json({ error: 'Utilisateur non trouve' }, 404);
  }

  const hashed = await hash(newPassword);
  const updateData: Record<string, unknown> = { password: hashed };

  // If client sent re-wrapped key material, update it so future logins auto-unlock
  if (body.newSalt && body.newWrappedMasterKey) {
    updateData.encryptionSalt = body.newSalt;
    updateData.wrappedMasterKey = body.newWrappedMasterKey;
    updateData.encryptionPassphrase = false;
  }

  await db.update(users).set(updateData).where(eq(users.id, userId));

  return c.json({ message: 'Mot de passe defini avec succes' });
});

// ── Get Avatar (public) ──
auth.get('/avatar/:userId', async (c) => {
  const targetUserId = c.req.param('userId');
  const [user] = await db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, targetUserId)).limit(1);

  if (!user?.avatarUrl) {
    return c.json({ error: 'Pas d\'avatar' }, 404);
  }

  const result = await getAvatar(user.avatarUrl);
  if (!result) {
    return c.json({ error: 'Avatar introuvable' }, 404);
  }

  return new Response(result.body, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// ── Upload Avatar (protected) ──
auth.post('/me/avatar', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!(file instanceof File)) {
    return c.json({ error: 'Fichier requis (champ "file")' }, 400);
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return c.json({ error: 'Format invalide. Utilisez JPEG, PNG, WebP ou GIF.' }, 400);
  }

  if (file.size > 2 * 1024 * 1024) {
    return c.json({ error: 'Fichier trop volumineux (max 2 Mo).' }, 400);
  }

  // Delete old avatar if exists
  const [current] = await db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, userId)).limit(1);
  if (current?.avatarUrl) {
    await deleteAvatar(current.avatarUrl);
  }

  const key = avatarKey(userId, file.type);
  const buffer = await file.arrayBuffer();
  await uploadAvatar(key, buffer, file.type);

  // Store the S3 key (not a full URL)
  const [user] = await db.update(users)
    .set({ avatarUrl: key })
    .where(eq(users.id, userId))
    .returning();

  return c.json(toPublicUser(user));
});

// ── 2FA Setup (protected) — generates secret + QR code ──
auth.post('/me/2fa/setup', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const email = c.get('email');

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user?.totpEnabled) {
    return c.json({ error: '2FA deja active' }, 400);
  }

  const secret = new OTPAuth.Secret();
  const totp = new OTPAuth.TOTP({
    issuer: 'Dash Flow',
    label: email,
    secret,
  });

  // Store secret (not yet enabled)
  await db.update(users).set({ totpSecret: secret.base32 }).where(eq(users.id, userId));

  const uri = totp.toString();
  const qrCode = await QRCode.toDataURL(uri);

  return c.json({ qrCode, secret: secret.base32, uri });
});

// ── 2FA Verify & Enable (protected) ──
auth.post('/me/2fa/verify', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { code } = await c.req.json<{ code: string }>();

  if (!code) {
    return c.json({ error: 'Code requis' }, 400);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.totpSecret) {
    return c.json({ error: 'Configurez d\'abord la 2FA' }, 400);
  }

  if (user.totpEnabled) {
    return c.json({ error: '2FA deja active' }, 400);
  }

  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totpSecret) });
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) {
    return c.json({ error: 'Code invalide' }, 401);
  }

  await db.update(users)
    .set({ totpEnabled: new Date() })
    .where(eq(users.id, userId));

  return c.json({ message: '2FA activee', totpEnabled: true });
});

// ── 2FA Disable (protected) ──
auth.post('/me/2fa/disable', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { password } = await c.req.json<{ password: string }>();

  if (!password) {
    return c.json({ error: 'Mot de passe requis pour desactiver la 2FA' }, 400);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return c.json({ error: 'Utilisateur non trouve' }, 404);
  }
  if (!user.password) {
    return c.json({ error: 'Ce compte utilise la connexion Google' }, 400);
  }

  const valid = await verify(user.password, password);
  if (!valid) {
    return c.json({ error: 'Mot de passe incorrect' }, 401);
  }

  await db.update(users)
    .set({ totpSecret: null, totpEnabled: null })
    .where(eq(users.id, userId));

  return c.json({ message: '2FA desactivee', totpEnabled: false });
});

// ── Setup Encryption Keys (protected) ──
auth.patch('/me/encryption-keys', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const v = validate(setupEncryptionKeysSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const { salt, wrappedMasterKey, recoveryWrappedKey } = v.data;

  await db.update(users).set({
    encryptionSalt: salt,
    wrappedMasterKey,
    recoveryWrappedKey,
    encryptionVersion: 1,
  }).where(eq(users.id, userId));

  return c.json({ message: 'Cles de chiffrement configurees' });
});

// ── Set Encryption Passphrase (for OAuth users) ──
auth.post('/me/encryption-passphrase', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const v = validate(encryptionPassphraseSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);

  // Mark as passphrase-based encryption — do NOT store passphrase in password field
  // The passphrase is only used client-side for PBKDF2 key derivation
  await db.update(users).set({
    encryptionPassphrase: true,
  }).where(eq(users.id, userId));

  return c.json({ message: 'Passphrase de chiffrement definie' });
});

// ── Migrate Encryption (bulk encrypt existing data) ──
auth.post('/me/migrate-encryption', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const v = validate(migrateEncryptionSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);

  const { keyMaterial, data } = v.data;

  // Table name → Drizzle table mapping
  const tableMap: Record<string, { table: any; idCol: any; userIdCol: any }> = {
    bankAccounts: { table: (await import('../db/schema.js')).bankAccounts, idCol: 'id', userIdCol: 'userId' },
    envelopes: { table: (await import('../db/schema.js')).envelopes, idCol: 'id', userIdCol: 'userId' },
    envelopeTransactions: { table: (await import('../db/schema.js')).envelopeTransactions, idCol: 'id', userIdCol: null },
    loans: { table: (await import('../db/schema.js')).loans, idCol: 'id', userIdCol: 'userId' },
    loanTransactions: { table: (await import('../db/schema.js')).loanTransactions, idCol: 'id', userIdCol: null },
    recurringEntries: { table: (await import('../db/schema.js')).recurringEntries, idCol: 'id', userIdCol: 'userId' },
    salaryArchives: { table: (await import('../db/schema.js')).salaryArchives, idCol: 'id', userIdCol: 'userId' },
    patients: { table: (await import('../db/schema.js')).patients, idCol: 'id', userIdCol: 'userId' },
    practitioners: { table: (await import('../db/schema.js')).practitioners, idCol: 'id', userIdCol: 'userId' },
    appointments: { table: (await import('../db/schema.js')).appointments, idCol: 'id', userIdCol: 'userId' },
    prescriptions: { table: (await import('../db/schema.js')).prescriptions, idCol: 'id', userIdCol: 'userId' },
    medications: { table: (await import('../db/schema.js')).medications, idCol: 'id', userIdCol: 'userId' },
    documents: { table: (await import('../db/schema.js')).documents, idCol: 'id', userIdCol: 'userId' },
  };

  // Sensitive columns to clear per table (set to null or placeholder for NOT NULL)
  const clearColumns: Record<string, Record<string, unknown>> = {
    bankAccounts: { name: '[chiffré]', color: null, dotColor: null },
    envelopes: { name: '[chiffré]', type: 'épargne', balance: '0', target: null, color: null, dueDay: null },
    envelopeTransactions: { amount: '0', date: '1970-01-01' },
    loans: { person: '[chiffré]', direction: 'lent', amount: '0', remaining: '0', description: null, date: '1970-01-01', dueDate: null, dueDay: null },
    loanTransactions: { amount: '0', date: '1970-01-01' },
    recurringEntries: { label: '[chiffré]', amount: '0', type: 'expense', dayOfMonth: null, date: null, category: null, payslipKey: null },
    salaryArchives: { month: '0000-00', salary: '0', totalExpenses: '0', totalSpendings: '0', spendings: [], payslipKey: null },
    patients: { firstName: '[chiffré]', lastName: '[chiffré]', birthDate: '1970-01-01', color: null, notes: null },
    practitioners: { name: '[chiffré]', type: 'autre', phone: null, email: null, address: null, bookingUrl: null },
    appointments: { date: '1970-01-01', time: '00:00', status: 'scheduled', reason: null, outcome: null },
    prescriptions: { issuedDate: '1970-01-01', validUntil: null, documentUrl: null, notes: null },
    medications: { name: '[chiffré]', type: 'autre', dosage: '[chiffré]', quantity: 0, dailyRate: '1', startDate: '1970-01-01', alertDaysBefore: 7, skipDays: [] },
    documents: { type: 'autre', title: '[chiffré]', date: '1970-01-01', fileUrl: null, notes: null },
  };

  // Update each row with encrypted data + clear sensitive columns
  for (const [tableName, rows] of Object.entries(data)) {
    const mapping = tableMap[tableName];
    if (!mapping) continue;

    const toClear = clearColumns[tableName] ?? {};

    for (const row of rows) {
      const conditions = [eq(mapping.table.id, row.id)];
      if (mapping.userIdCol) {
        conditions.push(eq(mapping.table.userId, userId));
      }
      await db.update(mapping.table)
        .set({ encryptedData: row.encryptedData, ...toClear })
        .where(and(...conditions));
    }
  }

  // Set encryption keys + version
  await db.update(users).set({
    encryptionSalt: keyMaterial.salt,
    wrappedMasterKey: keyMaterial.wrappedMasterKey,
    recoveryWrappedKey: keyMaterial.recoveryWrappedKey,
    encryptionVersion: 1,
  }).where(eq(users.id, userId));

  return c.json({ message: 'Migration chiffrement terminee' });
});

// ── Reset Password with recovery key support ──
auth.post('/reset-password-with-recovery', async (c) => {
  const body = await c.req.json();
  const { email, code, newPassword, newSalt, newWrappedMasterKey } = body;

  if (!email || !code || !newPassword) {
    return c.json({ error: 'Donnees manquantes' }, 400);
  }

  const [record] = await db.select()
    .from(verificationCodes)
    .where(and(
      eq(verificationCodes.email, email),
      eq(verificationCodes.code, code),
      gt(verificationCodes.expiresAt, new Date()),
    ))
    .limit(1);

  if (!record) {
    return c.json({ error: 'Code invalide ou expire' }, 400);
  }

  const hashed = await hash(newPassword);
  const updateData: Record<string, unknown> = { password: hashed };

  if (newSalt && newWrappedMasterKey) {
    updateData.encryptionSalt = newSalt;
    updateData.wrappedMasterKey = newWrappedMasterKey;
  }

  const [user] = await db.update(users)
    .set(updateData)
    .where(eq(users.email, email))
    .returning();

  if (!user) {
    return c.json({ error: 'Utilisateur non trouve' }, 404);
  }

  await db.delete(verificationCodes).where(eq(verificationCodes.email, email));

  return c.json({ message: 'Mot de passe reinitialise avec succes' });
});

// ── Wipe Encryption (forgot password without recovery key) ──
auth.post('/me/wipe-encryption', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // Wipe all encrypted data from all 13 tables
  const schema = await import('../db/schema.js');
  const tables = [
    schema.bankAccounts, schema.envelopes, schema.envelopeTransactions,
    schema.loans, schema.loanTransactions, schema.recurringEntries,
    schema.salaryArchives, schema.patients, schema.practitioners,
    schema.appointments, schema.prescriptions, schema.medications, schema.documents,
  ];

  for (const table of tables) {
    if ('userId' in table) {
      await db.delete(table).where(eq((table as any).userId, userId));
    }
  }

  // Reset encryption state
  await db.update(users).set({
    encryptionSalt: null,
    wrappedMasterKey: null,
    recoveryWrappedKey: null,
    encryptionVersion: 0,
  }).where(eq(users.id, userId));

  return c.json({ message: 'Donnees chiffrees supprimees' });
});

// ── Delete Account (protected) ──
auth.delete('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  await db.delete(users).where(eq(users.id, userId));
  return c.json({ message: 'Compte supprime' });
});

export default auth;
