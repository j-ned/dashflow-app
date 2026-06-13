import { Component, ChangeDetectionStrategy, inject, viewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '@features/auth/domain/auth.store';
import { EntitlementStore } from '@core/entitlements/entitlement.store';
import { Icon } from '@shared/components/icon/icon';
import { CommandPalette } from '@shared/components/command-palette/command-palette';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import { ThemeStore } from '@core/services/theme.store';
import { LocaleStore } from '@core/services/locale.store';
import { DemoBanner } from '../components/demo-banner/demo-banner';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col h-screen overflow-hidden' },
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    Icon,
    CommandPalette,
    ConfirmDialog,
    DemoBanner,
  ],
  template: `
    <header class="header">
      <a routerLink="/budget" class="logo-link" aria-label="Accueil DashFlow">
        <app-icon name="dashflow-logo" size="22" />
        <span class="hidden sm:inline">DashFlow</span>
      </a>

      <nav
        aria-label="Espaces"
        class="hidden sm:flex items-center bg-canvas p-1 rounded-lg border border-border"
      >
        <a routerLink="/budget" routerLinkActive="tab--active-budget" class="tab">
          <app-icon name="wallet" size="15" /> <span class="hidden sm:inline">Budget</span>
        </a>
        <a routerLink="/medical" routerLinkActive="tab--active-medical" class="tab">
          <app-icon name="heart-pulse" size="15" /> <span class="hidden sm:inline">Médical</span>
        </a>
        @if (auth.isAdmin()) {
          <a
            routerLink="/admin"
            routerLinkActive="tab--active-budget"
            class="tab"
            data-testid="nav-admin"
          >
            <app-icon name="shield" size="15" />
            <span class="hidden sm:inline">{{ 'admin.nav' | transloco }}</span>
          </a>
        }
      </nav>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="header-btn hidden sm:inline-flex"
          (click)="commandPalette()?.open()"
        >
          <app-icon name="search" size="14" />
          <span class="text-text-muted">{{ 'common.search' | transloco }}</span>
          <kbd
            class="ml-3 rounded border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-mono text-text-muted"
            >{{ kbdShortcut }}</kbd
          >
        </button>

        <!-- Mobile : la recherche complète (avec kbd) est masquée < sm ; on garde un accès via une icône. -->
        <button
          type="button"
          class="icon-btn sm:hidden"
          (click)="commandPalette()?.open()"
          [attr.aria-label]="'common.search' | transloco"
        >
          <app-icon name="search" size="18" />
        </button>

        <button
          type="button"
          class="icon-btn font-mono text-[11px] font-semibold tracking-tight uppercase"
          (click)="locale.toggle()"
          [attr.aria-label]="
            (locale.isFrench() ? 'locale.toEnglish' : 'locale.toFrench') | transloco
          "
        >
          {{ locale.isFrench() ? 'EN' : 'FR' }}
        </button>

        <button
          type="button"
          class="icon-btn"
          (click)="theme.toggle()"
          [attr.aria-label]="(theme.isDark() ? 'theme.toLight' : 'theme.toDark') | transloco"
        >
          <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" size="18" />
        </button>

        <!-- Avatar masqué < sm : la nav du bas porte l'accès aux Réglages sur mobile (anti-doublon). -->
        <a
          routerLink="/settings"
          class="hidden sm:block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
          [attr.aria-label]="'common.settings' | transloco"
        >
          @if (auth.avatarUrl()) {
            <!-- eslint-disable @angular-eslint/template/prefer-ngsrc -- avatar distant de dimensions intrinsèques inconnues, sans IMAGE_LOADER : NgOptimizedImage inadapté -->
            <img
              [src]="auth.avatarUrl()"
              [alt]="auth.displayName()"
              class="w-8 h-8 rounded-full object-cover border border-border"
            />
            <!-- eslint-enable @angular-eslint/template/prefer-ngsrc -->
          } @else {
            <div
              class="w-8 h-8 rounded-full bg-ib-purple border border-border flex items-center justify-center text-xs font-semibold text-canvas"
            >
              {{ auth.userInitial() }}
            </div>
          }
        </a>
      </div>
    </header>

    <app-demo-banner />

    <main class="flex-1 flex min-h-0">
      <router-outlet />
    </main>

    <!-- Barre d'onglets mobile (thumb-friendly). Masquée ≥ sm via media query CSS (le display
         encapsulé bat le sm:hidden de Tailwind, d'où le masquage géré ici). -->
    <nav aria-label="Navigation principale" class="bottom-nav">
      <a routerLink="/budget" routerLinkActive="bottom-tab--active-budget" class="bottom-tab">
        <app-icon name="wallet" size="20" />
        <span>Budget</span>
      </a>
      <a routerLink="/medical" routerLinkActive="bottom-tab--active-medical" class="bottom-tab">
        <app-icon name="heart-pulse" size="20" />
        <span>Médical</span>
      </a>
      @if (auth.isAdmin()) {
        <a
          routerLink="/admin"
          routerLinkActive="bottom-tab--active-budget"
          class="bottom-tab"
          data-testid="bottom-nav-admin"
        >
          <app-icon name="shield" size="20" />
          <span>{{ 'admin.nav' | transloco }}</span>
        </a>
      }
      <a routerLink="/settings" routerLinkActive="bottom-tab--active-budget" class="bottom-tab">
        <app-icon name="settings" size="20" />
        <span>{{ 'common.settings' | transloco }}</span>
      </a>
    </nav>

    @defer (on idle) {
      <app-command-palette #cmdPalette />
      <app-confirm-dialog />
    }
  `,
  styles: `
    .logo-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      font-size: 1.125rem;
      color: var(--text-primary);
      text-decoration: none;
      user-select: none;
      border-radius: 0.5rem;
      padding: 0.25rem 0.5rem;
      transition: opacity 150ms;
    }

    .logo-link:hover {
      opacity: 0.8;
    }

    .logo-link app-icon {
      color: var(--color-ib-cyan);
    }

    .header {
      height: 3.5rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg-surface);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-inline: 1.25rem;
      z-index: 10;
      flex-shrink: 0;
    }

    .tab {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      min-height: 36px;
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-muted);
      transition:
        color 150ms,
        background-color 150ms;
    }

    .tab:hover {
      color: var(--text-primary);
    }

    .tab--active-budget {
      color: var(--color-ib-blue);
      background: var(--color-ib-blue-10);
    }

    .tab--active-budget:hover {
      color: var(--color-ib-blue);
    }

    .tab--active-medical {
      color: var(--color-ib-purple);
      background: var(--color-ib-purple-10);
    }

    .tab--active-medical:hover {
      color: var(--color-ib-purple);
    }

    /* Mobile : onglets en icônes seules (labels masqués via .hidden sm:inline), padding resserré,
       et cibles tactiles agrandies (≈40px, vs 32px par défaut) pour le confort au doigt. */
    @media (max-width: 640px) {
      .header {
        padding-inline: 0.75rem;
      }
      .tab {
        padding: 0.5rem 0.625rem;
        min-height: 40px;
      }
      .icon-btn {
        width: 2.5rem;
        height: 2.5rem;
      }
    }

    .header-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: var(--bg-canvas);
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
      color: var(--text-muted);
      cursor: pointer;
      transition:
        border-color 150ms,
        color 150ms;
    }

    .header-btn:hover {
      border-color: var(--text-muted);
      color: var(--text-primary);
    }

    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: var(--bg-canvas);
      color: var(--text-muted);
      cursor: pointer;
      transition:
        border-color 150ms,
        color 150ms,
        background-color 150ms;
    }

    .icon-btn:hover {
      border-color: var(--text-muted);
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    /* Barre d'onglets mobile : enfant flex du shell (pas de fixed → pas de chevauchement du contenu). */
    .bottom-nav {
      display: flex;
      align-items: stretch;
      flex-shrink: 0;
      border-top: 1px solid var(--border);
      background: var(--bg-surface);
      padding-bottom: env(safe-area-inset-bottom);
    }

    .bottom-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.125rem;
      min-height: 56px;
      padding: 0.375rem 0;
      font-size: 0.625rem;
      font-weight: 500;
      color: var(--text-muted);
      transition: color 150ms;
    }

    .bottom-tab:hover {
      color: var(--text-primary);
    }

    .bottom-tab--active-budget {
      color: var(--color-ib-blue);
    }

    .bottom-tab--active-medical {
      color: var(--color-ib-purple);
    }

    /* Desktop : la nav du haut prend le relais. On masque ici (et non via sm:hidden) car le
       display:flex encapsulé par Angular bat la spécificité de l'utilitaire Tailwind. */
    @media (min-width: 640px) {
      .bottom-nav {
        display: none;
      }
    }
  `,
})
export class AppShell {
  protected readonly auth = inject(AuthStore);
  protected readonly theme = inject(ThemeStore);
  protected readonly locale = inject(LocaleStore);
  private readonly entitlements = inject(EntitlementStore);
  protected readonly commandPalette = viewChild<CommandPalette>('cmdPalette');
  protected readonly kbdShortcut = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? '⌘K'
    : 'Ctrl K';

  constructor() {
    void this.entitlements.load();
  }
}
