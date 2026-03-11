import { Component, ChangeDetectionStrategy, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity } from '@core/services/crypto/entity-crypto';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../domain/auth.store';
import { RecoveryKeyModal } from '../../components/recovery-key-modal/recovery-key-modal';
import { EncryptionPassphraseModal } from '../../components/encryption-passphrase-modal/encryption-passphrase-modal';

// Mapping of cleartext keys per table (foreign keys + structural)
const CLEARTEXT_KEYS: Record<string, readonly string[]> = {
  bankAccounts: ['id', 'userId', 'createdAt'],
  envelopes: ['id', 'userId', 'memberId'],
  envelopeTransactions: ['id', 'envelopeId', 'createdAt'],
  loans: ['id', 'userId', 'memberId'],
  loanTransactions: ['id', 'loanId', 'createdAt'],
  recurringEntries: ['id', 'userId', 'memberId', 'accountId', 'createdAt'],
  salaryArchives: ['id', 'userId', 'accountId', 'createdAt'],
  patients: ['id', 'userId', 'createdAt'],
  practitioners: ['id', 'userId', 'createdAt'],
  appointments: ['id', 'userId', 'patientId', 'practitionerId', 'createdAt'],
  prescriptions: ['id', 'userId', 'appointmentId', 'practitionerId', 'patientId', 'createdAt'],
  medications: ['id', 'userId', 'prescriptionId', 'patientId', 'createdAt'],
  documents: ['id', 'userId', 'patientId', 'practitionerId', 'createdAt'],
};

const API_PATHS: Record<string, string> = {
  bankAccounts: '/bank-accounts',
  envelopes: '/envelopes',
  envelopeTransactions: '/envelopes/transactions/all',
  loans: '/loans',
  loanTransactions: '/loans/transactions/all',
  recurringEntries: '/recurring-entries',
  salaryArchives: '/salary-archives',
  patients: '/patients',
  practitioners: '/practitioners',
  appointments: '/appointments',
  prescriptions: '/prescriptions',
  medications: '/medications',
  documents: '/documents',
};

@Component({
  selector: 'app-encryption-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RecoveryKeyModal, EncryptionPassphraseModal],
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <article class="w-full max-w-lg rounded-xl border border-border bg-surface p-8 shadow-lg">
      <header class="mb-6 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ib-green/10">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-ib-green">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-text-primary">Chiffrement de bout en bout</h1>
        <p class="mt-2 text-sm text-text-muted">
          Vos donnees seront chiffrees localement. Seul vous pourrez y acceder.
        </p>
      </header>

      @if (error()) {
        <p role="alert" class="mb-4 rounded-md bg-ib-red/10 p-3 text-sm text-ib-red">{{ error() }}</p>
      }

      <div class="flex flex-col gap-4">
        @switch (step()) {
          @case ('init') {
            <div class="rounded-lg bg-ib-amber/10 border border-ib-amber/20 p-4">
              <p class="text-sm font-medium text-ib-amber">Attention</p>
              <p class="mt-1 text-sm text-text-primary">
                Si vous perdez votre mot de passe ET votre cle de recuperation,
                vos donnees seront definitivement perdues. Il n'existe aucun moyen de les recuperer.
              </p>
            </div>

            <button
              type="button"
              (click)="startSetup()"
              [disabled]="loading()"
              class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loading() ? 'Preparation...' : 'Activer le chiffrement' }}
            </button>
          }

          @case ('migrating') {
            <div class="flex flex-col items-center gap-4 py-8">
              <div class="h-8 w-8 animate-spin rounded-full border-2 border-ib-blue border-t-transparent"></div>
              <p class="text-sm text-text-muted">{{ progressMessage() }}</p>
              <div class="w-full bg-canvas rounded-full h-2">
                <div class="bg-ib-blue h-2 rounded-full transition-all duration-300"
                     [style.width.%]="progress()"></div>
              </div>
            </div>
          }

          @case ('done') {
            <div class="flex flex-col items-center gap-4 py-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-ib-green/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                     class="text-ib-green">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p class="text-sm font-medium text-text-primary">Chiffrement active avec succes !</p>
              <button
                type="button"
                (click)="goToDashboard()"
                class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90"
              >
                Acceder au tableau de bord
              </button>
            </div>
          }
        }
      </div>
    </article>

    <app-recovery-key-modal
      [recoveryKey]="recoveryKey()"
      (confirmed$)="onRecoveryKeyConfirmed()"
      (closed)="onRecoveryModalClosed()"
    />

    <app-encryption-passphrase-modal
      (passphraseSet)="onPassphraseSet($event)"
      (closed)="onPassphraseModalClosed()"
    />
  `,
})
export class EncryptionSetup {
  private readonly auth = inject(AuthStore);
  private readonly cryptoStore = inject(CryptoStore);
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  private readonly recoveryModal = viewChild.required(RecoveryKeyModal);
  private readonly passphraseModal = viewChild.required(EncryptionPassphraseModal);

  protected readonly step = signal<'init' | 'migrating' | 'done'>('init');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly recoveryKey = signal('');
  protected readonly progress = signal(0);
  protected readonly progressMessage = signal('Preparation...');

  private _password = '';

  protected async startSetup(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    // OAuth without password → need passphrase first
    if (!user.hasPassword) {
      this.passphraseModal().open();
      return;
    }

    // For password users, they already have a password — use it
    this._password = ''; // Will be derived from login password (already unlocked or prompt)
    this.loading.set(true);
    this.error.set('');

    try {
      // We need the password. If crypto is not unlocked, we can't proceed
      // The setup is only reachable after login, so use the login password
      // Prompt for password re-entry
      const password = prompt('Confirmez votre mot de passe pour activer le chiffrement :');
      if (!password) {
        this.loading.set(false);
        return;
      }
      this._password = password;

      const key = await this.auth.setupEncryption(password);
      this.recoveryKey.set(key);
      this.loading.set(false);
      this.recoveryModal().open();
    } catch (e) {
      console.error('Encryption setup error:', e);
      this.error.set('Erreur lors de la preparation du chiffrement.');
      this.loading.set(false);
    }
  }

  protected onPassphraseSet(passphrase: string): void {
    this._password = passphrase;
    this.startEncryptionWithPassword(passphrase);
  }

  protected onPassphraseModalClosed(): void {
    // User cancelled
  }

  private async startEncryptionWithPassword(password: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      // Save passphrase on server
      await firstValueFrom(
        this.api.post('/auth/me/encryption-passphrase', { passphrase: password }),
      );

      const key = await this.auth.setupEncryption(password);
      this.recoveryKey.set(key);
      this.loading.set(false);
      this.recoveryModal().open();
    } catch (e) {
      console.error('Passphrase encryption setup error:', e);
      this.error.set('Erreur lors de la configuration de la passphrase.');
      this.loading.set(false);
    }
  }

  protected async onRecoveryKeyConfirmed(): Promise<void> {
    this.step.set('migrating');
    await this.migrateData();
  }

  protected onRecoveryModalClosed(): void {
    // Recovery modal closed without confirming — do nothing
  }

  private async migrateData(): Promise<void> {
    try {
      // Unlock crypto with password
      const keyMaterial = this.auth.getKeyMaterial();
      if (keyMaterial) {
        await this.cryptoStore.unlock(this._password, keyMaterial.salt, keyMaterial.wrappedMasterKey);
      }

      const masterKey = this.cryptoStore.getMasterKey();
      if (!masterKey) {
        this.error.set('Impossible de deverrouiller le chiffrement.');
        this.step.set('init');
        return;
      }

      const tableNames = Object.keys(API_PATHS);
      const encryptedData: Record<string, Array<{ id: string; encryptedData: string }>> = {};

      let completed = 0;
      const total = tableNames.length;

      for (const tableName of tableNames) {
        this.progressMessage.set(`Chiffrement: ${tableName}...`);
        this.progress.set(Math.round((completed / total) * 100));

        try {
          const rows = await firstValueFrom(
            this.api.get<Array<Record<string, unknown>>>(API_PATHS[tableName]),
          );

          if (rows.length > 0) {
            const encrypted: Array<{ id: string; encryptedData: string }> = [];
            for (const row of rows) {
              const result = await encryptEntity(row, CLEARTEXT_KEYS[tableName], masterKey);
              encrypted.push({ id: row['id'] as string, encryptedData: result.encryptedData });
            }
            encryptedData[tableName] = encrypted;
          }
        } catch {
          // Table might not exist or be empty — skip
        }

        completed++;
      }

      this.progressMessage.set('Envoi des donnees chiffrees...');
      this.progress.set(90);

      await this.auth.migrateEncryption(encryptedData);

      this.progress.set(100);
      this.step.set('done');
    } catch (e) {
      console.error('Migration error:', e);
      this.step.set('init');
      this.error.set('Erreur lors de la migration des donnees. Reessayez.');
    }
  }

  protected goToDashboard(): void {
    this.router.navigate(['/budget']);
  }
}
