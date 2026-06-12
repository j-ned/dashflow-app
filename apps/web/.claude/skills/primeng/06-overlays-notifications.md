# PrimeNG — Overlays & Notifications

## Dialog

**Import** : `import { DialogModule } from 'primeng/dialog';`  
**Sélecteur** : `p-dialog`

### Inputs clés

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `visible` | `boolean` | — | Visibilité (two-way) |
| `header` | `string` | — | Titre (ou `#header` template) |
| `modal` | `boolean` | **`false`** | Masque l'arrière-plan — **toujours l'expliciter** |
| `draggable` | `boolean` | `true` | |
| `resizable` | `boolean` | `true` | |
| `maximizable` | `boolean` | `false` | Bouton plein écran |
| `closable` | `boolean` | `true` | Bouton fermeture |
| `closeOnEscape` | `boolean` | `true` | |
| `dismissableMask` | `boolean` | `false` | Ferme en cliquant le masque |
| `position` | `'center'\|'top'\|'bottom'\|'left'\|'right'\|'topleft'\|...` | — | |
| `style` | `object` | — | Ex: `{ width: '25rem' }` |
| `breakpoints` | `object` | — | Responsive ex: `{ '1199px': '75vw', '575px': '90vw' }` |
| `blockScroll` | `boolean` | `false` | Bloque le scroll body |
| `focusTrap` | `boolean` | `true` | Piège le focus |
| `focusOnShow` | `boolean` | `true` | Focus auto à l'ouverture |
| `contentStyle` | `object` | — | Style zone contenu |
| `showHeader` | `boolean` | `true` | |

### Outputs

| Event | Description |
|-------|-------------|
| `visibleChange` | Two-way binding |
| `onShow` / `onHide` | Ouverture / fermeture |
| `onMaximize` | Maximisation |

### Templates

| `#nom` | Description |
|--------|-------------|
| `#header` | Header custom |
| `#footer` | Footer custom |
| `#closeicon` | Icône fermeture custom |
| `#headless` | Contrôle total (no header built-in) |

### Exemples

```html
<!-- Modal basique -->
<p-dialog header="Modifier le profil" [modal]="true" [(visible)]="showDialog"
          [style]="{ width: '28rem' }" [draggable]="false" [resizable]="false">
  <!-- contenu -->
  <ng-template #footer>
    <p-button label="Annuler" severity="secondary" variant="outlined"
              (onClick)="showDialog = false" />
    <p-button label="Enregistrer" (onClick)="save()" />
  </ng-template>
</p-dialog>

<!-- Header template custom -->
<p-dialog [(visible)]="showDialog" [modal]="true" [style]="{ width: '25rem' }">
  <ng-template #header>
    <div class="flex items-center gap-2">
      <i class="pi pi-user text-primary"></i>
      <span class="font-semibold">Utilisateur</span>
    </div>
  </ng-template>
  <!-- contenu -->
</p-dialog>

<!-- Responsive -->
<p-dialog header="Détails" [modal]="true" [(visible)]="showDialog"
          [style]="{ width: '50vw' }"
          [breakpoints]="{ '1199px': '75vw', '575px': '90vw' }"
          [draggable]="false" [resizable]="false">
  ...
</p-dialog>

<!-- Maximizable -->
<p-dialog header="Rapport" [modal]="true" [(visible)]="showDialog"
          [style]="{ width: '60rem' }" [maximizable]="true">
  ...
</p-dialog>

<!-- Positionné en haut -->
<p-dialog header="Alerte" [modal]="true" [(visible)]="showDialog" position="top">
  ...
</p-dialog>
```

```typescript
protected showDialog = false;

openDialog(): void {
  this.showDialog = true;
}

save(): void {
  // traitement...
  this.showDialog = false;
}
```

> ⚠️ `modal` vaut `false` par défaut — **toujours l'expliciter** si on veut un overlay.

---

## Toast + MessageService

**Import** : `import { ToastModule } from 'primeng/toast';`  
**Service** : `import { MessageService } from 'primeng/api';`

### Setup

```typescript
// app.config.ts — fournir globalement
providers: [MessageService]
```

```html
<!-- app.component.html — UNE seule instance globale -->
<p-toast />
```

### Inputs `p-toast`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `position` | `'top-right'\|'top-left'\|'top-center'\|'bottom-right'\|'bottom-left'\|'bottom-center'\|'center'` | `'top-right'` | |
| `life` | `number` | `3000` | Durée globale (ms) |
| `key` | `string` | — | Identifiant pour multi-toasts |
| `preventDuplicates` | `boolean` | `false` | |
| `preventOpenDuplicates` | `boolean` | `false` | Bloque le spam |

### API MessageService

```typescript
private readonly messageService = inject(MessageService);

// Succès
showSuccess(detail: string): void {
  this.messageService.add({
    severity: 'success',
    summary: 'Succès',
    detail,
  });
}

// Erreur sticky (doit être fermée manuellement)
showError(detail: string): void {
  this.messageService.add({
    severity: 'error',
    summary: 'Erreur',
    detail,
    sticky: true,
    closable: true,
  });
}

// Avertissement
showWarn(detail: string): void {
  this.messageService.add({
    severity: 'warn',
    summary: 'Avertissement',
    detail,
    life: 5000,
  });
}

// Toast ciblé (multi-zones)
showFormError(detail: string): void {
  this.messageService.add({
    key: 'form-errors',
    severity: 'warn',
    summary: 'Validation',
    detail,
  });
}

clearAll(): void {
  this.messageService.clear();
}
```

### Severités disponibles

`'success'` | `'info'` | `'warn'` | `'error'` | `'secondary'` | `'contrast'`

### Template message custom

```html
<p-toast position="bottom-center" key="confirm">
  <ng-template let-message #message>
    <div class="flex flex-col gap-3 w-full">
      <span class="font-bold text-lg">{{ message.summary }}</span>
      <p class="text-sm">{{ message.detail }}</p>
      <div class="flex gap-2">
        <p-button label="Confirmer" size="small" (onClick)="onConfirm()" />
        <p-button label="Annuler" size="small" severity="secondary" variant="outlined"
                  (onClick)="messageService.clear('confirm')" />
      </div>
    </div>
  </ng-template>
</p-toast>
```

### Multi-zones toast

```html
<p-toast key="global" position="top-right" />
<p-toast key="form-errors" position="bottom-center" [life]="5000" />
```

### Gotchas Toast

- `MessageService` n'est **pas** `providedIn: 'root'` — le fournir explicitement dans `app.config.ts`.
- `<p-toast />` dans `AppComponent` template, **une seule fois** (pas dans chaque page).
- `sticky: true` sans `closable: true` = toast impossible à fermer — **toujours associer les deux**.
- `preventOpenDuplicates: true` sur le `p-toast` évite le spam lors d'erreurs HTTP répétées.
- `key` est indispensable si plusieurs zones toast coexistent.

---

## ConfirmDialog + ConfirmationService

**Import** : `import { ConfirmDialogModule } from 'primeng/confirmdialog';`  
**Service** : `import { ConfirmationService } from 'primeng/api';`

### Setup

```typescript
// app.config.ts
providers: [ConfirmationService, MessageService]
```

```html
<!-- app.component.html -->
<p-toast />
<p-confirmdialog />
```

### Inputs `p-confirmdialog`

| Prop | Type | Notes |
|------|------|-------|
| `key` | `string` | Multi-dialogs |
| `position` | même que Dialog | |
| `defaultFocus` | `'accept'\|'reject'\|'close'\|'none'` | Focus initial |
| `modal` | `boolean` (défaut `true`) | |
| `focusTrap` | `boolean` (défaut `true`) | |

### API ConfirmationService

```typescript
private readonly confirmationService = inject(ConfirmationService);
private readonly messageService = inject(MessageService);

confirmDelete(event: MouseEvent): void {
  this.confirmationService.confirm({
    target: event.target as EventTarget,
    message: 'Confirmer la suppression de cet élément ?',
    header: 'Zone de danger',
    icon: 'pi pi-exclamation-triangle',
    rejectButtonProps: {
      label: 'Annuler',
      severity: 'secondary',
      outlined: true,
    },
    acceptButtonProps: {
      label: 'Supprimer',
      severity: 'danger',
    },
    accept: () => {
      this.deleteItem();
      this.messageService.add({
        severity: 'success',
        summary: 'Supprimé',
        detail: 'Élément supprimé avec succès.',
      });
    },
    reject: () => {
      // optionnel : feedback
    },
  });
}
```

### Template message custom

```html
<p-confirmdialog>
  <ng-template #message let-message>
    <div class="flex flex-col items-center gap-4 p-4">
      <i [class]="message.icon" class="text-5xl text-orange-400"></i>
      <h3 class="font-bold text-lg m-0">{{ message.header }}</h3>
      <p class="text-center text-sm">{{ message.message }}</p>
    </div>
  </ng-template>
</p-confirmdialog>
```

### Gotchas ConfirmDialog

- `rejectButtonProps` / `acceptButtonProps` remplacent `rejectButtonStyleClass` / `acceptButtonStyleClass` (déprécié) — **utiliser la nouvelle API**.
- Pour plusieurs dialogs de confirmation simultanés, utiliser `key` pour cibler le bon `p-confirmdialog`.
- `target: event.target` permet de positionner le popover près du bouton cliqué.

---

## Message (inline statique)

**Import** : `import { MessageModule } from 'primeng/message';`  
**Sélecteur** : `p-message`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `severity` | sévérité | `'info'` | |
| `text` | `string` | — | Contenu texte |
| `closable` | `boolean` | `false` | Bouton fermer |
| `life` | `number` | — | Auto-dismiss (ms) |
| `variant` | `'outlined'\|'text'\|'simple'` | — | Style visuel |
| `icon` | `string` | — | Icône custom |
| `escape` | `boolean` | `true` | Échappe le HTML |

```html
<!-- Inline statique -->
<p-message severity="success" text="Données enregistrées." />
<p-message severity="error" text="Une erreur est survenue." [closable]="true" />
<p-message severity="warn" text="Fichier trop volumineux." variant="outlined" />

<!-- Conditionnel -->
@if (errorMessage()) {
  <p-message severity="error" [text]="errorMessage()!" />
}

<!-- Auto-dismiss -->
<p-message severity="info" text="Chargement..." [life]="3000" />

<!-- Contenu custom -->
<p-message severity="warn">
  <ng-template #icon><i class="pi pi-exclamation-circle"></i></ng-template>
  <span class="font-medium">Certificat expiré le 12/06/2025</span>
</p-message>
```

> `p-message` est **statique et inline** — pour les notifications globales, utiliser `MessageService` + `p-toast`.  
> `escape="false"` autorise le HTML dans `text` — risque XSS, éviter avec du contenu utilisateur.
