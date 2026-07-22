import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Toaster } from '@shared/components/toast/toast';
import { ProfileSection } from './profile-section';

function mount(auth: Record<string, unknown> = {}) {
  const updateProfile = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    imports: [
      ProfileSection,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      {
        provide: AuthStore,
        useValue: {
          avatarUrl: () => null,
          userInitial: () => 'A',
          email: () => 'a@b.c',
          displayName: () => 'Alice',
          updateProfile,
          ...auth,
        },
      },
      { provide: Toaster, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(ProfileSection);
  fixture.detectChanges();
  return { fixture, updateProfile };
}

describe('ProfileSection', () => {
  it('affiche l’initiale quand pas d’avatar', () => {
    const { fixture } = mount();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('A');
  });

  it("l'avatar porte crossorigin=use-credentials (régression : /auth/avatar exige désormais le cookie de session, cross-origin sans cet attribut)", () => {
    const { fixture } = mount({ avatarUrl: () => 'https://api-dashflow.example/auth/avatar/u1' });
    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img?.getAttribute('crossorigin')).toBe('use-credentials');
  });

  it('saveProfile appelle auth.updateProfile et passe le form pristine', async () => {
    const { fixture, updateProfile } = mount();
    const cmp = fixture.componentInstance as unknown as {
      profileForm: {
        setValue: (v: { displayName: string }) => void;
        markAsDirty: () => void;
        pristine: boolean;
      };
      saveProfile: () => Promise<void>;
    };
    cmp.profileForm.setValue({ displayName: 'Bob' });
    cmp.profileForm.markAsDirty();
    await cmp.saveProfile();
    expect(updateProfile).toHaveBeenCalledWith({ displayName: 'Bob' });
    expect(cmp.profileForm.pristine).toBe(true);
  });
});
