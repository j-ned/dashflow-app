import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '@shared/components/icon/icon';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, NgOptimizedImage],
  host: { class: 'block min-h-screen bg-canvas selection:bg-ib-blue/20' },
  template: `
    <!-- ==========================================
         NAVIGATION
         ========================================== -->
    <nav
      class="fixed top-0 left-0 right-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md transition-all"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <!-- Logo -->
        <a
          routerLink="/"
          class="group flex items-center gap-3 transition-opacity hover:opacity-90"
          aria-label="Accueil DashFlow"
        >
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-ib-blue to-ib-blue/80 shadow-sm shadow-ib-blue/20"
          >
            <app-icon name="chart-line" [size]="20" class="text-white" />
          </div>
          <span class="text-xl font-extrabold tracking-tight text-text-primary">DashFlow</span>
        </a>

        <!-- Actions -->
        <div class="flex items-center gap-2 sm:gap-4">
          <a
            routerLink="/auth/login"
            class="rounded-xl px-4 py-2.5 text-sm font-semibold text-text-muted transition-all hover:bg-surface-hover hover:text-text-primary"
          >
            Se connecter
          </a>
          <a
            routerLink="/auth/register"
            class="hidden sm:inline-flex items-center justify-center rounded-xl bg-ib-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-ib-blue/90 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            Commencer gratuitement
          </a>
        </div>
      </div>
    </nav>

    <main>
      <!-- ==========================================
           HERO SECTION
           ========================================== -->
      <header class="relative overflow-hidden pt-32 pb-16 lg:pt-40 lg:pb-20">
        <!-- Background Effects -->
        <div
          class="absolute inset-x-0 -top-20 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-40"
        >
          <div
            class="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-ib-blue/20 to-ib-purple/20 opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
          ></div>
        </div>

        <div class="relative mx-auto max-w-5xl px-6 text-center">
          <div
            class="mb-4 inline-flex items-center gap-2 rounded-full border border-ib-blue/20 bg-ib-blue/5 px-4 py-1.5 text-sm font-medium text-ib-blue backdrop-blur-sm"
          >
            <span class="relative flex h-2 w-2">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-ib-blue opacity-75"
              ></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-ib-blue"></span>
            </span>
            Tableau de bord personnel tout-en-un
          </div>

          <h1
            class="text-4xl font-extrabold leading-[1.15] tracking-tight text-text-primary sm:text-5xl lg:text-[4rem]"
          >
            Votre
            <span class="bg-linear-to-r from-ib-blue to-cyan-500 bg-clip-text text-transparent"
            >budget</span
            >
            et votre
            <span class="bg-linear-to-r from-ib-purple to-fuchsia-500 bg-clip-text text-transparent"
            >santé</span
            >, enfin réunis
          </h1>

          <p class="mx-auto mt-6 max-w-xl text-lg text-text-muted sm:text-xl leading-relaxed">
            Finances familiales, suivi médical, tout centralisé en un seul tableau de bord. Simple,
            sécurisé, gratuit.
          </p>

          <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              routerLink="/auth/register"
              class="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-ib-blue px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-ib-blue/25 transition-all hover:bg-ib-blue/90 hover:shadow-xl hover:shadow-ib-blue/40 hover:-translate-y-0.5"
            >
              <app-icon name="arrow-right" [size]="18" />
              Créer mon compte
            </a>
            <a
              href="#budget"
              class="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 py-3 text-sm font-medium text-text-primary shadow-sm transition-all hover:bg-surface-hover hover:-translate-y-0.5"
            >
              Découvrir les fonctionnalités
            </a>
          </div>
        </div>

        <!-- Hero screenshot -->
        <div class="relative mx-auto mt-16 max-w-5xl px-6 lg:mt-20">
          <div
            class="rounded-2xl border border-border bg-surface/50 p-1.5 shadow-2xl shadow-ib-blue/10 backdrop-blur-sm lg:p-2.5"
          >
            <div class="overflow-hidden rounded-xl border border-border/50 bg-canvas">
              <img
                ngSrc="/screen/img_9.webp"
                alt="Dashboard budget DashFlow — vue globale par membre"
                class="w-full object-cover"
                loading="eager"
                height="935"
                width="1908"
              />
            </div>
          </div>
        </div>
      </header>

      <!-- ==========================================
           SECTION 1 — BUDGET
           ========================================== -->
      <section id="budget" class="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div class="flex flex-col items-center text-center mb-16 sm:mb-24">
          <span
            class="inline-flex items-center gap-2 rounded-full bg-ib-green/10 px-4 py-1.5 text-sm font-bold text-ib-green"
          >
            <app-icon name="credit-card" [size]="16" />
            Espace Budget
          </span>
          <h2
            class="mt-6 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl"
          >
            Vos finances familiales, sous contrôle
          </h2>
          <p class="mt-4 max-w-2xl text-lg text-text-muted">
            Suivez revenus, charges, enveloppes et prêts de chaque membre de la famille. Tout est
            visible d'un seul coup d'œil.
          </p>
        </div>

        <!-- Feature 1: Comptes -->
        <div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div class="flex flex-col gap-6">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-ib-green/10 text-ib-green"
            >
              <app-icon name="activity" [size]="24" />
            </div>
            <h3 class="text-2xl font-bold text-text-primary">Comptes bancaires en temps réel</h3>
            <p class="text-lg text-text-muted leading-relaxed">
              Visualisez vos revenus, prélèvements mensuels, charges annuelles et dépenses en temps
              réel. Basculez entre vos comptes en un clic pour une gestion fluide.
            </p>
            <ul class="mt-2 space-y-4">
              <li class="flex items-start gap-3 text-text-muted">
                <div class="mt-1 rounded-full bg-ib-green/20 p-1 text-ib-green">
                  <app-icon name="check" [size]="14" />
                </div>
                <span class="text-base">KPIs revenus, charges, dépenses et reste à vivre</span>
              </li>
              <li class="flex items-start gap-3 text-text-muted">
                <div class="mt-1 rounded-full bg-ib-green/20 p-1 text-ib-green">
                  <app-icon name="check" [size]="14" />
                </div>
                <span class="text-base"
                >Barre de budget utilisée avec répartition intelligente</span
                >
              </li>
              <li class="flex items-start gap-3 text-text-muted">
                <div class="mt-1 rounded-full bg-ib-green/20 p-1 text-ib-green">
                  <app-icon name="check" [size]="14" />
                </div>
                <span class="text-base">Support multi-comptes : courant, livret, compte joint</span>
              </li>
            </ul>
          </div>
          <div
            class="group relative rounded-2xl border border-border bg-surface p-2 shadow-xl transition-all hover:shadow-2xl"
          >
            <div class="overflow-hidden rounded-xl border border-border/50">
              <img
                ngSrc="/screen/img.webp"
                alt="Interface des comptes bancaires"
                class="w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                loading="lazy"
                height="935" width="1908" />
            </div>
          </div>
        </div>

        <!-- Feature 2: Enveloppes -->
        <div class="mt-24 grid items-center gap-12 lg:mt-32 lg:grid-cols-2 lg:gap-16">
          <div
            class="order-2 lg:order-1 group relative rounded-2xl border border-border bg-surface p-2 shadow-xl transition-all hover:shadow-2xl"
          >
            <div class="overflow-hidden rounded-xl border border-border/50">
              <img
                ngSrc="/screen/img_1.webp"
                alt="Enveloppes budgétaires avec progression"
                class="w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                loading="lazy"
                height="935" width="1908" />
            </div>
          </div>
          <div class="order-1 flex flex-col gap-6 lg:order-2">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-ib-green/10 text-ib-green"
            >
              <app-icon name="package" [size]="24" />
            </div>
            <h3 class="text-2xl font-bold text-text-primary">Enveloppes budgétaires</h3>
            <p class="text-lg text-text-muted leading-relaxed">
              Créez des enveloppes virtuelles pour vos objectifs : vacances, impôts, épargne,
              équipement. Suivez votre progression vers chaque cible en toute simplicité.
            </p>
            <ul class="mt-2 space-y-4">
              <li class="flex items-start gap-3 text-text-muted">
                <div class="mt-1 rounded-full bg-ib-green/20 p-1 text-ib-green">
                  <app-icon name="check" [size]="14" />
                </div>
                <span class="text-base"
                >Catégorisation claire (épargne, impôts, équipement, vacances)</span
                >
              </li>
              <li class="flex items-start gap-3 text-text-muted">
                <div class="mt-1 rounded-full bg-ib-green/20 p-1 text-ib-green">
                  <app-icon name="check" [size]="14" />
                </div>
                <span class="text-base">Suivi de la progression et de l'objectif cible</span>
              </li>
              <li class="flex items-start gap-3 text-text-muted">
                <div class="mt-1 rounded-full bg-ib-green/20 p-1 text-ib-green">
                  <app-icon name="check" [size]="14" />
                </div>
                <span class="text-base">Filtrage avancé par membre de la famille</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ==========================================
           SECTION 2 — MEDICAL
           ========================================== -->
      <section id="medical" class="border-y border-border bg-surface/30 py-24 sm:py-32">
        <div class="mx-auto max-w-6xl px-6">
          <div class="flex flex-col items-center text-center mb-16 sm:mb-20">
            <span
              class="inline-flex items-center gap-2 rounded-full bg-ib-purple/10 px-4 py-1.5 text-sm font-bold text-ib-purple"
            >
              <app-icon name="heart" [size]="16" />
              Espace Médical
            </span>
            <h2
              class="mt-6 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl"
            >
              Le suivi médical de toute la famille
            </h2>
            <p class="mt-4 max-w-2xl text-lg text-text-muted">
              Rendez-vous, praticiens, ordonnances, médicaments et documents — tout le parcours de
              soin centralisé au même endroit.
            </p>
          </div>

          <!-- Medical: Vue globale -->
          <div
            class="group relative rounded-2xl border border-border bg-surface p-2 shadow-xl transition-all hover:shadow-2xl"
          >
            <div class="overflow-hidden rounded-xl border border-border/50">
              <img
                ngSrc="/screen/img_2.webp"
                alt="Vue globale médical — famille"
                class="w-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
                loading="lazy"
                height="935" width="1908" />
            </div>
            <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5"></div>
          </div>
          <p class="mt-6 text-center text-sm font-medium text-text-muted">
            Vue globale : KPIs de la famille, prochains rendez-vous, ordonnances actives et stock de
            médicaments par membre.
          </p>

          <!-- Medical: Grid Cards -->
          <div class="mt-20 grid gap-8 md:grid-cols-2">
            <!-- Card 1 -->
            <article
              class="flex flex-col rounded-3xl border border-border bg-canvas p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
            >
              <div class="mb-4 flex items-center gap-4">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-ib-purple/10 text-ib-purple"
                >
                  <app-icon name="calendar" [size]="20" />
                </div>
                <h3 class="text-xl font-bold text-text-primary">Rendez-vous</h3>
              </div>
              <p class="mb-6 text-text-muted">
                Tableau complet avec date, praticien, motif et statut. Filtrez facilement les
                consultations à venir ou passées.
              </p>
              <div class="mt-auto overflow-hidden rounded-xl border border-border/50 bg-surface">
                <img
                  ngSrc="/screen/img_6.webp"
                  alt="Liste des rendez-vous"
                  class="w-full object-cover"
                  loading="lazy"
                  height="935" width="1908" />
              </div>
            </article>

            <!-- Card 2 -->
            <article
              class="flex flex-col rounded-3xl border border-border bg-canvas p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
            >
              <div class="mb-4 flex items-center gap-4">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-ib-purple/10 text-ib-purple"
                >
                  <app-icon name="pill" [size]="20" />
                </div>
                <h3 class="text-xl font-bold text-text-primary">Médicaments</h3>
              </div>
              <p class="mb-6 text-text-muted">
                Suivi intelligent des stocks, jours restants, alertes de stock bas et estimations
                précises des dates d'épuisement.
              </p>
              <div class="mt-auto overflow-hidden rounded-xl border border-border/50 bg-surface">
                <img
                  ngSrc="/screen/img_4.webp"
                  alt="Suivi des médicaments"
                  class="w-full object-cover"
                  loading="lazy"
                  height="935" width="1908" />
              </div>
            </article>

            <!-- Card 3 -->
            <article
              class="flex flex-col rounded-3xl border border-border bg-canvas p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
            >
              <div class="mb-4 flex items-center gap-4">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-ib-purple/10 text-ib-purple"
                >
                  <app-icon name="users" [size]="20" />
                </div>
                <h3 class="text-xl font-bold text-text-primary">Praticiens</h3>
              </div>
              <p class="mb-6 text-text-muted">
                Le carnet d'adresses de vos médecins avec spécialité, téléphone et adresse. Toujours
                à portée de main.
              </p>
              <div class="mt-auto overflow-hidden rounded-xl border border-border/50 bg-surface">
                <img
                  ngSrc="/screen/img_7.webp"
                  alt="Carnet de praticiens"
                  class="w-full object-cover"
                  loading="lazy"
                  height="935" width="1908" />
              </div>
            </article>

            <!-- Card 4 -->
            <article
              class="flex flex-col rounded-3xl border border-border bg-canvas p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
            >
              <div class="mb-4 flex items-center gap-4">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-ib-purple/10 text-ib-purple"
                >
                  <app-icon name="file-text" [size]="20" />
                </div>
                <h3 class="text-xl font-bold text-text-primary">Ordonnances & Docs</h3>
              </div>
              <p class="mb-6 text-text-muted">
                Bilans, certificats, comptes rendus — organisez et retrouvez tous vos documents
                médicaux en un clin d'œil.
              </p>
              <div class="mt-auto overflow-hidden rounded-xl border border-border/50 bg-surface">
                <img
                  ngSrc="/screen/img_3.webp"
                  alt="Documents médicaux"
                  class="w-full object-cover"
                  loading="lazy"
                  height="935" width="1908" />
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- ==========================================
           HIGHLIGHTS / FEATURES
           ========================================== -->
      <section class="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <article
            class="flex flex-col items-center rounded-3xl bg-surface p-8 text-center ring-1 ring-border transition-all hover:ring-ib-green/50 hover:bg-surface-hover"
          >
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-ib-green/10 text-ib-green"
            >
              <app-icon name="shield" [size]="32" />
            </div>
            <h3 class="text-xl font-bold text-text-primary">Sécurisé et privé</h3>
            <p class="mt-4 text-base text-text-muted leading-relaxed">
              Vos données sont chiffrées, protégées par authentification 2FA et connexion sécurisée.
              Rien n'est partagé.
            </p>
          </article>

          <article
            class="flex flex-col items-center rounded-3xl bg-surface p-8 text-center ring-1 ring-border transition-all hover:ring-ib-blue/50 hover:bg-surface-hover"
          >
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-ib-blue/10 text-ib-blue"
            >
              <app-icon name="users" [size]="32" />
            </div>
            <h3 class="text-xl font-bold text-text-primary">Multi-membres</h3>
            <p class="mt-4 text-base text-text-muted leading-relaxed">
              Gérez les budgets et le suivi médical de chaque membre de la famille avec des profils
              individuels colorés.
            </p>
          </article>

          <article
            class="flex flex-col items-center rounded-3xl bg-surface p-8 text-center ring-1 ring-border transition-all hover:ring-ib-purple/50 hover:bg-surface-hover sm:col-span-2 lg:col-span-1"
          >
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-ib-purple/10 text-ib-purple"
            >
              <app-icon name="monitor" [size]="32" />
            </div>
            <h3 class="text-xl font-bold text-text-primary">Responsive et rapide</h3>
            <p class="mt-4 text-base text-text-muted leading-relaxed">
              Interface fluide sur ordinateur, tablette et mobile. Thème sombre/clair inclus, aucune
              installation requise.
            </p>
          </article>
        </div>
      </section>

      <!-- ==========================================
           CTA FINAL
           ========================================== -->
      <section class="relative overflow-hidden border-t border-border bg-surface py-24 sm:py-32">
        <div class="absolute inset-0 bg-linear-to-b from-ib-blue/5 to-transparent"></div>
        <div class="relative mx-auto max-w-3xl px-6 text-center">
          <h2 class="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
            Prêt à simplifier votre quotidien ?
          </h2>
          <p class="mx-auto mt-6 max-w-xl text-xl text-text-muted">
            Créez votre compte en quelques secondes. C'est gratuit, sans engagement, et vos données
            restent les vôtres.
          </p>
          <div class="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <a
              routerLink="/auth/register"
              class="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-ib-blue px-8 py-4 text-base font-bold text-white shadow-lg shadow-ib-blue/25 transition-all hover:bg-ib-blue/90 hover:shadow-xl hover:-translate-y-0.5"
            >
              Créer mon compte gratuitement
            </a>
            <a
              routerLink="/auth/login"
              class="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-transparent px-8 py-4 text-base font-semibold text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              Déjà un compte ? Se connecter
            </a>
          </div>

          <div
            class="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-text-muted"
          >
            <span class="flex items-center gap-2">
              <app-icon name="check" [size]="16" class="text-ib-green" />
              100% Gratuit
            </span>
            <span class="flex items-center gap-2">
              <app-icon name="check" [size]="16" class="text-ib-green" />
              Sans publicité
            </span>
            <span class="flex items-center gap-2">
              <app-icon name="check" [size]="16" class="text-ib-green" />
              Données chiffrées
            </span>
          </div>
        </div>
      </section>
    </main>

    <!-- ==========================================
         FOOTER
         ========================================== -->
    <footer class="border-t border-border bg-canvas py-10 text-center text-sm text-text-muted">
      <div
        class="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between"
      >
        <div class="flex items-center gap-2 font-semibold">
          <app-icon name="chart-line" [size]="16" />
          DashFlow
        </div>
        <p>&copy; {{ currentYear }} DashFlow &mdash; Votre tableau de bord personnel.</p>
      </div>
    </footer>
  `,
})
export class LandingComponent {
  protected readonly currentYear = new Date().getFullYear();
}
