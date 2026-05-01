import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { Icon } from '@shared/components/icon/icon';

const DEMO_URL = 'https://dashflow.j-ned.dev';
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
  imports: [RouterLink, NgOptimizedImage, Icon],
  host: { class: 'block min-h-screen bg-canvas text-text-primary selection:bg-ib-blue/25' },
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-ib-blue focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas"
    >Aller au contenu</a>

    <nav
      class="sticky top-0 z-50 border-b border-border bg-canvas"
      aria-label="Navigation principale"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a
          routerLink="/"
          class="group inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          aria-label="DashFlow — accueil"
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
            [href]="demoUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-ib-blue px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <span>Voir la démo</span>
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
              Self-hosted · End-to-end encrypted · Open source
            </p>
            <h1 class="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Budget familial.<br />
              Suivi médical.<br />
              <span class="text-ib-blue">Sur ton serveur.</span>
            </h1>
            <p class="mt-6 max-w-xl text-lg leading-relaxed text-text-muted">
              Une app pour gérer comptes, enveloppes, rendez-vous et ordonnances de toute la famille.
              Chiffrée côté client. Le serveur ne voit rien.
            </p>

            <div class="mt-10 flex flex-wrap items-center gap-4">
              <a
                [href]="demoUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-12 items-center gap-2 rounded-md bg-ib-blue px-6 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <span>Voir la démo live</span>
                <app-icon name="arrow-up-right" [size]="16" />
              </a>
              <a
                [href]="githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border px-6 py-3 text-base font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <span>Code sur GitHub</span>
                <app-icon name="arrow-up-right" [size]="16" />
              </a>
            </div>

            <p class="mt-6 text-sm text-text-muted">
              Ou
              <a
                href="#stack"
                class="rounded-sm font-medium text-text-primary underline decoration-border decoration-1 underline-offset-4 transition-colors hover:decoration-ib-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
              >auto-héberge-le toi-même</a>.
            </p>
          </div>

          <div class="lg:col-span-5">
            <figure class="rounded-lg border border-border bg-surface p-2">
              <img
                ngSrc="/screen/img_9.webp"
                alt="Capture d'écran de DashFlow : vue dashboard d'un membre — KPIs budget, médicaments, rendez-vous"
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
        aria-label="Garanties cryptographiques"
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
            <li>Double enveloppe de clés</li>
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
            Budget
          </span>
          <h2 id="budget-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Comptes, enveloppes, prêts.<br />
            12 mois d'historique.
          </h2>
          <p class="mt-4 text-lg text-text-muted">
            Revenus, prélèvements, charges annuelles, dépenses, restes à vivre.
            Multi-comptes, multi-membres, projections, stats — sans connexion bancaire automatique.
          </p>
        </header>

        <figure class="mt-12 overflow-hidden rounded-lg border border-border bg-surface p-1.5">
          <img
            ngSrc="/screen/img.webp"
            alt="Vue compte bancaire avec KPIs revenus, charges, dépenses, et solde restant"
            class="block w-full rounded-md"
            loading="lazy"
            height="935"
            width="1908"
          />
        </figure>

        <dl class="mt-12 grid gap-x-10 gap-y-8 border-t border-border pt-10 sm:grid-cols-3">
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Enveloppes</dt>
            <dd class="mt-3 text-base leading-relaxed text-text-primary">
              Catégorise épargne, vacances, équipement et impôts.
              Suivi de progression vers chaque objectif.
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Prêts &amp; dettes</dt>
            <dd class="mt-3 text-base leading-relaxed text-text-primary">
              Échéances, intérêts cumulés, capital restant dû.
              Historique complet par membre du foyer.
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Récurrences</dt>
            <dd class="mt-3 text-base leading-relaxed text-text-primary">
              Charges mensuelles, annuelles, transferts ponctuels ou récurrents.
              Projection 12 mois automatique.
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
              Médical
            </span>
            <h2 id="medical-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Patients, praticiens,<br />
              ordonnances, médicaments.
            </h2>
            <p class="mt-4 text-lg text-text-muted">
              Le parcours de soin de chaque membre dans une seule vue.
              Documents chiffrés, alertes de stock bas, calendrier des consultations.
            </p>
          </header>

          <figure class="mt-12 overflow-hidden rounded-lg border border-border bg-canvas p-1.5">
            <img
              ngSrc="/screen/img_6.webp"
              alt="Vue médicale : liste des patients de la famille avec leurs alertes et rendez-vous"
              class="block w-full rounded-md"
              loading="lazy"
              height="935"
              width="1908"
            />
          </figure>

          <dl class="mt-12 grid gap-x-10 gap-y-8 border-t border-border pt-10 sm:grid-cols-3">
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Médicaments</dt>
              <dd class="mt-3 text-base leading-relaxed text-text-primary">
                Stocks, posologies, jours restants estimés.
                Alertes automatiques quand un traitement arrive en fin de boîte.
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Documents</dt>
              <dd class="mt-3 text-base leading-relaxed text-text-primary">
                Bilans sanguins, certificats, ordonnances.
                Stockage S3 chiffré côté client avant upload.
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Rendez-vous</dt>
              <dd class="mt-3 text-base leading-relaxed text-text-primary">
                Planning par patient et par praticien.
                Historique consultations, motifs, comptes rendus.
              </dd>
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
            Sous le capot
          </span>
          <h2 id="stack-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Pas un produit SaaS.<br />
            Un projet bien fait.
          </h2>
          <p class="mt-4 text-lg text-text-muted">
            Toute la cryptographie tourne dans le navigateur. Le backend voit du JSON opaque.
            Si le serveur est compromis, l'attaquant repart avec des octets aléatoires.
          </p>
        </header>

        <div class="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <pre
            class="lg:col-span-7 overflow-x-auto rounded-lg border border-border bg-surface p-5 font-mono text-[13px] leading-relaxed"
          ><code class="block text-text-muted">// Chiffrement E2EE, côté client uniquement</code><code class="block whitespace-pre text-text-primary">{{ cryptoSnippet }}</code></pre>

          <dl class="lg:col-span-5 flex flex-col gap-6">
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Frontend</dt>
              <dd class="mt-2 text-base text-text-primary">
                Angular 21 zoneless · Signals · Standalone components · Tailwind v4
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Backend</dt>
              <dd class="mt-2 text-base text-text-primary">
                Hono · PostgreSQL 17 · Drizzle ORM · Argon2id · JWT rotation
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Charts</dt>
              <dd class="mt-2 text-base text-text-primary">
                Area, donut, bar — SVG écrits à la main, zéro dépendance JS.
              </dd>
            </div>
            <div>
              <dt class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Architecture</dt>
              <dd class="mt-2 text-base text-text-primary">
                Clean Architecture · Domain isolé · Tests Vitest · CI GitHub Actions
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="border-t border-border bg-surface" aria-label="Appel à l'action">
        <div class="mx-auto max-w-3xl px-6 py-24 text-center lg:py-32">
          <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">
            Lis le code, lance la démo,<br />
            héberge-le toi-même.
          </h2>
          <p class="mt-4 text-lg text-text-muted">
            La démo est ouverte, le code est public, l'install se fait en quelques minutes en Docker.
          </p>
          <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              [href]="demoUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-12 items-center gap-2 rounded-md bg-ib-blue px-7 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span>Voir la démo live</span>
              <app-icon name="arrow-up-right" [size]="16" />
            </a>
            <a
              [href]="githubUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-canvas px-7 py-3 text-base font-medium text-text-primary transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span>Code sur GitHub</span>
              <app-icon name="arrow-up-right" [size]="16" />
            </a>
          </div>
          <p class="mt-6 text-sm text-text-muted">
            Tu préfères créer un compte sur cette instance ?
            <a
              routerLink="/auth/register"
              class="rounded-sm font-medium text-text-primary underline decoration-border decoration-1 underline-offset-4 transition-colors hover:decoration-ib-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >S'inscrire</a>.
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
          >Se connecter</a>
        </p>
      </div>
    </footer>
  `,
})
export class LandingComponent {
  protected readonly demoUrl = DEMO_URL;
  protected readonly githubUrl = GITHUB_URL;
  protected readonly portfolioUrl = PORTFOLIO_URL;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly cryptoSnippet = CRYPTO_SNIPPET;
}
