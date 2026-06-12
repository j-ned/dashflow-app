# Angular Aria — Composants headless accessibles — Reference

## Concept

`@angular/aria` est une librairie de composants **headless** (sans style) pour Angular. Les composants gerent automatiquement les attributs ARIA, le focus, la navigation clavier — les developpeurs fournissent **tout le styling**.

## Installation

```bash
npm install @angular/aria
```

## Composants disponibles

| Composant | Description | Pattern ARIA |
|-----------|-------------|-------------|
| `Accordion` | Panneaux depliables | `role="region"`, `aria-expanded` |
| `Listbox` | Liste selectionnable | `role="listbox"`, `role="option"` |
| `Combobox` | Champ texte + liste deroulante | `role="combobox"`, `aria-autocomplete` |
| `Select` | Menu deroulant de selection | `role="listbox"` |
| `Menu` | Menu d'actions | `role="menu"`, `role="menuitem"` |
| `Tabs` | Onglets | `role="tablist"`, `role="tab"`, `role="tabpanel"` |
| `Toolbar` | Barre d'outils | `role="toolbar"` |
| `Tree` | Arborescence | `role="tree"`, `role="treeitem"` |
| `Grid` | Grille navigable | `role="grid"`, `role="row"`, `role="gridcell"` |

## Principes

### Headless = pas de style

```typescript
import { CdkAccordion, CdkAccordionItem } from '@angular/aria';

@Component({
  selector: 'app-faq',
  imports: [CdkAccordion, CdkAccordionItem],
  // TOUT le style est fourni par le developpeur
  styles: `
    .accordion-header {
      cursor: pointer;
      padding: 1rem;
      border: 1px solid #ddd;
      background: #f9f9f9;
    }
    .accordion-header[aria-expanded="true"] {
      background: #e0e0e0;
    }
    .accordion-body {
      padding: 1rem;
      border: 1px solid #ddd;
      border-top: none;
    }
  `,
  template: `
    <div cdkAccordion>
      @for (item of items(); track item.id) {
        <div cdkAccordionItem #accordionItem="cdkAccordionItem">
          <button
            class="accordion-header"
            (click)="accordionItem.toggle()"
            [attr.aria-expanded]="accordionItem.expanded"
          >
            {{ item.title }}
          </button>
          @if (accordionItem.expanded) {
            <div class="accordion-body">
              {{ item.content }}
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class FaqComponent {
  readonly items = input.required<{ id: number; title: string; content: string }[]>();
}
```

### Attributs ARIA automatiques

Les composants `@angular/aria` gerent automatiquement :

- `role` — role ARIA du composant
- `aria-expanded` — etat ouvert/ferme
- `aria-selected` — etat selectionne
- `aria-disabled` — etat desactive
- `aria-activedescendant` — element actif dans une liste
- `tabindex` — ordre de tabulation
- Navigation clavier (fleches, Entree, Echap, Home, End)

### Exemple : Tabs

```typescript
import { CdkTabGroup, CdkTab, CdkTabPanel } from '@angular/aria';

@Component({
  selector: 'app-settings',
  imports: [CdkTabGroup, CdkTab, CdkTabPanel],
  styles: `
    .tab-list {
      display: flex;
      border-bottom: 2px solid #ddd;
    }
    .tab {
      padding: 0.75rem 1.5rem;
      border: none;
      background: none;
      cursor: pointer;
    }
    .tab[aria-selected="true"] {
      border-bottom: 2px solid blue;
      color: blue;
    }
    .tab-panel {
      padding: 1rem;
    }
  `,
  template: `
    <div cdkTabGroup>
      <div class="tab-list" role="tablist">
        <button cdkTab class="tab">General</button>
        <button cdkTab class="tab">Securite</button>
        <button cdkTab class="tab">Notifications</button>
      </div>
      <div cdkTabPanel class="tab-panel">Contenu general...</div>
      <div cdkTabPanel class="tab-panel">Contenu securite...</div>
      <div cdkTabPanel class="tab-panel">Contenu notifications...</div>
    </div>
  `,
})
export class SettingsComponent {}
```

### Exemple : Listbox

```typescript
import { CdkListbox, CdkOption } from '@angular/aria';

@Component({
  selector: 'app-color-picker',
  imports: [CdkListbox, CdkOption],
  styles: `
    .listbox { list-style: none; padding: 0; border: 1px solid #ddd; }
    .option { padding: 0.5rem 1rem; cursor: pointer; }
    .option:hover { background: #f0f0f0; }
    .option[aria-selected="true"] { background: #e0e7ff; color: #3b82f6; }
  `,
  template: `
    <ul cdkListbox class="listbox" (cdkListboxChange)="onSelect($event)">
      @for (color of colors(); track color) {
        <li [cdkOption]="color" class="option">{{ color }}</li>
      }
    </ul>
    <p>Selection : {{ selected() }}</p>
  `,
})
export class ColorPickerComponent {
  readonly colors = input<string[]>(['Rouge', 'Vert', 'Bleu', 'Jaune']);
  protected readonly selected = signal('');

  protected onSelect(value: string) {
    this.selected.set(value);
  }
}
```

## Quand utiliser @angular/aria

| Situation | Recommandation |
|-----------|---------------|
| Design system custom | Oui — controle total du style |
| Prototype rapide | Non — utiliser Angular Material |
| Accessibilite critique | Oui — ARIA gere automatiquement |
| Integration Tailwind CSS | Oui — parfait pour utility-first |
| Application sans design system | Angular Material ou PrimeNG |
