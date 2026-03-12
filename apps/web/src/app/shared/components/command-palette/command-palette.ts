import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Icon, type IconName } from '@shared/components/icon/icon';

// ── Types ──

type CommandCategory = 'navigation' | 'budget' | 'medical' | 'action';

type Command = {
  readonly id: string;
  readonly label: string;
  readonly category: CommandCategory;
  readonly icon: IconName;
  readonly keywords: string;
  readonly action: () => void;
};

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: 'Navigation',
  budget: 'Budget',
  medical: 'Medical',
  action: 'Actions rapides',
};

const CATEGORY_ORDER: CommandCategory[] = ['navigation', 'budget', 'medical', 'action'];

// ── Fuzzy search ──

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t.includes(q)) return 100 + (q.length / t.length) * 50;

  let score = 0;
  let qi = 0;
  let consecutive = 0;
  let lastMatchIdx = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      consecutive = ti === lastMatchIdx + 1 ? consecutive + 1 : 0;
      score += consecutive * 5;
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') score += 8;
      lastMatchIdx = ti;
      qi++;
    }
  }

  return qi === q.length ? score : 0;
}

// ── Component ──

@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'contents' },
  template: `
    <dialog #dialog
            class="command-palette"
            (click)="onBackdropClick($event)"
            (close)="onDialogClose()">
      <div class="command-panel" (click)="$event.stopPropagation()">

        <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
          <app-icon name="search" size="18" class="text-text-muted shrink-0" />
          <input #searchInput
                 type="text"
                 class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                 placeholder="Rechercher une page, une action..."
                 [value]="query()"
                 (input)="onInput($event)"
                 (keydown)="onKeydown($event)"
                 autocomplete="off"
                 spellcheck="false" />
          <kbd class="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-raised px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
            ESC
          </kbd>
        </div>

        <div class="max-h-[min(60vh,400px)] overflow-y-auto overscroll-contain p-2">
          @if (grouped().length > 0) {
            @for (group of grouped(); track group.category) {
              <div class="mb-1 last:mb-0">
                <p class="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {{ group.label }}
                </p>
                @for (cmd of group.commands; track cmd.id) {
                  <button type="button"
                          [attr.data-cmd-id]="cmd.id"
                          class="command-item"
                          [class.command-item--active]="cmd.id === activeId()"
                          (mouseenter)="activeId.set(cmd.id)"
                          (click)="executeCommand(cmd)">
                    <app-icon [name]="cmd.icon" size="16" class="shrink-0" />
                    <span class="truncate">{{ cmd.label }}</span>
                  </button>
                }
              </div>
            }
          } @else {
            <div class="py-8 text-center text-sm text-text-muted">
              Aucun resultat pour « {{ query() }} »
            </div>
          }
        </div>

        <div class="flex items-center justify-between gap-4 border-t border-border px-4 py-2 text-[10px] text-text-muted">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1">
              <kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> naviguer
            </span>
            <span class="inline-flex items-center gap-1">
              <kbd class="kbd">↵</kbd> ouvrir
            </span>
          </div>
          <span class="inline-flex items-center gap-1">
            <kbd class="kbd">esc</kbd> fermer
          </span>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    dialog.command-palette {
      background: transparent;
      border: none;
      padding: 0;
      max-width: 100vw;
      max-height: 100vh;
      overflow: visible;
      margin: 15vh auto auto;
    }

    dialog.command-palette::backdrop {
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(6px);
    }

    dialog.command-palette[open] {
      animation: cp-fade-in 150ms ease-out;
    }

    dialog.command-palette[open]::backdrop {
      animation: cp-backdrop-in 150ms ease-out;
    }

    @keyframes cp-fade-in {
      from { opacity: 0; transform: scale(0.96) translateY(-8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    @keyframes cp-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .command-panel {
      width: min(540px, 90vw);
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }

    .command-item {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: 100%;
      padding: 0.5rem 0.625rem;
      border-radius: 8px;
      font-size: 0.8125rem;
      color: var(--text-primary);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: background-color 100ms ease;
      text-align: left;
    }

    .command-item:hover,
    .command-item--active {
      background: var(--bg-hover);
    }

    .command-item--active {
      box-shadow: inset 2px 0 0 var(--color-ib-blue);
    }

    .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      font-family: var(--font-mono), monospace;
      font-size: 10px;
      line-height: 1;
    }
  `,
})
export class CommandPalette {
  private readonly router = inject(Router);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly searchInputRef = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly query = signal('');
  protected readonly activeId = signal('');
  private readonly _open = signal(false);

  // ── Commands registry ──

  private readonly commands: Command[] = [
    { id: 'nav-budget',       label: 'Vue globale — Budget',     category: 'navigation', icon: 'layout-dashboard', keywords: 'dashboard budget vue globale tableau de bord',         action: () => this.go('/budget/dashboard') },
    { id: 'nav-envelopes',    label: 'Enveloppes',               category: 'budget',     icon: 'mail',             keywords: 'enveloppes epargne savings',                         action: () => this.go('/budget/envelopes') },
    { id: 'nav-loans',        label: 'Prets & Dettes',           category: 'budget',     icon: 'banknote',         keywords: 'prets dettes loans emprunt rembourser',              action: () => this.go('/budget/loans') },
    { id: 'nav-account',      label: 'Compte bancaire',          category: 'budget',     icon: 'wallet',           keywords: 'compte banque bank account solde',                   action: () => this.go('/budget/account') },
    { id: 'nav-archives',     label: 'Archives salaires',        category: 'budget',     icon: 'folder',           keywords: 'archives salaires historique revenus fiches de paie', action: () => this.go('/budget/archives') },
    { id: 'nav-analytics',    label: 'Statistiques & Previsions', category: 'budget',    icon: 'trending-up',      keywords: 'statistiques analytics graphiques charts previsions forecast projection', action: () => this.go('/budget/analytics') },

    { id: 'nav-medical',      label: 'Vue globale — Medical',    category: 'navigation', icon: 'layout-dashboard', keywords: 'dashboard medical vue globale sante',                action: () => this.go('/medical/dashboard') },
    { id: 'nav-patients',     label: 'Patients',                 category: 'medical',    icon: 'users',            keywords: 'patients famille membres enfants',                   action: () => this.go('/medical/patients') },
    { id: 'nav-practitioners', label: 'Praticiens',              category: 'medical',    icon: 'stethoscope',      keywords: 'praticiens medecins docteur dentiste specialiste',    action: () => this.go('/medical/practitioners') },
    { id: 'nav-appointments', label: 'Rendez-vous',              category: 'medical',    icon: 'calendar',         keywords: 'rendez-vous rdv consultation visite',                action: () => this.go('/medical/appointments') },
    { id: 'nav-prescriptions', label: 'Ordonnances',             category: 'medical',    icon: 'file-text',        keywords: 'ordonnances prescriptions documents',                action: () => this.go('/medical/prescriptions') },
    { id: 'nav-medications',  label: 'Medicaments',              category: 'medical',    icon: 'pill',             keywords: 'medicaments traitements stock pilules',              action: () => this.go('/medical/medications') },
    { id: 'nav-documents',    label: 'Documents medicaux',       category: 'medical',    icon: 'folder',           keywords: 'documents fichiers comptes rendus bilans',           action: () => this.go('/medical/documents') },
    { id: 'nav-reminders',    label: 'Alertes & Rappels',        category: 'medical',    icon: 'bell',             keywords: 'alertes rappels notifications reminders',            action: () => this.go('/medical/reminders') },

    { id: 'nav-settings',     label: 'Parametres',               category: 'navigation', icon: 'settings',         keywords: 'parametres reglages profil compte settings',         action: () => this.go('/settings') },

    { id: 'act-logout',       label: 'Deconnexion',              category: 'action',     icon: 'log-out',          keywords: 'deconnexion logout quitter sortir',                  action: () => this.go('/auth/login') },
  ];

  // ── Filtered + grouped ──

  private readonly filtered = computed(() => {
    const q = this.query().trim();
    if (!q) return this.commands;

    return this.commands
      .map(cmd => ({ cmd, score: fuzzyScore(q, `${cmd.label} ${cmd.keywords}`) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.cmd);
  });

  protected readonly grouped = computed(() => {
    const cmds = this.filtered();
    const map = new Map<CommandCategory, Command[]>();

    for (const cmd of cmds) {
      const list = map.get(cmd.category) ?? [];
      list.push(cmd);
      map.set(cmd.category, list);
    }

    return CATEGORY_ORDER
      .filter(cat => map.has(cat))
      .map(cat => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        commands: map.get(cat)!,
      }));
  });

  private readonly flatFiltered = computed(() => this.filtered());

  // ── Keyboard shortcut ──

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this._open() ? this.close() : this.open();
    }
  }

  // ── Open / Close ──

  open() {
    this.query.set('');
    this.activeId.set(this.commands[0]?.id ?? '');
    this._open.set(true);
    this.dialogRef().nativeElement.showModal();
    requestAnimationFrame(() => this.searchInputRef().nativeElement.focus());
  }

  close() {
    this._open.set(false);
    this.dialogRef().nativeElement.close();
  }

  protected onDialogClose() {
    this._open.set(false);
  }

  protected onBackdropClick(e: MouseEvent) {
    if (e.target === this.dialogRef().nativeElement) this.close();
  }

  // ── Input ──

  protected onInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.query.set(value);
    const first = this.flatFiltered()[0];
    if (first) this.activeId.set(first.id);
  }

  // ── Keyboard navigation ──

  protected onKeydown(e: KeyboardEvent) {
    const list = this.flatFiltered();
    if (!list.length) return;

    const currentIdx = list.findIndex(c => c.id === this.activeId());

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = (currentIdx + 1) % list.length;
        this.activeId.set(list[next].id);
        this.scrollToActive(list[next].id);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = (currentIdx - 1 + list.length) % list.length;
        this.activeId.set(list[prev].id);
        this.scrollToActive(list[prev].id);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const active = list.find(c => c.id === this.activeId());
        if (active) this.executeCommand(active);
        break;
      }
      case 'Escape': {
        e.preventDefault();
        this.close();
        break;
      }
    }
  }

  // ── Execute ──

  protected executeCommand(cmd: Command) {
    this.close();
    cmd.action();
  }

  // ── Helpers ──

  private go(path: string) {
    this.router.navigateByUrl(path);
  }

  private scrollToActive(id: string) {
    requestAnimationFrame(() => {
      const el = this.dialogRef().nativeElement.querySelector(`[data-cmd-id="${id}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  }
}
