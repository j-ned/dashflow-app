import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AnalyticsKpiGrid, type KpiCard } from './analytics-kpi-grid';

const kpi = (p: Partial<KpiCard>): KpiCard => ({
  label: 'Revenu',
  icon: 'trending-up',
  iconBg: 'bg-ib-green/10',
  iconColor: 'text-ib-green',
  value: 2000,
  valueColor: 'text-ib-green',
  sub: null,
  ...p,
});

function mount(kpis: KpiCard[]) {
  TestBed.configureTestingModule({ imports: [AnalyticsKpiGrid] });
  const f = TestBed.createComponent(AnalyticsKpiGrid);
  f.componentRef.setInput('kpis', kpis);
  f.componentRef.setInput('ariaLabel', 'KPIs');
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('AnalyticsKpiGrid', () => {
  it('rend chaque KPI (label + valeur formatée + sub)', () => {
    const el = mount([kpi({ label: 'Revenu', value: 2000, sub: 'détail' })]);
    expect(el.textContent).toContain('Revenu');
    expect(el.textContent).toContain('2,000');
    expect(el.textContent).toContain('détail');
  });
});
