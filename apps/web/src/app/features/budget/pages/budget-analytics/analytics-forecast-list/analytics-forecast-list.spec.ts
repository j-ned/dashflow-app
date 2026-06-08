import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AnalyticsForecastList, type ForecastView } from './analytics-forecast-list';

const fc = (p: Partial<ForecastView>): ForecastView => ({
  label: 'Solde',
  icon: 'trending-up',
  color: '#0f0',
  message: 'msg',
  detail: 'detail',
  ...p,
});

function mount(forecasts: ForecastView[]) {
  TestBed.configureTestingModule({ imports: [AnalyticsForecastList] });
  const f = TestBed.createComponent(AnalyticsForecastList);
  f.componentRef.setInput('forecasts', forecasts);
  f.componentRef.setInput('title', 'Prévisions');
  f.componentRef.setInput('emptyText', 'Vide');
  f.componentRef.setInput('emptyHint', 'Astuce');
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('AnalyticsForecastList', () => {
  it('rend les prévisions', () => {
    const el = mount([fc({ label: 'Solde', message: 'msg', detail: 'detail' })]);
    expect(el.textContent).toContain('Solde');
    expect(el.textContent).toContain('msg');
    expect(el.textContent).toContain('detail');
  });
  it('état vide quand aucune prévision', () => {
    const el = mount([]);
    expect(el.textContent).toContain('Vide');
    expect(el.textContent).toContain('Astuce');
  });
});
