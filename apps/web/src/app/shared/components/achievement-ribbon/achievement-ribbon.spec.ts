import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AchievementRibbon } from './achievement-ribbon';

describe('AchievementRibbon', () => {
  it('affiche le label fourni', () => {
    const fixture = TestBed.createComponent(AchievementRibbon);
    fixture.componentRef.setInput('label', 'Atteint');
    fixture.detectChanges();
    const ribbon = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="achievement-ribbon"]',
    );
    expect(ribbon).not.toBeNull();
    expect(ribbon?.textContent?.trim()).toBe('Atteint');
  });
});
