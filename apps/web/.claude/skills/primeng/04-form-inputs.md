# PrimeNG — Inputs de formulaire

## InputText

**Import** : `import { InputTextModule } from 'primeng/inputtext';`  
**Usage** : directive `pInputText` sur un `<input>` natif.

| Prop | Type | Notes |
|------|------|-------|
| `pSize` | `'small'\|'large'` | Taille |
| `variant` | `'filled'\|'outlined'` | Style |
| `invalid` | `boolean` | État erreur (rouge) |
| `fluid` | `boolean` | Pleine largeur |

```html
<!-- Reactive form -->
<input pInputText type="text" formControlName="username"
       [invalid]="isInvalid('username')" />

<!-- ngModel -->
<input pInputText type="text" [(ngModel)]="value" />

<!-- Variante filled -->
<input pInputText type="text" variant="filled" [(ngModel)]="value" />

<!-- Sizes -->
<input pInputText pSize="small" type="text" />
<input pInputText pSize="large" type="text" />
```

### FloatLabel

**Import** : `import { FloatLabelModule } from 'primeng/floatlabel';`

```html
<!-- variant : 'over' (défaut), 'in', 'on' -->
<p-floatlabel>
  <input pInputText id="name" formControlName="name" />
  <label for="name">Nom complet</label>
</p-floatlabel>

<p-floatlabel variant="in">
  <input pInputText id="email" formControlName="email" />
  <label for="email">Email</label>
</p-floatlabel>
```

### IconField + InputIcon

**Import** : `IconFieldModule`, `InputIconModule`

```html
<p-iconfield>
  <p-inputicon><i class="pi pi-search"></i></p-inputicon>
  <input pInputText type="text" placeholder="Rechercher..." />
</p-iconfield>

<!-- Icône à droite -->
<p-iconfield iconPosition="right">
  <p-inputicon><i class="pi pi-spin pi-spinner"></i></p-inputicon>
  <input pInputText type="text" />
</p-iconfield>
```

---

## Textarea

**Import** : `import { TextareaModule } from 'primeng/textarea';`  
**Usage** : directive `pTextarea` sur `<textarea>` natif.

| Prop | Type | Notes |
|------|------|-------|
| `autoResize` | `boolean` | Croît avec le contenu |
| `pSize` | `'small'\|'large'` | |
| `variant` | `'filled'\|'outlined'` | |
| `fluid` | `boolean` | Pleine largeur |
| `invalid` | `boolean` | État erreur |

```html
<textarea pTextarea rows="5" formControlName="description"></textarea>

<!-- AutoResize -->
<textarea pTextarea [autoResize]="true" [(ngModel)]="value"></textarea>
```

> ⚠️ Anciennement `InputTextareaModule` — **supprimé depuis v18**, utiliser `TextareaModule`.

---

## Checkbox

**Import** : `import { CheckboxModule } from 'primeng/checkbox';`  
**Sélecteur** : `p-checkbox`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `binary` | `boolean` | `false` | true/false au lieu d'un tableau |
| `value` | `any` | — | Valeur dans le tableau (mode liste) |
| `trueValue` | `any` | `true` | Valeur quand coché |
| `falseValue` | `any` | `false` | Valeur quand décoché |
| `inputId` | `string` | — | Lie le `<label for="">` |
| `indeterminate` | `boolean` | `false` | État visuel indéterminé |
| `readonly` | `boolean` | — | |
| `size` | `'small'\|'large'` | — | |

```html
<!-- Booléen -->
<p-checkbox [(ngModel)]="accepted" [binary]="true" inputId="accept" />
<label for="accept">J'accepte les CGU</label>

<!-- Liste de valeurs -->
<p-checkbox [(ngModel)]="selectedSkills" value="angular" inputId="angular" />
<label for="angular">Angular</label>
<p-checkbox [(ngModel)]="selectedSkills" value="nestjs" inputId="nestjs" />
<label for="nestjs">NestJS</label>

<!-- Reactive form -->
<p-checkbox formControlName="notifications" [binary]="true" />
```

> ⚠️ Sans `[binary]="true"`, le modèle est un tableau — initialiser avec `= []`.  
> `inputId` + `<label for>` obligatoires pour l'accessibilité.

---

## RadioButton

**Import** : `import { RadioButtonModule } from 'primeng/radiobutton';`  
**Sélecteur** : `p-radiobutton`

| Prop | Type | Notes |
|------|------|-------|
| `value` | `any` | Valeur envoyée au modèle quand sélectionné |
| `inputId` | `string` | Pour `<label for="">` |
| `size` | `'small'\|'large'` | |

```html
<!-- Tous partagent la même variable ngModel -->
<p-radiobutton [(ngModel)]="selectedRole" value="admin"   inputId="admin" />
<label for="admin">Administrateur</label>

<p-radiobutton [(ngModel)]="selectedRole" value="user"    inputId="user" />
<label for="user">Utilisateur</label>

<!-- Reactive forms -->
<p-radiobutton formControlName="role" value="admin" inputId="admin" />
```

> ⚠️ Si plusieurs groupes de radiobuttons coexistent dans le même FormGroup, ajouter `name="groupX"` pour éviter les interférences.

---

## Select (Dropdown)

**Import** : `import { SelectModule } from 'primeng/select';`  
**Sélecteur** : `p-select`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `options` | `any[]` | — | Collection d'options |
| `optionLabel` | `string` | — | Propriété affichée comme label |
| `optionValue` | `string` | — | Propriété utilisée comme valeur |
| `optionDisabled` | `string` | — | Propriété pour désactiver |
| `placeholder` | `string` | — | |
| `filter` | `boolean` | — | Filtre intégré |
| `filterBy` | `string` | — | Champs pour le filtre |
| `showClear` | `boolean` | — | Bouton reset |
| `checkmark` | `boolean` | `false` | Coche sur l'option sélectionnée |
| `group` | `boolean` | — | Options groupées |
| `scrollHeight` | `string` | `'200px'` | Hauteur du panel |
| `loading` | `boolean` | `false` | État chargement |
| `invalid` | `boolean` | — | État erreur |
| `inputId` | `string` | — | ID pour le label |
| `dataKey` | `string` | — | Clé unique pour comparaison d'objets |
| `virtualScroll` | `boolean` | — | |
| `virtualScrollItemSize` | `number` | — | Hauteur item (px) |
| `editable` | `boolean` | — | Input éditable libre |
| `fluid` | `boolean` | — | Pleine largeur |
| `size` | `'small'\|'large'` | — | |

```html
<!-- Objets avec optionLabel -->
<p-select
  [options]="countries"
  [(ngModel)]="selectedCountry"
  optionLabel="name"
  placeholder="Choisir un pays"
/>

<!-- Extraire une valeur scalaire -->
<p-select
  [options]="cities"
  [(ngModel)]="selectedCityCode"
  optionLabel="name"
  optionValue="code"
/>

<!-- Reactive form + validation -->
<p-select
  formControlName="country"
  [options]="countries"
  optionLabel="name"
  [invalid]="isInvalid('country')"
  placeholder="Sélectionner"
/>

<!-- Avec filtre et reset -->
<p-select
  [options]="countries"
  [(ngModel)]="selected"
  optionLabel="name"
  [filter]="true"
  filterBy="name"
  [showClear]="true"
/>

<!-- Groupes -->
<p-select [options]="groupedCities" [(ngModel)]="selected"
          placeholder="Ville" [group]="true"
          optionGroupLabel="label" optionGroupChildren="items">
  <ng-template let-group #group>
    <span class="font-bold">{{ group.label }}</span>
  </ng-template>
</p-select>

<!-- Template custom pour l'option sélectionnée et la liste -->
<p-select [options]="countries" [(ngModel)]="selected" optionLabel="name">
  <ng-template #selectedItem let-option>
    <span class="flex items-center gap-2">
      <img [src]="option.flag" width="18" />{{ option.name }}
    </span>
  </ng-template>
  <ng-template #item let-option>
    <span class="flex items-center gap-2">
      <img [src]="option.flag" width="18" />{{ option.name }}
    </span>
  </ng-template>
</p-select>
```

> ⚠️ Comparaison par référence avec des objets → toujours ajouter `dataKey="id"` si les objets sont recréés.

---

## MultiSelect

**Import** : `import { MultiSelectModule } from 'primeng/multiselect';`  
**Sélecteur** : `p-multiselect`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `options` | `any[]` | — | |
| `optionLabel` / `optionValue` / `optionDisabled` | `string` | — | Même logique que Select |
| `placeholder` | `string` | — | |
| `display` | `'comma'\|'chip'` | `'comma'` | Affichage des sélections |
| `maxSelectedLabels` | `number` | `3` | Au-delà : texte de remplacement |
| `selectionLimit` | `number` | — | Limite de sélection |
| `filter` | `boolean` | `true` | |
| `showToggleAll` | `boolean` | `true` | Bouton Tout sélectionner |
| `showClear` | `boolean` | `false` | |
| `dataKey` | `string` | — | Clé unique pour comparaison |
| `fluid` | `boolean` | — | |

```html
<p-multiselect
  [(ngModel)]="selectedRoles"
  [options]="roles"
  optionLabel="label"
  optionValue="value"
  placeholder="Sélectionner des rôles"
  display="chip"
  [filter]="true"
/>

<!-- Reactive form -->
<p-multiselect
  formControlName="skills"
  [options]="skills"
  optionLabel="name"
  placeholder="Compétences"
/>
```

> ⚠️ `dataKey` crucial si pré-remplissage de la sélection avec des objets — sans lui, la comparaison par référence échoue.

---

## AutoComplete

**Import** : `import { AutoCompleteModule } from 'primeng/autocomplete';`  
**Sélecteur** : `p-autocomplete`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `suggestions` | `any[]` | — | **Résultat filtré retourné** via `completeMethod` |
| `optionLabel` | `string\|function` | — | Champ à afficher |
| `multiple` | `boolean` | — | Chips multiples |
| `minLength` | `number` | `1` | Caractères avant déclenchement |
| `delay` | `number` | `300` | Délai (ms) |
| `dropdown` | `boolean` | — | Bouton dropdown |
| `forceSelection` | `boolean` | — | Force le choix parmi les suggestions |
| `showClear` | `boolean` | `false` | |

**Output obligatoire** : `completeMethod` — met à jour `suggestions`.

```html
<p-autocomplete
  [(ngModel)]="selectedCountry"
  [suggestions]="filteredCountries"
  (completeMethod)="filterCountry($event)"
  optionLabel="name"
  placeholder="Rechercher..."
  [forceSelection]="true"
/>

<!-- Multiple (chips) -->
<p-autocomplete
  [(ngModel)]="selectedTags"
  [suggestions]="filteredTags"
  (completeMethod)="filterTags($event)"
  [multiple]="true"
/>
```

```typescript
filteredCountries: Country[] = [];

filterCountry(event: AutoCompleteCompleteEvent): void {
  this.filteredCountries = this.countries.filter(c =>
    c.name.toLowerCase().includes(event.query.toLowerCase())
  );
}
```

> ⚠️ `completeMethod` doit **mettre à jour la propriété** `suggestions` — ne pas retourner de valeur.

---

## DatePicker

**Import** : `import { DatePickerModule } from 'primeng/datepicker';`  
**Sélecteur** : `p-datepicker`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `selectionMode` | `'single'\|'multiple'\|'range'` | `'single'` | |
| `dateFormat` | `string` | `'mm/dd/yy'` | Ex: `'dd/mm/yy'` |
| `inline` | `boolean` | `false` | Toujours visible |
| `showTime` | `boolean` | — | Ajoute time picker |
| `timeOnly` | `boolean` | — | Seulement l'heure |
| `hourFormat` | `'12'\|'24'` | `'24'` | |
| `showButtonBar` | `boolean` | — | Boutons Aujourd'hui / Effacer |
| `showClear` | `boolean` | `false` | |
| `minDate` / `maxDate` | `Date\|null` | — | |
| `disabledDates` | `Date[]` | — | |
| `disabledDays` | `number[]` | — | 0=dim, 1=lun... |
| `firstDayOfWeek` | `number` | — | 0=dim, 1=lun |
| `readonlyInput` | `boolean` | — | Input non éditable |
| `numberOfMonths` | `number` | `1` | Multi-mois |
| `view` | `'date'\|'month'\|'year'` | `'date'` | |
| `touchUI` | `boolean` | — | Modal plein écran mobile |

```html
<!-- Date simple -->
<p-datepicker [(ngModel)]="date" dateFormat="dd/mm/yy" />

<!-- Plage de dates -->
<p-datepicker [(ngModel)]="rangeDates" selectionMode="range"
              [readonlyInput]="true" dateFormat="dd/mm/yy" />

<!-- Avec heure -->
<p-datepicker [(ngModel)]="dateTime" [showTime]="true" hourFormat="24" />

<!-- Reactive form avec contraintes -->
<p-datepicker formControlName="birthDate"
              [maxDate]="today"
              [firstDayOfWeek]="1"
              dateFormat="dd/mm/yy" />

<!-- Picker mois -->
<p-datepicker [(ngModel)]="month" view="month" dateFormat="mm/yy" [readonlyInput]="true" />
```

> ⚠️ Anciennement `p-calendar` / `CalendarModule` — **supprimé depuis v18**.  
> Le modèle est un objet `Date` JS, pas une string.  
> `selectionMode="range"` : le modèle est `Date[]` — le 2e élément peut être `null`.  
> `firstDayOfWeek` n'est pas auto-dérivé de la locale — toujours expliciter.

---

## FileUpload

**Import** : `import { FileUploadModule } from 'primeng/fileupload';`  
**Sélecteur** : `p-fileupload`

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `name` | `string` | — | Paramètre serveur |
| `url` | `string` | — | Endpoint |
| `multiple` | `boolean` | — | |
| `accept` | `string` | — | `"image/*"`, `".pdf,.docx"` |
| `maxFileSize` | `number` | — | En octets |
| `fileLimit` | `number` | — | Nb max de fichiers |
| `auto` | `boolean` | — | Upload immédiat |
| `customUpload` | `boolean` | — | Angular gère l'envoi |
| `mode` | `'advanced'\|'basic'` | `'advanced'` | `basic` = bouton simple |
| `chooseLabel` / `uploadLabel` / `cancelLabel` | `string` | — | Labels des boutons |
| `headers` | `HttpHeaders` | — | Headers HTTP |
| `withCredentials` | `boolean` | — | Cookies cross-origin |

**Output clé** : `uploadHandler` (event: `{ files: File[] }`) pour upload custom.

```html
<!-- Upload géré par Angular (recommandé) -->
<p-fileupload
  [customUpload]="true"
  (uploadHandler)="handleUpload($event)"
  accept=".pdf,.docx"
  [multiple]="true"
  [maxFileSize]="5000000"
  chooseLabel="Choisir"
  uploadLabel="Envoyer"
  cancelLabel="Annuler"
/>

<!-- Mode basic (avatar) -->
<p-fileupload
  mode="basic"
  accept="image/*"
  [customUpload]="true"
  (uploadHandler)="handleAvatar($event)"
  [auto]="true"
/>
```

```typescript
handleUpload(event: FileUploadHandlerEvent): void {
  const formData = new FormData();
  for (const file of event.files) {
    formData.append('files', file);
  }
  this.http.post('/api/upload', formData).subscribe(...);
}
```

> ⚠️ Toujours utiliser `customUpload` + `uploadHandler` en Angular pour contrôler les headers d'auth.
