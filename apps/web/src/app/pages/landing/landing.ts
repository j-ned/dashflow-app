import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { LocaleThemeToggle } from '@shared/components/locale-theme-toggle/locale-theme-toggle';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Toaster } from '@shared/components/toast/toast';

const CONTACT_EMAIL = 'contact@nedellec-julien.fr';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgOptimizedImage, Icon, TranslocoPipe, LocaleThemeToggle],
  host: { class: 'block min-h-screen bg-canvas text-text-primary selection:bg-ib-blue/25' },
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-ib-blue focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas"
      >{{ 'landing.skipToContent' | transloco }}</a
    >

    <nav
      class="sticky top-0 z-50 border-b border-border bg-canvas"
      [attr.aria-label]="'landing.nav.ariaLabel' | transloco"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a
          routerLink="/"
          class="inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          [attr.aria-label]="'landing.nav.logoLabel' | transloco"
        >
          <app-icon name="dashflow-logo" [size]="22" class="text-ib-blue" />
          <span class="font-mono text-base font-semibold tracking-tight">dashflow</span>
        </a>

        <div class="flex items-center gap-1 sm:gap-2">
          <app-locale-theme-toggle />
          <span class="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true"></span>
          <a
            routerLink="/auth/login"
            class="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >{{ 'landing.nav.login' | transloco }}</a
          >
          <a
            routerLink="/auth/register"
            class="inline-flex min-h-11 items-center rounded-md bg-ib-blue px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >{{ 'landing.nav.cta' | transloco }}</a
          >
        </div>
      </div>
    </nav>

    <main id="main">
      <!-- Hero -->
      <section
        class="mx-auto max-w-6xl px-6 pt-16 pb-16 lg:pt-24 lg:pb-20"
        aria-labelledby="hero-title"
      >
        <div class="mx-auto max-w-3xl text-center">
          <span
            class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-blue"
          >
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-blue"></span>
            {{ 'landing.hero.eyebrow' | transloco }}
          </span>
          <h1
            id="hero-title"
            class="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.75rem]"
          >
            {{ 'landing.hero.titleLine1' | transloco }}<br />
            <span class="text-ib-blue">{{ 'landing.hero.titleLine2' | transloco }}</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
            {{ 'landing.hero.subtitle' | transloco }}
          </p>

          <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              routerLink="/auth/register"
              class="inline-flex min-h-12 items-center gap-2 rounded-md bg-ib-blue px-6 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <span>{{ 'landing.hero.primaryCta' | transloco }}</span>
              <app-icon name="arrow-right" [size]="16" />
            </a>
            <a
              href="#pricing"
              class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border px-6 py-3 text-base font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >{{ 'landing.hero.secondaryCta' | transloco }}</a
            >
          </div>

          <button
            type="button"
            (click)="startDemo()"
            [disabled]="demoLoading()"
            class="mt-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-ib-blue transition-colors hover:underline disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            {{ (demoLoading() ? 'landing.hero.demoLoading' : 'landing.hero.demoCta') | transloco }}
            <app-icon name="arrow-right" [size]="14" />
          </button>

          <p class="mt-6 flex items-center justify-center gap-2 text-sm text-text-muted">
            <app-icon name="lock" [size]="14" class="text-ib-blue" />
            <span>{{ 'landing.hero.reassurance' | transloco }}</span>
          </p>
        </div>

        <figure
          class="mt-14 overflow-hidden rounded-lg border border-border bg-surface p-2 shadow-2xl shadow-black/40 lg:mt-16"
        >
          <img
            ngSrc="/screen/img_9.webp"
            [alt]="'landing.hero.screenshotAlt' | transloco"
            class="block h-auto w-full rounded-md"
            priority
            height="935"
            width="1908"
          />
          <figcaption class="px-2 pt-2.5 pb-1 font-mono text-xs text-text-muted">
            {{ 'landing.hero.screenshotCaption' | transloco }}
          </figcaption>
        </figure>
      </section>

      <!-- Problem -->
      <section class="border-y border-border bg-surface" aria-labelledby="problem-title">
        <div class="mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <header class="max-w-3xl">
            <span
              class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-text-muted"
            >
              <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-text-muted"></span>
              {{ 'landing.problem.eyebrow' | transloco }}
            </span>
            <h2 id="problem-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {{ 'landing.problem.title' | transloco }}
            </h2>
            <p class="mt-4 text-lg leading-relaxed text-text-muted">
              {{ 'landing.problem.lead' | transloco }}
            </p>
          </header>

          <dl class="mt-12 grid gap-x-12 gap-y-10 border-t border-border pt-10 sm:grid-cols-3">
            <div>
              <dt class="text-base font-semibold tracking-tight text-text-primary">
                {{ 'landing.problem.free.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.problem.free.description' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="text-base font-semibold tracking-tight text-text-primary">
                {{ 'landing.problem.profile.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.problem.profile.description' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="text-base font-semibold tracking-tight text-text-primary">
                {{ 'landing.problem.readable.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.problem.readable.description' | transloco }}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- How it works (E2EE) -->
      <section
        id="security"
        class="mx-auto max-w-6xl px-6 py-24 lg:py-32"
        aria-labelledby="how-title"
      >
        <header class="max-w-3xl">
          <span
            class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-blue"
          >
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-blue"></span>
            {{ 'landing.how.eyebrow' | transloco }}
          </span>
          <h2 id="how-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.how.title' | transloco }}
          </h2>
          <p class="mt-4 text-lg leading-relaxed text-text-muted">
            {{ 'landing.how.subtitle' | transloco }}
          </p>
        </header>

        <ol class="mt-12 grid gap-x-10 gap-y-10 border-t border-border pt-10 sm:grid-cols-3">
          <li>
            <span class="font-mono text-sm text-ib-blue">01</span>
            <h3 class="mt-3 text-xl font-semibold tracking-tight">
              {{ 'landing.how.step1.title' | transloco }}
            </h3>
            <p class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.how.step1.body' | transloco }}
            </p>
          </li>
          <li>
            <span class="font-mono text-sm text-ib-blue">02</span>
            <h3 class="mt-3 text-xl font-semibold tracking-tight">
              {{ 'landing.how.step2.title' | transloco }}
            </h3>
            <p class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.how.step2.body' | transloco }}
            </p>
          </li>
          <li>
            <span class="font-mono text-sm text-ib-blue">03</span>
            <h3 class="mt-3 text-xl font-semibold tracking-tight">
              {{ 'landing.how.step3.title' | transloco }}
            </h3>
            <p class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.how.step3.body' | transloco }}
            </p>
          </li>
        </ol>

        <ul
          class="mt-12 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-border pt-8 font-mono text-xs tracking-tight text-text-muted"
        >
          <li class="flex items-center gap-2">
            <app-icon name="key" [size]="14" class="text-ib-blue" />
            <span>PBKDF2</span>
          </li>
          <li aria-hidden="true" class="text-border">·</li>
          <li>AES-256-GCM</li>
          <li aria-hidden="true" class="text-border">·</li>
          <li>{{ 'landing.how.envelope' | transloco }}</li>
          <li aria-hidden="true" class="text-border">·</li>
          <li class="flex items-center gap-2">
            <app-icon name="shield-check" [size]="14" class="text-ib-blue" />
            <span>{{ 'landing.how.zeroKnowledge' | transloco }}</span>
          </li>
        </ul>
      </section>

      <!-- Budget pillar -->
      <section id="budget" class="border-t border-border bg-surface" aria-labelledby="budget-title">
        <div class="mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <header class="max-w-3xl">
            <span
              class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-green"
            >
              <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-green"></span>
              {{ 'landing.budget.tag' | transloco }}
            </span>
            <h2 id="budget-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {{ 'landing.budget.title' | transloco }}
            </h2>
            <p class="mt-4 text-lg leading-relaxed text-text-muted">
              {{ 'landing.budget.subtitle' | transloco }}
            </p>
          </header>

          <dl class="mt-12 grid gap-x-12 gap-y-8 border-t border-border pt-10 sm:grid-cols-2">
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-green">
                {{ 'landing.budget.accounts.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.budget.accounts.description' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-green">
                {{ 'landing.budget.envelopes.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.budget.envelopes.description' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-green">
                {{ 'landing.budget.recurrences.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.budget.recurrences.description' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-green">
                {{ 'landing.budget.loans.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.budget.loans.description' | transloco }}
              </dd>
            </div>
          </dl>

          <figure
            class="mt-12 overflow-hidden rounded-lg border border-border bg-canvas p-2 shadow-2xl shadow-black/40 lg:mt-16"
          >
            <img
              ngSrc="/screen/img.webp"
              [alt]="'landing.budget.screenshotAlt' | transloco"
              class="block h-auto w-full rounded-md"
              loading="lazy"
              height="935"
              width="1908"
            />
          </figure>
        </div>
      </section>

      <!-- Medical pillar -->
      <section id="medical" class="border-t border-border" aria-labelledby="medical-title">
        <div class="mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <header class="max-w-3xl">
            <span
              class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-purple"
            >
              <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-purple"></span>
              {{ 'landing.medical.tag' | transloco }}
            </span>
            <h2 id="medical-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {{ 'landing.medical.title' | transloco }}
            </h2>
            <p class="mt-4 text-lg leading-relaxed text-text-muted">
              {{ 'landing.medical.subtitle' | transloco }}
            </p>
          </header>

          <dl class="mt-12 grid gap-x-12 gap-y-8 border-t border-border pt-10 sm:grid-cols-2">
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-purple">
                {{ 'landing.medical.members.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.medical.members.description' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-purple">
                {{ 'landing.medical.appointments.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.medical.appointments.description' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-purple">
                {{ 'landing.medical.medications.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.medical.medications.description' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-purple">
                {{ 'landing.medical.documents.title' | transloco }}
              </dt>
              <dd class="mt-2 text-base leading-relaxed text-text-muted">
                {{ 'landing.medical.documents.description' | transloco }}
              </dd>
            </div>
          </dl>

          <figure
            class="mt-12 overflow-hidden rounded-lg border border-border bg-surface p-2 shadow-2xl shadow-black/40 lg:mt-16"
          >
            <img
              ngSrc="/screen/img_6.webp"
              [alt]="'landing.medical.screenshotAlt' | transloco"
              class="block h-auto w-full rounded-md"
              loading="lazy"
              height="935"
              width="1908"
            />
          </figure>
        </div>
      </section>

      <!-- Pricing -->
      <section
        id="pricing"
        class="border-t border-border bg-surface"
        aria-labelledby="pricing-title"
      >
        <div class="mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <header class="max-w-3xl">
            <span
              class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-blue"
            >
              <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-blue"></span>
              {{ 'landing.pricing.eyebrow' | transloco }}
            </span>
            <h2 id="pricing-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {{ 'landing.pricing.title' | transloco }}
            </h2>
            <p class="mt-4 text-lg leading-relaxed text-text-muted">
              {{ 'landing.pricing.subtitle' | transloco }}
            </p>
          </header>

          <div class="mt-12 grid gap-6 lg:grid-cols-2">
            <!-- Free -->
            <article class="flex flex-col rounded-lg border border-border bg-canvas p-8">
              <h3 class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">
                {{ 'landing.pricing.free.name' | transloco }}
              </h3>
              <p class="mt-4 flex items-baseline gap-1.5">
                <span class="text-4xl font-semibold tracking-tight">{{
                  'landing.pricing.free.price' | transloco
                }}</span>
                <span class="text-sm text-text-muted">{{
                  'landing.pricing.free.period' | transloco
                }}</span>
              </p>
              <p class="mt-3 text-base leading-relaxed text-text-muted">
                {{ 'landing.pricing.free.tagline' | transloco }}
              </p>
              <ul class="mt-6 space-y-3 border-t border-border pt-6 text-base text-text-primary">
                <li class="flex items-start gap-3">
                  <app-icon name="check" [size]="16" class="mt-1 text-ib-green" />
                  <span>{{ 'landing.pricing.free.feature1' | transloco }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <app-icon name="check" [size]="16" class="mt-1 text-ib-green" />
                  <span>{{ 'landing.pricing.free.feature2' | transloco }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <app-icon name="check" [size]="16" class="mt-1 text-ib-green" />
                  <span>{{ 'landing.pricing.free.feature3' | transloco }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <app-icon name="check" [size]="16" class="mt-1 text-ib-green" />
                  <span>{{ 'landing.pricing.free.feature4' | transloco }}</span>
                </li>
              </ul>
              <a
                routerLink="/auth/register"
                class="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border px-6 py-3 text-base font-medium text-text-primary transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >{{ 'landing.pricing.free.cta' | transloco }}</a
              >
            </article>

            <!-- Premium -->
            <article class="flex flex-col rounded-lg border border-ib-blue bg-canvas p-8">
              <div class="flex items-center justify-between gap-3">
                <h3 class="font-mono text-xs uppercase tracking-[0.16em] text-ib-blue">
                  {{ 'landing.pricing.premium.name' | transloco }}
                </h3>
                <span
                  class="rounded-md bg-ib-blue/10 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.16em] text-ib-blue"
                  >{{ 'landing.pricing.premium.badge' | transloco }}</span
                >
              </div>
              <p class="mt-4 flex items-baseline gap-1.5">
                <span class="text-4xl font-semibold tracking-tight text-ib-blue"
                  >{{ premiumPrice }}{{ 'landing.pricing.premium.currency' | transloco }}</span
                >
                <span class="text-sm text-text-muted">{{
                  'landing.pricing.premium.period' | transloco
                }}</span>
              </p>
              <p class="mt-3 text-base leading-relaxed text-text-muted">
                {{ 'landing.pricing.premium.tagline' | transloco }}
              </p>
              <ul class="mt-6 space-y-3 border-t border-border pt-6 text-base text-text-primary">
                <li class="flex items-start gap-3">
                  <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                  <span>{{ 'landing.pricing.premium.feature1' | transloco }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                  <span>{{ 'landing.pricing.premium.feature2' | transloco }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                  <span>{{ 'landing.pricing.premium.feature3' | transloco }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                  <span>{{ 'landing.pricing.premium.feature4' | transloco }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                  <span>{{ 'landing.pricing.premium.feature5' | transloco }}</span>
                </li>
              </ul>
              <a
                routerLink="/auth/register"
                class="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ib-blue px-6 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >{{ 'landing.pricing.premium.cta' | transloco }}</a
              >
            </article>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section id="faq" class="mx-auto max-w-6xl px-6 py-24 lg:py-32" aria-labelledby="faq-title">
        <header class="max-w-3xl">
          <span
            class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-text-muted"
          >
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-text-muted"></span>
            {{ 'landing.faq.eyebrow' | transloco }}
          </span>
          <h2 id="faq-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.faq.title' | transloco }}
          </h2>
        </header>

        <dl class="mt-12 border-t border-border">
          <details class="group border-b border-border py-5">
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >
              <span>{{ 'landing.faq.q1.question' | transloco }}</span>
              <app-icon
                name="chevron-down"
                [size]="18"
                class="shrink-0 text-text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <p class="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
              {{ 'landing.faq.q1.answer' | transloco }}
            </p>
          </details>
          <details class="group border-b border-border py-5">
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >
              <span>{{ 'landing.faq.q2.question' | transloco }}</span>
              <app-icon
                name="chevron-down"
                [size]="18"
                class="shrink-0 text-text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <p class="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
              {{ 'landing.faq.q2.answer' | transloco }}
            </p>
          </details>
          <details class="group border-b border-border py-5">
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >
              <span>{{ 'landing.faq.q3.question' | transloco }}</span>
              <app-icon
                name="chevron-down"
                [size]="18"
                class="shrink-0 text-text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <p class="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
              {{ 'landing.faq.q3.answer' | transloco }}
            </p>
          </details>
          <details class="group border-b border-border py-5">
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >
              <span>{{ 'landing.faq.q4.question' | transloco }}</span>
              <app-icon
                name="chevron-down"
                [size]="18"
                class="shrink-0 text-text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <p class="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
              {{ 'landing.faq.q4.answer' | transloco }}
            </p>
          </details>
          <details class="group border-b border-border py-5">
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >
              <span>{{ 'landing.faq.q5.question' | transloco }}</span>
              <app-icon
                name="chevron-down"
                [size]="18"
                class="shrink-0 text-text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <p class="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
              {{ 'landing.faq.q5.answer' | transloco }}
            </p>
          </details>
        </dl>
      </section>

      <!-- Final CTA -->
      <section
        class="border-t border-border bg-surface"
        [attr.aria-label]="'landing.finalCta.ariaLabel' | transloco"
      >
        <div class="mx-auto max-w-3xl px-6 py-24 text-center lg:py-32">
          <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.finalCta.title' | transloco }}
          </h2>
          <p class="mt-4 text-lg leading-relaxed text-text-muted">
            {{ 'landing.finalCta.subtitle' | transloco }}
          </p>
          <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              routerLink="/auth/register"
              class="inline-flex min-h-12 items-center gap-2 rounded-md bg-ib-blue px-7 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span>{{ 'landing.finalCta.primaryCta' | transloco }}</span>
              <app-icon name="arrow-right" [size]="16" />
            </a>
            <a
              routerLink="/auth/login"
              class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-canvas px-7 py-3 text-base font-medium text-text-primary transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >{{ 'landing.finalCta.secondaryCta' | transloco }}</a
            >
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-border bg-canvas">
      <div
        class="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-10 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="flex items-center gap-2">
          <app-icon name="dashflow-logo" [size]="14" class="text-ib-blue" />
          <span>DashFlow · &copy; {{ currentYear }}</span>
        </p>
        <p class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            [href]="'mailto:' + contactEmail"
            class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >{{ contactEmail }}</a
          >
          <a
            routerLink="/legal"
            class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >{{ 'landing.footer.legal' | transloco }}</a
          >
          <a
            routerLink="/auth/login"
            class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >{{ 'landing.footer.login' | transloco }}</a
          >
        </p>
      </div>
    </footer>
  `,
})
export class LandingComponent {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly premiumPrice = 49;
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
