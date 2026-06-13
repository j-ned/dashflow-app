import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Toaster } from '@shared/components/toast/toast';
import { LandingNav } from './landing-nav/landing-nav';
import { LandingHero } from './landing-hero/landing-hero';
import { LandingProblem } from './landing-problem/landing-problem';
import { LandingSecurity } from './landing-security/landing-security';
import { LandingBudgetPillar } from './landing-budget-pillar/landing-budget-pillar';
import { LandingMedicalPillar } from './landing-medical-pillar/landing-medical-pillar';
import { LandingPricing } from './landing-pricing/landing-pricing';
import { LandingFaq } from './landing-faq/landing-faq';
import { LandingFinalCta } from './landing-final-cta/landing-final-cta';
import { LandingFooter } from './landing-footer/landing-footer';

const CONTACT_EMAIL = 'contact@nedellec-julien.fr';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    LandingNav,
    LandingHero,
    LandingProblem,
    LandingSecurity,
    LandingBudgetPillar,
    LandingMedicalPillar,
    LandingPricing,
    LandingFaq,
    LandingFinalCta,
    LandingFooter,
  ],
  host: { class: 'block min-h-screen bg-canvas text-text-primary selection:bg-ib-blue/25' },
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-ib-blue focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas"
      >{{ 'landing.skipToContent' | transloco }}</a
    >
    <app-landing-nav />
    <main id="main">
      <app-landing-hero [demoLoading]="demoLoading()" (startDemo)="startDemo()" />
      <app-landing-problem />
      <app-landing-security />
      <app-landing-budget-pillar />
      <app-landing-medical-pillar />
      <app-landing-pricing />
      <app-landing-faq />
      <app-landing-final-cta />
    </main>
    <app-landing-footer [contactEmail]="contactEmail" [currentYear]="currentYear" />
  `,
})
export class LandingComponent {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly demoLoading = signal(false);

  protected async startDemo(): Promise<void> {
    if (this.demoLoading()) return;
    this.demoLoading.set(true);
    try {
      await this.auth.demoLogin();
      await this.router.navigate(['/budget'], { replaceUrl: true });
    } catch {
      this.toaster.error('landing.hero.demoError');
    } finally {
      this.demoLoading.set(false);
    }
  }
}
