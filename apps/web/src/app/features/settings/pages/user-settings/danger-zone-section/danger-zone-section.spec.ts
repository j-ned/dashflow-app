import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth/domain/auth.store';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';
import { DangerZoneSection } from './danger-zone-section';

function setup(opts: { email?: string; confirm?: boolean } = {}) {
  const deleteAccount = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    imports: [
      DangerZoneSection,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: AuthStore, useValue: { email: () => opts.email ?? 'a@b.c', deleteAccount } },
      {
        provide: ConfirmService,
        useValue: { confirm: () => Promise.resolve(opts.confirm ?? true) },
      },
      { provide: Toaster, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(DangerZoneSection);
  fixture.detectChanges();
  return { fixture, deleteAccount };
}

describe('DangerZoneSection', () => {
  it('bouton supprimer désactivé tant que la confirmation ≠ email', () => {
    const { fixture } = setup({ email: 'a@b.c' });
    const btn = (fixture.nativeElement as HTMLElement).querySelector(
      'button[type="button"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('deleteAccount confirmé appelle auth.deleteAccount et navigue vers /auth/login', async () => {
    const { fixture, deleteAccount } = setup({ email: 'a@b.c', confirm: true });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const cmp = fixture.componentInstance as unknown as {
      deleteConfirmValue: { set: (v: string) => void };
      deleteAccount: () => Promise<void>;
    };
    cmp.deleteConfirmValue.set('a@b.c');
    await cmp.deleteAccount();
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(navSpy).toHaveBeenCalledWith(['/auth/login']);
  });
});
