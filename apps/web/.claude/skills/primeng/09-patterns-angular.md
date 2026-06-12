# PrimeNG — Patterns Angular (signals, reactive forms, clean archi)

## Intégration Signals

### Loading state avec signal

```typescript
@Component({
  imports: [TableModule, SkeletonModule, ButtonModule],
  template: `
    @if (loading()) {
      <p-progressbar mode="indeterminate" [style]="{ height: '3px' }" />
    }
    <p-table [value]="products()" [loading]="loading()" dataKey="id">
      ...
    </p-table>
  `,
})
export class ProductListComponent {
  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(false);

  private readonly productService = inject(ProductService);

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.productService.getAll().subscribe({
      next: data => {
        this.products.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
```

### Dialog avec signal

```typescript
@Component({
  imports: [DialogModule, ButtonModule],
  template: `
    <p-button label="Ouvrir" (onClick)="openDialog()" />

    <p-dialog
      header="Modifier"
      [modal]="true"
      [(visible)]="showDialog"
      [style]="{ width: '28rem' }"
      [draggable]="false"
    >
      <!-- contenu -->
      <ng-template #footer>
        <p-button label="Annuler" severity="secondary" variant="outlined"
                  (onClick)="closeDialog()" />
        <p-button label="Enregistrer" [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class MyComponent {
  protected showDialog = false;
  protected readonly saving = signal(false);

  openDialog(): void  { this.showDialog = true; }
  closeDialog(): void { this.showDialog = false; }

  save(): void {
    this.saving.set(true);
    this.service.save().subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.messageService.add({ severity: 'success', summary: 'Enregistré' });
      },
      error: () => this.saving.set(false),
    });
  }
}
```

---

## Reactive Forms + PrimeNG

### Formulaire complet typé

```typescript
type UserForm = {
  firstName:  FormControl<string>;
  lastName:   FormControl<string>;
  email:      FormControl<string>;
  role:       FormControl<string | null>;
  birthDate:  FormControl<Date | null>;
  skills:     FormControl<string[]>;
  active:     FormControl<boolean>;
};

@Component({
  imports: [
    ReactiveFormsModule,
    InputTextModule, FloatLabelModule,
    SelectModule, MultiSelectModule,
    DatePickerModule, CheckboxModule,
    ButtonModule, MessageModule,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">

      <!-- InputText avec FloatLabel -->
      <div class="field">
        <p-floatlabel>
          <input pInputText id="firstName" formControlName="firstName"
                 [invalid]="isInvalid('firstName')" />
          <label for="firstName">Prénom</label>
        </p-floatlabel>
        @if (isInvalid('firstName')) {
          <p-message severity="error" text="Le prénom est requis." />
        }
      </div>

      <!-- Select -->
      <div class="field">
        <p-select formControlName="role" [options]="roles"
                  optionLabel="label" optionValue="value"
                  placeholder="Choisir un rôle"
                  [invalid]="isInvalid('role')" inputId="role" />
      </div>

      <!-- DatePicker -->
      <div class="field">
        <p-datepicker formControlName="birthDate"
                      dateFormat="dd/mm/yy"
                      [maxDate]="today"
                      [firstDayOfWeek]="1"
                      placeholder="Date de naissance" />
      </div>

      <!-- MultiSelect -->
      <div class="field">
        <p-multiselect formControlName="skills" [options]="skillOptions"
                       optionLabel="label" optionValue="value"
                       display="chip" placeholder="Compétences" />
      </div>

      <!-- Checkbox -->
      <div class="flex align-items-center gap-2">
        <p-checkbox formControlName="active" [binary]="true" inputId="active" />
        <label for="active">Compte actif</label>
      </div>

      <!-- Submit -->
      <div class="flex gap-2 justify-content-end mt-4">
        <p-button label="Annuler" severity="secondary" variant="outlined"
                  type="button" (onClick)="reset()" />
        <p-button label="Enregistrer" type="submit"
                  [disabled]="form.invalid" [loading]="saving()" />
      </div>

    </form>
  `,
})
export class UserFormComponent {
  protected readonly saving = signal(false);
  protected readonly today = new Date();

  protected readonly roles = [
    { label: 'Administrateur', value: 'admin' },
    { label: 'Utilisateur', value: 'user' },
  ];

  protected readonly skillOptions = [
    { label: 'Angular',    value: 'angular' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'NestJS',     value: 'nestjs' },
  ];

  protected readonly form = new FormGroup<UserForm>({
    firstName: new FormControl('', { validators: [Validators.required], nonNullable: true }),
    lastName:  new FormControl('', { validators: [Validators.required], nonNullable: true }),
    email:     new FormControl('', { validators: [Validators.required, Validators.email], nonNullable: true }),
    role:      new FormControl<string | null>(null, Validators.required),
    birthDate: new FormControl<Date | null>(null),
    skills:    new FormControl<string[]>([], { nonNullable: true }),
    active:    new FormControl(true, { nonNullable: true }),
  });

  protected isInvalid(field: keyof UserForm): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const data = this.form.getRawValue();
    this.saving.set(true);
    // ... appel service
  }

  protected reset(): void {
    this.form.reset();
  }
}
```

---

## Table lazy + filtres (pattern complet)

```typescript
type TableState = {
  first: number;
  rows: number;
  sortField: string;
  sortOrder: number;
  globalFilter: string;
};

@Component({
  imports: [TableModule, InputTextModule, IconFieldModule, InputIconModule, ButtonModule, TagModule],
  template: `
    <p-table
      #dt
      [value]="items()"
      [lazy]="true"
      (onLazyLoad)="onLazyLoad($event)"
      [totalRecords]="total()"
      [loading]="loading()"
      [paginator]="true"
      [rows]="tableState.rows"
      [first]="tableState.first"
      [rowsPerPageOptions]="[10, 25, 50]"
      [showCurrentPageReport]="true"
      currentPageReportTemplate="{first}-{last} sur {totalRecords}"
      sortField="createdAt"
      [sortOrder]="-1"
      dataKey="id"
      [tableStyle]="{ 'min-width': '50rem' }"
    >
      <ng-template #caption>
        <div class="flex align-items-center justify-content-between flex-wrap gap-2">
          <h2 class="m-0 text-xl font-bold">Liste des éléments</h2>
          <p-iconfield>
            <p-inputicon><i class="pi pi-search"></i></p-inputicon>
            <input pInputText placeholder="Rechercher..."
                   (input)="onGlobalFilter($any($event.target).value)" />
          </p-iconfield>
        </div>
      </ng-template>

      <ng-template #header>
        <tr>
          <th pSortableColumn="name">Nom <p-sortIcon field="name" /></th>
          <th pSortableColumn="status">Statut <p-sortIcon field="status" /></th>
          <th pSortableColumn="createdAt">Créé le <p-sortIcon field="createdAt" /></th>
          <th>Actions</th>
        </tr>
      </ng-template>

      <ng-template #body let-item>
        <tr>
          <td>{{ item.name }}</td>
          <td><p-tag [value]="item.status" [severity]="getStatusSeverity(item.status)" /></td>
          <td>{{ item.createdAt | date:'dd/MM/yyyy' }}</td>
          <td>
            <p-button icon="pi pi-pencil" variant="text" [rounded]="true"
                      aria-label="Modifier" (onClick)="edit(item)" />
            <p-button icon="pi pi-trash" variant="text" [rounded]="true"
                      severity="danger" aria-label="Supprimer"
                      (onClick)="confirmDelete($event, item)" />
          </td>
        </tr>
      </ng-template>

      <ng-template #emptymessage>
        <tr>
          <td colspan="4" class="text-center py-5">
            <i class="pi pi-inbox text-4xl text-color-secondary"></i>
            <p class="text-color-secondary mt-2">Aucun élément trouvé.</p>
          </td>
        </tr>
      </ng-template>
    </p-table>
  `,
})
export class ItemTableComponent {
  protected readonly items = signal<Item[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);

  protected tableState: TableState = {
    first: 0, rows: 10, sortField: 'createdAt', sortOrder: -1, globalFilter: '',
  };

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableState = {
      first: event.first ?? 0,
      rows: event.rows ?? 10,
      sortField: (event.sortField as string) ?? 'createdAt',
      sortOrder: event.sortOrder ?? -1,
      globalFilter: this.tableState.globalFilter,
    };
    this.loadData();
  }

  onGlobalFilter(value: string): void {
    this.tableState.globalFilter = value;
    this.tableState.first = 0;
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.itemService.findAll(this.tableState).subscribe({
      next: ({ data, total }) => {
        this.items.set(data);
        this.total.set(total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
```

---

## Clean Architecture — Service Toast

Encapsuler `MessageService` dans un service dédié pour désolidariser les composants de PrimeNG :

```typescript
// infra/primeng-toast.service.ts
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messageService = inject(MessageService);

  success(detail: string, summary = 'Succès'): void {
    this.messageService.add({ severity: 'success', summary, detail, life: 3000 });
  }

  error(detail: string, summary = 'Erreur'): void {
    this.messageService.add({ severity: 'error', summary, detail, sticky: true, closable: true });
  }

  warn(detail: string, summary = 'Avertissement'): void {
    this.messageService.add({ severity: 'warn', summary, detail, life: 5000 });
  }

  info(detail: string, summary = 'Information'): void {
    this.messageService.add({ severity: 'info', summary, detail, life: 3000 });
  }
}
```

---

## Gotchas généraux Angular + PrimeNG

- **`provideAnimationsAsync()`** obligatoire — sans lui, overlays sans animation.
- **`MessageService` n'est pas `providedIn: 'root'`** — fournir dans `app.config.ts` ou dans le composant parent.
- **`ConfirmationService`** idem — fournir explicitement.
- **`dataKey`** dans `p-table` : indispensable pour sélection, expansion et virtual scroll.
- **`virtualScrollItemSize`** doit être exact — mesurer la hauteur réelle en px.
- **`modal: false`** par défaut sur `p-dialog` — toujours expliciter `[modal]="true"`.
- **`[type]="'submit'"`** sur `p-button` dans les formulaires — le défaut est `'button'`.
- **Objets dans `p-select` / `p-multiselect`** — toujours `dataKey` si les objets sont recréés.
- **`sticky: true` + `closable: true`** dans les toasts — associer les deux, jamais l'un sans l'autre.
- **`p-calendar` supprimé** depuis v18 → utiliser `p-datepicker`.
- **`InputTextareaModule` supprimé** depuis v18 → utiliser `TextareaModule`.
