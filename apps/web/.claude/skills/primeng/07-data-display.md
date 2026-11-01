# PrimeNG — Affichage de données

## Paginator

**Import** : `import { PaginatorModule } from 'primeng/paginator';`  
**Sélecteur** : `p-paginator`

### Inputs

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `totalRecords` | `number` | `0` | Nombre total d'enregistrements |
| `rows` | `number` | `0` | Lignes par page |
| `first` | `number` | `0` | Offset (pas un numéro de page) |
| `rowsPerPageOptions` | `any[]` | — | Ex: `[10, 25, 50]` ou `[{label:'Tous', value:total}]` |
| `pageLinkSize` | `number` | `5` | Liens de pages visibles |
| `alwaysShow` | `boolean` | `true` | Masquer si une seule page |
| `showCurrentPageReport` | `boolean` | — | Affiche "X de Y" |
| `currentPageReportTemplate` | `string` | `'{currentPage} of {totalPages}'` | |
| `showFirstLastIcon` | `boolean` | `true` | |
| `showJumpToPageDropdown` | `boolean` | — | |
| `showJumpToPageInput` | `boolean` | — | |

### Output

| Event | Type |
|-------|------|
| `onPageChange` | `PaginatorState` |

### PaginatorState

```typescript
{
  page: number;        // 0-based
  first: number;       // offset = page * rows
  rows: number;
  pageCount: number;
  totalRecords?: number;
}
```

```html
<p-paginator
  [totalRecords]="totalRecords()"
  [rows]="pageSize"
  [first]="first"
  [rowsPerPageOptions]="[10, 25, 50]"
  [alwaysShow]="false"
  [showCurrentPageReport]="true"
  currentPageReportTemplate="Page {currentPage} sur {totalPages} — {totalRecords} résultats"
  (onPageChange)="onPageChange($event)"
/>
```

```typescript
protected first = 0;
protected pageSize = 10;

onPageChange(event: PaginatorState): void {
  this.first = event.first!;
  this.pageSize = event.rows!;
  this.loadData(event.first!, event.rows!);
}
```

> ⚠️ `first` est un **offset**, pas un numéro de page : page 2 avec 25 lignes → `first = 25`.

---

## Tag

**Import** : `import { TagModule } from 'primeng/tag';`  
**Sélecteur** : `p-tag`

| Prop | Type | Notes |
|------|------|-------|
| `value` | `string` | Texte |
| `severity` | `'success'\|'info'\|'warn'\|'danger'\|'secondary'\|'contrast'` | |
| `icon` | `string` | Classe icône |
| `rounded` | `boolean` | Coins arrondis |

```html
<!-- Severities -->
<p-tag value="Actif"    severity="success" />
<p-tag value="En cours" severity="info" />
<p-tag value="Attention" severity="warn" />
<p-tag value="Bloqué"   severity="danger" />
<p-tag value="Inactif"  severity="secondary" />

<!-- Avec icône -->
<p-tag value="Vérifié"  severity="success" icon="pi pi-check" />
<p-tag value="Urgent"   severity="danger"  icon="pi pi-exclamation-circle" />

<!-- Arrondi (pill) -->
<p-tag value="Beta" severity="info" [rounded]="true" />

<!-- Dans une cellule de table -->
<td>
  <p-tag [value]="getStatusLabel(product.status)"
         [severity]="getStatusSeverity(product.status)" />
</td>
```

```typescript
getStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' {
  const map: Record<string, 'success' | 'warn' | 'danger' | 'secondary'> = {
    ACTIVE:   'success',
    PENDING:  'warn',
    INACTIVE: 'danger',
    DRAFT:    'secondary',
  };
  return map[status] ?? 'secondary';
}
```

---

## Badge

**Import** : `import { BadgeModule } from 'primeng/badge';`

### Composant `p-badge`

| Input | Type | Notes |
|-------|------|-------|
| `value` | `string\|number\|null` | Contenu |
| `severity` | sévérité | |
| `badgeSize` | `'small'\|'large'\|'xlarge'` | |
| `badgeDisabled` | `boolean` | |

### Directive `[pBadge]` (superposée)

| Input | Type | Notes |
|-------|------|-------|
| `value` | `string\|number` | |
| `severity` | `string` | |
| `badgeSize` | taille | |
| `badgeDisabled` | `boolean` | |

```html
<!-- Composant standalone -->
<p-badge value="5" />
<p-badge value="99+" severity="danger" badgeSize="large" />
<p-badge severity="success" />  <!-- point sans valeur -->

<!-- Directive sur icône -->
<i class="pi pi-bell" pBadge value="3" severity="danger"></i>

<!-- Directive sur bouton -->
<p-button label="Notifications" pBadge value="8" severity="warn" />

<!-- Dans un menu -->
<span class="flex items-center gap-2">
  Messages
  <p-badge value="12" severity="danger" />
</span>
```

> ⚠️ La directive `[pBadge]` positionne le badge en `absolute` — le parent doit avoir `position: relative`.  
> Utiliser `badgeSize` et non `size` (déprécié).

---

## Chip

**Import** : `import { ChipModule } from 'primeng/chip';`  
**Sélecteur** : `p-chip`

| Prop | Type | Notes |
|------|------|-------|
| `label` | `string` | Texte |
| `icon` | `string` | Classe icône |
| `image` | `string` | URL avatar |
| `alt` | `string` | Alt de l'image (accessibilité) |
| `removable` | `boolean` | Icône de suppression |
| `removeIcon` | `string` | Icône custom suppression |
| `disabled` | `boolean` | |

| Event | Payload |
|-------|---------|
| `onRemove` | `MouseEvent` |

```html
<!-- Basique -->
<p-chip label="Angular" icon="pi pi-code" />

<!-- Avec avatar -->
<p-chip image="/avatars/user.png" alt="John" label="John Doe" />

<!-- Supprimable -->
<p-chip label="TypeScript" [removable]="true" (onRemove)="removeTag('TypeScript')" />

<!-- Liste dynamique -->
@for (tag of tags(); track tag) {
  <p-chip [label]="tag" [removable]="true" (onRemove)="removeTag(tag)" />
}
```

> Pour une liste de chips avec saisie (type input + chips), utiliser `AutoComplete` en mode `multiple`.

---

## ProgressBar

**Import** : `import { ProgressBarModule } from 'primeng/progressbar';`  
**Sélecteur** : `p-progressbar`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `value` | `number` | — | Progression 0-100 |
| `mode` | `'determinate'\|'indeterminate'` | `'determinate'` | `indeterminate` = animation infinie |
| `showValue` | `boolean` | `true` | Affiche le % dans la barre |
| `unit` | `string` | `'%'` | Unité affichée |
| `color` | `string` | — | Couleur CSS custom |

```html
<!-- Déterminé -->
<p-progressbar [value]="uploadProgress()" />

<!-- Sans valeur affichée -->
<p-progressbar [value]="progress()" [showValue]="false" />

<!-- Indéterminé (loading) -->
<p-progressbar mode="indeterminate" [style]="{ height: '4px' }" />

<!-- Contenu custom -->
<p-progressbar [value]="progress()">
  <ng-template #content let-value>
    <span class="font-bold">{{ value }}Mo / 100Mo</span>
  </ng-template>
</p-progressbar>

<!-- Conditionnel -->
@if (isLoading()) {
  <p-progressbar mode="indeterminate" [style]="{ height: '3px' }" />
}
```

---

## Skeleton

**Import** : `import { SkeletonModule } from 'primeng/skeleton';`  
**Sélecteur** : `p-skeleton`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `shape` | `string` | `'rectangle'` | `'circle'` pour avatars |
| `animation` | `string` | `'wave'` | `'none'` pour désactiver |
| `width` | `string` | `'100%'` | |
| `height` | `string` | `'1rem'` | |
| `size` | `string` | — | Raccourci width+height (carrés/cercles) |
| `borderRadius` | `string` | — | |

```html
<!-- Lignes de texte -->
<p-skeleton width="10rem" height="1rem" />
<p-skeleton height="1rem" />
<p-skeleton width="75%" height="1rem" />

<!-- Avatar circulaire -->
<p-skeleton shape="circle" size="4rem" />

<!-- Card skeleton -->
<div class="flex gap-3 items-start">
  <p-skeleton shape="circle" size="3rem" />
  <div class="flex flex-col gap-2 flex-1">
    <p-skeleton width="50%" height="1rem" />
    <p-skeleton height="1rem" />
    <p-skeleton width="75%" height="1rem" />
  </div>
</div>

<!-- Tableau skeleton -->
@for (_ of [1,2,3,4,5]; track $index) {
  <tr>
    <td><p-skeleton height="2rem" /></td>
    <td><p-skeleton height="2rem" /></td>
    <td><p-skeleton width="60%" height="2rem" /></td>
  </tr>
}

<!-- Conditionnel (pattern recommandé) -->
@if (isLoading()) {
  <div class="flex flex-col gap-3">
    @for (_ of [1,2,3]; track $index) {
      <p-skeleton height="3rem" borderRadius="0.75rem" />
    }
  </div>
} @else {
  <!-- contenu réel -->
}
```

### Bonnes pratiques Skeleton

- **Reproduire la forme exacte** du contenu final — même hauteur, même disposition.
- `animation="none"` pour améliorer les perfs sur des listes longues.
- `size="4rem"` = raccourci pour `width="4rem" height="4rem"` — idéal pour les cercles.
- Pas de valeur accessible dans un skeleton — les lecteurs d'écran ignorent le composant (rôle `presentation`).
