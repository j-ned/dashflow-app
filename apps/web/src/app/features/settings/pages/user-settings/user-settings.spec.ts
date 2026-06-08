import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../auth/domain/auth.store';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';
import { UserSettings } from './user-settings';

function mount() {
  TestBed.configureTestingModule({
    imports: [
      UserSettings,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      provideRouter([]),
      {
        provide: AuthStore,
        useValue: {
          email: () => 'a@b.c',
          displayName: () => 'Alice',
          avatarUrl: () => null,
          userInitial: () => 'A',
          hasPassword: () => true,
          totpEnabled: () => false,
          encryptionVersion: () => 1,
        },
      },
      { provide: CryptoStore, useValue: { isUnlocked: () => true, getMasterKey: () => null } },
      { provide: ConfirmService, useValue: { confirm: () => Promise.resolve(false) } },
      { provide: Toaster, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(UserSettings);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('UserSettings (smoke)', () => {
  it('monte les 5 sections', () => {
    const el = mount();
    expect(el.querySelector('app-profile-section')).not.toBeNull();
    expect(el.querySelector('app-password-section')).not.toBeNull();
    expect(el.querySelector('app-two-factor-section')).not.toBeNull();
    expect(el.querySelector('app-encryption-section')).not.toBeNull();
    expect(el.querySelector('app-danger-zone-section')).not.toBeNull();
  });
});
