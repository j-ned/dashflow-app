import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { ReminderTarget } from '../../domain/models/reminder.model';
import { ReminderTargetBadge } from './reminder-target-badge';

function mount(target: ReminderTarget) {
  TestBed.configureTestingModule({
    imports: [
      ReminderTargetBadge,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(ReminderTargetBadge);
  fixture.componentRef.setInput('target', target);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('span')!;
}

describe('ReminderTargetBadge', () => {
  it.each([
    ['medication', 'medical.reminder.targetMedication', 'text-ib-orange'],
    ['appointment', 'medical.reminder.targetAppointment', 'text-ib-blue'],
  ] as const)('%s → libellé et couleur propres à la cible', (target, key, colorClass) => {
    const badge = mount(target);

    expect(badge.textContent).toContain(key);
    expect(badge.classList.contains(colorClass)).toBe(true);
  });
});
