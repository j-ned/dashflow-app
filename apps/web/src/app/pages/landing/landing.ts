import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { AuthStore } from '@features/auth/domain/auth.store';
const GITHUB_URL = 'https://github.com/j-ned/dash-flow';
const PORTFOLIO_URL = 'https://j-ned.dev';

const CRYPTO_SNIPPET = `async function encryptPayload(data, kek) {
  const dek = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, dek, encode(data)
  );
  return { cipher, iv, dek: await wrapKey(dek, kek) };
}`;

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgOptimizedImage, Icon, TranslocoPipe],
  host: { class: 'block min-h-screen bg-canvas text-text-primary selection:bg-ib-blue/25' },
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-ib-blue focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas"
    >{{ 'landing.skipToContent' | transloco }}</a>

    <nav
      class="sticky top-0 z-50 border-b border-border bg-canvas"
      [attr.aria-label]="'landing.nav.ariaLabel' | transloco"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a
          routerLink="/"
          class="group inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          [attr.aria-label]="'landing.nav.logoLabel' | transloco"
        >
          <app-icon name="dashflow-logo" [size]="22" class="text-ib-blue" />
          <span class="font-mono text-base font-semibold tracking-tight">dashflow</span>
        </a>

        <div class="flex items-center gap-1 sm:gap-2">
          <a
            [href]="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <span>GitHub</span>
            <app-icon name="arrow-up-right" [size]="14" />
          </a>
          <a
            href="#"
            (click)="onDemoClick($event)"
            [attr.aria-busy]="demoLoading()"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-ib-blue px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <span>{{ 'landing.nav.viewDemo' | transloco }}</span>
            <app-icon name="arrow-up-right" [size]="14" />
          </a>
        </div>
      </div>
    </nav>

    <main id="main">
      <section class="mx-auto max-w-6xl px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div class="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div class="lg:col-span-7">
            <p class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
              {{ 'landing.hero.tagline' | transloco }}
            </p>
            <h1 class="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              {{ 'landing.hero.titleLine1' | transloco }}<br />
              {{ 'landing.hero.titleLine2' | transloco }}<br />
              <span class="text-ib-blue">{{ 'landing.hero.titleLine3' | transloco }}</span>
            </h1>
            <p class="mt-6 max-w-xl text-lg leading-relaxed text-text-muted">
              {{ 'landing.hero.subtitle' | transloco }}
            </p>

            <div class="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#"
                (click)="onDemoClick($event)"
                [attr.aria-busy]="demoLoading()"
                class="inline-flex min-h-12 items-center gap-2 rounded-md bg-ib-blue px-6 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <span>{{ 'landing.hero.viewLiveDemo' | transloco }}</span>
                <app-icon name="arrow-up-right" [size]="16" />
              </a>
              <a
                [href]="githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border px-6 py-3 text-base font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <span>{{ 'landing.hero.codeOnGithub' | transloco }}</span>
                <app-icon name="arrow-up-right" [size]="16" />
              </a>
            </div>

            <p class="mt-6 text-sm text-text-muted">
              {{ 'landing.hero.orPrefix' | transloco }}
              <a
                href="#stack"
                class="rounded-sm font-medium text-text-primary underline decoration-border decoration-1 underline-offset-4 transition-colors hover:decoration-ib-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
              >{{ 'landing.hero.selfHostLink' | transloco }}</a>.
            </p>
          </div>

          <div class="lg:col-span-5">
            <figure class="rounded-lg border border-border bg-surface p-2">
              <img
                ngSrc="/screen/img_9.webp"
                [alt]="'landing.hero.screenshotAlt' | transloco"
                class="block w-full rounded-md"
                priority
                height="935"
                width="1908"
              />
            </figure>
          </div>
        </div>
      </section>

      <section
        class="border-y border-border bg-surface"
        [attr.aria-label]="'landing.proofBand.ariaLabel' | transloco"
      >
        <div class="mx-auto max-w-6xl px-6 py-5">
          <ul class="flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-xs tracking-tight text-text-muted">
            <li class="flex items-center gap-2">
              <app-icon name="lock" [size]="14" class="text-ib-blue" />
              <span>AES-256-GCM</span>
            </li>
            <li aria-hidden="true" class="text-border">·</li>
            <li>PBKDF2 100 000 itérations</li>
            <li aria-hidden="true" class="text-border">·</li>
            <li>Argon2id</li>
            <li aria-hidden="true" class="text-border">·</li>
            <li>{{ 'landing.proofBand.doubleEnvelope' | transloco }}</li>
            <li aria-hidden="true" class="text-border">·</li>
            <li class="flex items-center gap-2">
              <app-icon name="shield-check" [size]="14" class="text-ib-blue" />
              <span>Zero-knowledge serveur</span>
            </li>
          </ul>
        </div>
      </section>

      <section
        id="budget"
        class="mx-auto max-w-6xl px-6 py-24 lg:py-32"
        aria-labelledby="budget-title"
      >
        <header class="max-w-3xl">
          <span class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-green">
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-green"></span>
            {{ 'landing.budget.tag' | transloco }}
          </span>
          <h2 id="budget-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.budget.titleLine1' | transloco }}<br />
            {{ 'landing.budget.titleLine2' | transloco }}
          </h2>
          <p class="mt-4 text-lg text-text-muted">
            {{ 'landing.budget.subtitle' | transloco }}
          </p>
        </header>

        <figure class="mt-12 overflow-hidden rounded-lg border border-border bg-surface p-1.5">
          <img
            ngSrc="/screen/img.webp"
            [alt]="'landing.budget.screenshotAlt' | transloco"
            class="block w-full rounded-md"
            loading="lazy"
            height="935"
            width="1908"
          />
        </figure>

        <dl class="mt-12 grid gap-x-10 gap-y-8 border-t border-border pt-10 sm:grid-cols-3">
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.budget.envelopes.title' | transloco }}</dt>
            <dd class="mt-3 text-base leading-relaxed text-text-primary">
              {{ 'landing.budget.envelopes.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.budget.loans.title' | transloco }}</dt>
            <dd class="mt-3 text-base leading-relaxed text-text-primary">
              {{ 'landing.budget.loans.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.budget.recurrences.title' | transloco }}</dt>
            <dd class="mt-3 text-base leading-relaxed text-text-primary">
              {{ 'landing.budget.recurrences.description' | transloco }}
            </dd>
          </div>
        </dl>
      </section>

      <section
        id="medical"
        class="border-t border-border bg-surface/40"
        aria-labelledby="medical-title"
      >
        <div class="mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <header class="max-w-3xl">
            <span class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-purple">
              <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-purple"></span>
              {{ 'landing.medical.tag' | transloco }}
            </span>
            <h2 id="medical-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {{ 'landing.medical.titleLine1' | transloco }}<br />
              {{ 'landing.medical.titleLine2' | transloco }}
            </h2>
            <p class="mt-4 text-lg text-text-muted">
              {{ 'landing.medical.subtitle' | transloco }}
            </p>
          </header>

          <figure class="mt-12 overflow-hidden rounded-lg border border-border bg-canvas p-1.5">
            <img
              ngSrc="/screen/img_6.webp"
              [alt]="'landing.medical.screenshotAlt' | transloco"
              class="block w-full rounded-md"
              loading="lazy"
              height="935"
              width="1908"
            />
          </figure>

          <dl class="mt-12 max-w-3xl space-y-7 border-t border-border pt-10">
            <div class="flex items-start gap-5">
              <div class="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-ib-purple/30 bg-ib-purple/10">
                <app-icon name="pill" [size]="16" class="text-ib-purple" />
              </div>
              <div>
                <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.medical.medications.title' | transloco }}</dt>
                <dd class="mt-1 text-base leading-relaxed text-text-primary">
                  {{ 'landing.medical.medications.description' | transloco }}
                </dd>
              </div>
            </div>
            <div class="flex items-start gap-5">
              <div class="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-ib-purple/30 bg-ib-purple/10">
                <app-icon name="folder" [size]="16" class="text-ib-purple" />
              </div>
              <div>
                <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.medical.documents.title' | transloco }}</dt>
                <dd class="mt-1 text-base leading-relaxed text-text-primary">
                  {{ 'landing.medical.documents.description' | transloco }}
                </dd>
              </div>
            </div>
            <div class="flex items-start gap-5">
              <div class="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-ib-purple/30 bg-ib-purple/10">
                <app-icon name="calendar" [size]="16" class="text-ib-purple" />
              </div>
              <div>
                <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.medical.appointments.title' | transloco }}</dt>
                <dd class="mt-1 text-base leading-relaxed text-text-primary">
                  {{ 'landing.medical.appointments.description' | transloco }}
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </section>

      <section
        id="stack"
        class="mx-auto max-w-6xl px-6 py-24 lg:py-32"
        aria-labelledby="stack-title"
      >
        <header class="max-w-3xl">
          <span class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-cyan">
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-cyan"></span>
            {{ 'landing.stack.tag' | transloco }}
          </span>
          <h2 id="stack-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.stack.titleLine1' | transloco }}<br />
            {{ 'landing.stack.titleLine2' | transloco }}
          </h2>
          <p class="mt-4 text-lg text-text-muted">
            {{ 'landing.stack.subtitle' | transloco }}
          </p>
        </header>

        <div class="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <pre
            class="lg:col-span-7 overflow-x-auto rounded-lg border border-border bg-surface p-5 font-mono text-[13px] leading-relaxed"
          ><code class="block text-text-muted">{{ 'landing.stack.codeComment' | transloco }}</code><code class="block whitespace-pre text-text-primary">{{ cryptoSnippet }}</code></pre>

          <dl class="lg:col-span-5 flex flex-col gap-6">
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.stack.frontend' | transloco }}</dt>
              <dd class="mt-2 text-base text-text-primary">
                {{ 'landing.stack.frontendDescription' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.stack.backend' | transloco }}</dt>
              <dd class="mt-2 text-base text-text-primary">
                {{ 'landing.stack.backendDescription' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.stack.charts' | transloco }}</dt>
              <dd class="mt-2 text-base text-text-primary">
                {{ 'landing.stack.chartsDescription' | transloco }}
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{{ 'landing.stack.architecture' | transloco }}</dt>
              <dd class="mt-2 text-base text-text-primary">
                {{ 'landing.stack.architectureDescription' | transloco }}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="border-t border-border bg-surface" [attr.aria-label]="'landing.cta.ariaLabel' | transloco">
        <div class="mx-auto max-w-3xl px-6 py-24 text-center lg:py-32">
          <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.cta.titleLine1' | transloco }}<br />
            {{ 'landing.cta.titleLine2' | transloco }}
          </h2>
          <p class="mt-4 text-lg text-text-muted">
            {{ 'landing.cta.subtitle' | transloco }}
          </p>
          <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#"
              (click)="onDemoClick($event)"
              [attr.aria-busy]="demoLoading()"
              class="inline-flex min-h-12 items-center gap-2 rounded-md bg-ib-blue px-7 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span>{{ 'landing.hero.viewLiveDemo' | transloco }}</span>
              <app-icon name="arrow-up-right" [size]="16" />
            </a>
            <a
              [href]="githubUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-canvas px-7 py-3 text-base font-medium text-text-primary transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span>{{ 'landing.hero.codeOnGithub' | transloco }}</span>
              <app-icon name="arrow-up-right" [size]="16" />
            </a>
          </div>
          <p class="mt-6 text-sm text-text-muted">
            {{ 'landing.cta.registerPrefix' | transloco }}
            <a
              routerLink="/auth/register"
              class="rounded-sm font-medium text-text-primary underline decoration-border decoration-1 underline-offset-4 transition-colors hover:decoration-ib-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >{{ 'landing.cta.registerLink' | transloco }}</a>.
          </p>
        </div>
      </section>
    </main>

    <footer class="border-t border-border bg-canvas">
      <div class="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-10 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p class="flex items-center gap-2">
          <app-icon name="dashflow-logo" [size]="14" class="text-ib-blue" />
          <span>DashFlow · &copy; {{ currentYear }}</span>
        </p>
        <p class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            [href]="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
          >GitHub</a>
          <a
            [href]="portfolioUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
          >j-ned.dev</a>
          <a
            routerLink="/auth/login"
            class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
          >{{ 'landing.footer.login' | transloco }}</a>
        </p>
      </div>
    </footer>
  `,
})
export class LandingComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly demoLoading = signal(false);

  protected async onDemoClick(event: Event): Promise<void> {
    event.preventDefault();
    if (this.demoLoading()) return;
    this.demoLoading.set(true);
    try {
      await this.authStore.demoLogin();
      await this.router.navigate(['/budget']);
    } catch (err) {
      console.error('Demo login failed', err);
      this.demoLoading.set(false);
    }
  }

  protected readonly githubUrl = GITHUB_URL;
  protected readonly portfolioUrl = PORTFOLIO_URL;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly cryptoSnippet = CRYPTO_SNIPPET;
}
