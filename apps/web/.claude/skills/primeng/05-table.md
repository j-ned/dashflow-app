# PrimeNG — Table (p-table)

**Import** : `import { TableModule } from 'primeng/table';`  
**Sélecteur** : `p-table`

## Inputs essentiels

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `value` | `any[]` | — | Données à afficher |
| `dataKey` | `string` | — | **Obligatoire** pour sélection, expansion et virtual scroll |
| `loading` | `boolean` | — | Indicateur de chargement |
| `size` | `'small'\|'large'` | — | Densité du tableau |
| `stripedRows` | `boolean` | — | Lignes alternées |
| `showGridlines` | `boolean` | — | Bordures de grille |
| `tableStyle` | `object` | — | Style `<table>` interne (ex: `{ 'min-width': '50rem' }`) |

## Inputs — tri

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `sortMode` | `'single'\|'multiple'` | `'single'` | |
| `sortField` | `string` | — | Tri initial |
| `sortOrder` | `number` | — | `1` asc, `-1` desc |
| `customSort` | `boolean` | — | Tri via `sortFunction` output |

## Inputs — pagination

| Prop | Type | Notes |
|------|------|-------|
| `paginator` | `boolean` | Active la pagination |
| `rows` | `number` | Lignes par page |
| `first` | `number` | Offset initial |
| `totalRecords` | `number` | Total (lazy) |
| `rowsPerPageOptions` | `any[]` | Ex: `[10, 25, 50]` |
| `paginatorPosition` | `'top'\|'bottom'\|'both'` | |

## Inputs — sélection

| Prop | Type | Notes |
|------|------|-------|
| `selectionMode` | `'single'\|'multiple'` | |
| `selection` | `any` | Valeur sélectionnée (two-way) |
| `metaKeySelection` | `boolean` | Ctrl/Cmd pour désélectionner |

## Inputs — filtres

| Prop | Type | Notes |
|------|------|-------|
| `globalFilterFields` | `string[]` | Champs pour filtre global |
| `filterDelay` | `number` | Délai (ms), défaut 300 |

## Inputs — scroll & virtual scroll

| Prop | Type | Notes |
|------|------|-------|
| `scrollable` | `boolean` | Active le scroll |
| `scrollHeight` | `string` | Ex: `'400px'` ou `'flex'` |
| `virtualScroll` | `boolean` | |
| `virtualScrollItemSize` | `number` | Hauteur ligne en px (**doit correspondre exactement**) |

## Inputs — lazy loading

| Prop | Type | Notes |
|------|------|-------|
| `lazy` | `boolean` | Mode serveur |
| `lazyLoadOnInit` | `boolean` | Charge au démarrage |

## Inputs — colonnes

| Prop | Type | Notes |
|------|------|-------|
| `resizableColumns` | `boolean` | |
| `columnResizeMode` | `'fit'\|'expand'` | |
| `reorderableColumns` | `boolean` | |

## Inputs — persistance

| Prop | Type | Notes |
|------|------|-------|
| `stateKey` | `string` | Clé localStorage/sessionStorage |
| `stateStorage` | `'local'\|'session'` | |

## Outputs

| Event | Description |
|-------|-------------|
| `onRowSelect` / `onRowUnselect` | Sélection ligne |
| `selectionChange` | Two-way binding sélection |
| `onPage` | Changement page |
| `onSort` | Tri |
| `onFilter` | Filtrage |
| `onLazyLoad` | Chargement lazy (`TableLazyLoadEvent`) |
| `onRowExpand` / `onRowCollapse` | Expansion |
| `sortFunction` | Tri custom |
| `firstChange` / `rowsChange` | Two-way pagination |

## Templates ng-template

| `#nom` | Description |
|--------|-------------|
| `#header` | En-tête |
| `#body` | Corps (let-item) |
| `#footer` | Pied de tableau |
| `#caption` | Au-dessus du header |
| `#summary` | En bas |
| `#expandedrow` | Contenu expansé |
| `#groupheader` / `#groupfooter` | Groupement lignes |
| `#emptymessage` | Message si données vides |
| `#loadingbody` | Skeleton pendant lazy |
| `#paginatorleft` / `#paginatorright` | Zone custom paginateur |

---

## Exemples

### Tableau basique

```html
<p-table [value]="products" [tableStyle]="{ 'min-width': '50rem' }">
  <ng-template #header>
    <tr>
      <th>Code</th>
      <th>Nom</th>
      <th>Catégorie</th>
      <th>Prix</th>
    </tr>
  </ng-template>
  <ng-template #body let-product>
    <tr>
      <td>{{ product.code }}</td>
      <td>{{ product.name }}</td>
      <td>{{ product.category }}</td>
      <td>{{ product.price | currency:'EUR' }}</td>
    </tr>
  </ng-template>
  <ng-template #emptymessage>
    <tr><td colspan="4" class="text-center">Aucun résultat.</td></tr>
  </ng-template>
</p-table>
```

### Tri

```html
<p-table [value]="products" sortMode="single">
  <ng-template #header>
    <tr>
      <th pSortableColumn="name">
        Nom <p-sortIcon field="name" />
      </th>
      <th pSortableColumn="price">
        Prix <p-sortIcon field="price" />
      </th>
    </tr>
  </ng-template>
  ...
</p-table>
```

### Pagination

```html
<p-table
  [value]="customers"
  [paginator]="true"
  [rows]="10"
  [rowsPerPageOptions]="[10, 25, 50]"
  [showCurrentPageReport]="true"
  currentPageReportTemplate="{first} - {last} sur {totalRecords}"
>
  ...
</p-table>
```

### Filtre global

```html
<p-table #dt [value]="customers"
         [globalFilterFields]="['name', 'email', 'country']">
  <ng-template #caption>
    <p-iconfield>
      <p-inputicon><i class="pi pi-search"></i></p-inputicon>
      <input pInputText placeholder="Rechercher..."
             (input)="dt.filterGlobal($any($event.target).value, 'contains')" />
    </p-iconfield>
  </ng-template>
  ...
</p-table>
```

### Filtres par colonne

```html
<!-- Filtre texte intégré dans l'en-tête -->
<th>
  <p-columnFilter type="text" field="name" placeholder="Filtrer" [showMenu]="false" />
</th>

<!-- Filtre booléen -->
<th><p-columnFilter type="boolean" field="active" /></th>

<!-- Filtre custom (Select) -->
<th>
  <p-columnFilter field="status" matchMode="equals" [showMenu]="false">
    <ng-template #filter let-value let-filter="filterCallback">
      <p-select [(ngModel)]="value" [options]="statuses"
                placeholder="Tout" [showClear]="true"
                (onChange)="filter($event.value)" />
    </ng-template>
  </p-columnFilter>
</th>
```

### Sélection

```html
<!-- Single -->
<p-table [value]="products" selectionMode="single"
         [(selection)]="selectedProduct" dataKey="id">
  <ng-template #body let-product>
    <tr [pSelectableRow]="product" [pSelectableRowIndex]="$index">
      <td>{{ product.name }}</td>
    </tr>
  </ng-template>
</p-table>

<!-- Multiple avec checkbox -->
<p-table [value]="products" selectionMode="multiple"
         [(selection)]="selectedProducts" dataKey="id">
  <ng-template #header>
    <tr>
      <th style="width: 3rem">
        <p-tableHeaderCheckbox />
      </th>
      <th>Nom</th>
    </tr>
  </ng-template>
  <ng-template #body let-product>
    <tr>
      <td><p-tableCheckbox [value]="product" /></td>
      <td>{{ product.name }}</td>
    </tr>
  </ng-template>
</p-table>
```

### Row Expansion

```html
<p-table [value]="products" dataKey="id">
  <ng-template #body let-product let-expanded="expanded">
    <tr>
      <td>
        <p-button [pRowToggler]="product"
                  [icon]="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                  [text]="true" [rounded]="true"
                  aria-label="Développer la ligne" />
      </td>
      <td>{{ product.name }}</td>
    </tr>
  </ng-template>
  <ng-template #expandedrow let-product>
    <tr>
      <td colspan="5">
        <!-- contenu expansé -->
        <p>{{ product.description }}</p>
      </td>
    </tr>
  </ng-template>
</p-table>
```

### Lazy Loading (serveur)

```typescript
// Composant
protected products = signal<Product[]>([]);
protected totalRecords = signal(0);
protected loading = signal(false);

onLazyLoad(event: TableLazyLoadEvent): void {
  this.loading.set(true);
  this.productService.getProducts({
    first: event.first ?? 0,
    rows: event.rows ?? 10,
    sortField: event.sortField as string,
    sortOrder: event.sortOrder,
    filters: event.filters,
  }).subscribe(result => {
    this.products.set(result.data);
    this.totalRecords.set(result.total);
    this.loading.set(false);
  });
}
```

```html
<p-table
  [value]="products()"
  [lazy]="true"
  (onLazyLoad)="onLazyLoad($event)"
  [totalRecords]="totalRecords()"
  [loading]="loading()"
  [paginator]="true"
  [rows]="10"
  dataKey="id"
>
  ...
  <ng-template #loadingbody>
    <tr style="height: 46px">
      <td *ngFor="let _ of [1,2,3,4]"><p-skeleton /></td>
    </tr>
  </ng-template>
</p-table>
```

### Virtual Scroll (grandes listes locales)

```html
<p-table
  [value]="bigList"
  [scrollable]="true"
  scrollHeight="400px"
  [virtualScroll]="true"
  [virtualScrollItemSize]="46"
  dataKey="id"
>
  <ng-template #body let-item>
    <tr style="height: 46px">
      <td>{{ item.name }}</td>
    </tr>
  </ng-template>
</p-table>
```

## Gotchas

- `dataKey` est **indispensable** pour la sélection, l'expansion et le virtual scroll.
- `virtualScrollItemSize` doit correspondre **exactement** à la hauteur CSS réelle des `<tr>` (mettre `style="height:46px"` en dur).
- Mode lazy : `event.forceUpdate()` peut être nécessaire après mise à jour des données pour déclencher la détection de changement.
- Tri multi : nécessite `sortMode="multiple"` et maintien de la touche Méta.
- `stateKey` persiste l'état (tri, filtres, pagination) dans le localStorage — penser à vider si le schéma change.
