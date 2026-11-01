import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ToggleSwitch } from './toggle-switch';

function mount(checked: boolean) {
  TestBed.configureTestingModule({ imports: [ToggleSwitch] });
  const fixture = TestBed.createComponent(ToggleSwitch);
  fixture.componentRef.setInput('checked', checked);
  fixture.componentRef.setInput('label', 'Activer l’alerte');
  fixture.detectChanges();
  const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
  return { fixture, button };
}

describe('ToggleSwitch', () => {
  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('checked=%s → role switch, aria-checked=%s et nom accessible', (checked, expected) => {
    const { button } = mount(checked);

    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-checked')).toBe(expected);
    expect(button.getAttribute('aria-label')).toBe('Activer l’alerte');
  });

  it('un clic émet toggled sans changer l’état lui-même (le parent porte l’état)', () => {
    const { fixture, button } = mount(false);
    const toggled = vi.fn();
    fixture.componentInstance.toggled.subscribe(toggled);

    button.click();
    fixture.detectChanges();

    expect(toggled).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-checked')).toBe('false');
  });
});
