import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { ReminderCalendarLinks } from './reminder-calendar-links';

function mount(googleUrl: string | null) {
  TestBed.configureTestingModule({
    imports: [
      ReminderCalendarLinks,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(ReminderCalendarLinks);
  fixture.componentRef.setInput('googleUrl', googleUrl);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('ReminderCalendarLinks', () => {
  it('avec une URL : lien Google ouvert dans un nouvel onglet, sans référent exploitable', () => {
    const { el } = mount('https://calendar.google.com/calendar/render?x=1');
    const link = el.querySelector<HTMLAnchorElement>('[data-testid="reminder-google-link"]');

    expect(link?.getAttribute('href')).toBe('https://calendar.google.com/calendar/render?x=1');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener');
  });

  it('cible disparue (URL null) : pas de lien Google, le .ics reste proposé', () => {
    const { el } = mount(null);

    expect(el.querySelector('[data-testid="reminder-google-link"]')).toBeNull();
    expect(el.querySelector('[data-testid="reminder-ics-button"]')).not.toBeNull();
  });

  it('clic sur .ics → icsRequested', () => {
    const { fixture, el } = mount(null);
    const requested = vi.fn();
    fixture.componentInstance.icsRequested.subscribe(requested);

    el.querySelector<HTMLButtonElement>('[data-testid="reminder-ics-button"]')!.click();

    expect(requested).toHaveBeenCalledTimes(1);
  });
});
