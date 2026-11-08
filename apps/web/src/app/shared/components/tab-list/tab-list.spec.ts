import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { TabList, type TabItem } from './tab-list';

const TABS: readonly TabItem[] = [
  { id: 'in', labelKey: 'Revenus' },
  { id: 'out', labelKey: 'Sorties' },
  { id: 'time', labelKey: 'Chronologie' },
];

function mount(selected = 'in') {
  TestBed.configureTestingModule({
    imports: [
      TabList,
      TranslocoTestingModule.forRoot({
        langs: { fr: {} },
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(TabList);
  fixture.componentRef.setInput('tabs', TABS);
  fixture.componentRef.setInput('label', 'Détail du mois');
  fixture.componentRef.setInput('idPrefix', 'month');
  fixture.componentRef.setInput('selected', selected);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  const tabs = () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const press = (key: string) => {
    tabs()
      .find((t) => t.getAttribute('aria-selected') === 'true')!
      .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };
  return { fixture, host, tabs, press };
}

const selectedLabel = (tabs: HTMLButtonElement[]) =>
  tabs.find((t) => t.getAttribute('aria-selected') === 'true')?.textContent?.trim();

describe('TabList', () => {
  it('expose une liste d’onglets nommée, reliée à ses panneaux', () => {
    const { host, tabs } = mount();

    expect(host.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe(
      'Détail du mois',
    );
    expect(tabs().map((t) => t.getAttribute('aria-controls'))).toEqual([
      'month-panel-in',
      'month-panel-out',
      'month-panel-time',
    ]);
  });

  it('seul l’onglet sélectionné est marqué et atteignable au clavier (tabindex)', () => {
    const { tabs } = mount('out');

    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs().map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('un clic sélectionne l’onglet et le signale au parent', () => {
    const { fixture, tabs } = mount();
    const emitted: string[] = [];
    fixture.componentInstance.selected.subscribe((v) => emitted.push(v));

    tabs()[2]!.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['time']);
    expect(selectedLabel(tabs())).toBe('Chronologie');
  });

  it.each([
    ['in', 'ArrowRight', 'Sorties'],
    ['time', 'ArrowRight', 'Revenus'],
    ['in', 'ArrowLeft', 'Chronologie'],
    ['out', 'Home', 'Revenus'],
    ['in', 'End', 'Chronologie'],
  ])('depuis « %s », %s sélectionne « %s » et y place le focus', (from, key, expected) => {
    const { tabs, press } = mount(from);

    press(key);

    expect(selectedLabel(tabs())).toBe(expected);
    expect(document.activeElement?.textContent?.trim()).toBe(expected);
  });
});
