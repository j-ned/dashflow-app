# Reactive Forms Angular — Reference

## Setup

```typescript
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <label>
        Prenom
        <input formControlName="firstName" />
      </label>
      <label>
        Email
        <input formControlName="email" type="email" />
      </label>
      <button [disabled]="form.invalid">Envoyer</button>
    </form>
  `,
})
export class IdentityFormComponent {
  // ...
}
```

## Typage strict (EAK)

Toujours typer les formulaires avec un type explicite :

```typescript
type IdentityForm = {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
};

form = new FormGroup<IdentityForm>({
  firstName: new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  }),
  lastName: new FormControl('', {
    nonNullable: true,
  }),
  email: new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  }),
});
```

- `nonNullable: true` — `reset()` remet a la valeur initiale au lieu de `null`
- Sans `nonNullable`, le type est `FormControl<string | null>`

## getRawValue() vs .value

```typescript
// .value — exclut les champs disabled
const partial = this.form.value;
// { firstName?: string; lastName?: string; email?: string }

// getRawValue() — inclut les champs disabled
const complete = this.form.getRawValue();
// { firstName: string; lastName: string; email: string }
```

**Toujours utiliser `getRawValue()`** pour envoyer les donnees au backend.

## FormGroup imbrique

```typescript
type AddressForm = {
  street: FormControl<string>;
  city: FormControl<string>;
  zipCode: FormControl<string>;
};

type OrderForm = {
  customer: FormControl<string>;
  billing: FormGroup<AddressForm>;
  shipping: FormGroup<AddressForm>;
};

form = new FormGroup<OrderForm>({
  customer: new FormControl('', { nonNullable: true }),
  billing: new FormGroup<AddressForm>({
    street: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    zipCode: new FormControl('', { nonNullable: true }),
  }),
  shipping: new FormGroup<AddressForm>({
    street: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    zipCode: new FormControl('', { nonNullable: true }),
  }),
});
```

```html
<form [formGroup]="form">
  <input formControlName="customer" />

  <fieldset formGroupName="billing">
    <legend>Facturation</legend>
    <input formControlName="street" />
    <input formControlName="city" />
    <input formControlName="zipCode" />
  </fieldset>

  <fieldset formGroupName="shipping">
    <legend>Livraison</legend>
    <input formControlName="street" />
    <input formControlName="city" />
    <input formControlName="zipCode" />
  </fieldset>
</form>
```

## Validators

### Validators integres

| Validator | Description |
|-----------|-------------|
| `Validators.required` | Champ obligatoire |
| `Validators.email` | Format email |
| `Validators.minLength(n)` | Longueur minimale |
| `Validators.maxLength(n)` | Longueur maximale |
| `Validators.min(n)` | Valeur minimale (nombre) |
| `Validators.max(n)` | Valeur maximale (nombre) |
| `Validators.pattern(regex)` | Expression reguliere |
| `Validators.requiredTrue` | Doit etre `true` (checkbox) |

### Custom validator

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Validator function
export function forbiddenNameValidator(forbidden: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const isForbidden = control.value === forbidden;
    return isForbidden ? { forbiddenName: { value: control.value } } : null;
  };
}

// Utilisation
new FormControl('', {
  nonNullable: true,
  validators: [Validators.required, forbiddenNameValidator('admin')],
});
```

### Cross-field validator (sur le FormGroup)

```typescript
export function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

form = new FormGroup({
  password: new FormControl('', { nonNullable: true }),
  confirmPassword: new FormControl('', { nonNullable: true }),
}, { validators: passwordMatchValidator });
```

### Async validator

```typescript
export function uniqueEmailValidator(userService: UserService): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    return userService.checkEmail(control.value).pipe(
      map(exists => exists ? { emailTaken: true } : null),
      catchError(() => of(null)),
    );
  };
}

new FormControl('', {
  nonNullable: true,
  asyncValidators: [uniqueEmailValidator(inject(UserService))],
  updateOn: 'blur',  // eviter trop de requetes
});
```

## Affichage des erreurs

### Via CSS

```css
/* Afficher les erreurs apres interaction */
input.ng-invalid.ng-touched {
  border-color: red;
}
```

### Via le template

```html
@if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
  <span class="error">L'email est requis</span>
}
@if (form.get('email')?.hasError('email') && form.get('email')?.dirty) {
  <span class="error">Format email invalide</span>
}
@if (form.hasError('passwordMismatch') && form.get('confirmPassword')?.touched) {
  <span class="error">Les mots de passe ne correspondent pas</span>
}
```

### Helper pour simplifier

```typescript
protected hasError(controlName: string, errorName: string): boolean {
  const control = this.form.get(controlName);
  return !!control?.hasError(errorName) && control.touched;
}
```

```html
@if (hasError('email', 'required')) {
  <span class="error">L'email est requis</span>
}
```

## FormArray

```typescript
type SkillsForm = {
  skills: FormArray<FormControl<string>>;
};

form = new FormGroup<SkillsForm>({
  skills: new FormArray([
    new FormControl('Angular', { nonNullable: true }),
    new FormControl('TypeScript', { nonNullable: true }),
  ]),
});

get skills() {
  return this.form.get('skills') as FormArray<FormControl<string>>;
}

addSkill() {
  this.skills.push(new FormControl('', { nonNullable: true }));
}

removeSkill(index: number) {
  this.skills.removeAt(index);
}
```

```html
<div formArrayName="skills">
  @for (skill of skills.controls; track $index; let i = $index) {
    <div>
      <input [formControlName]="i" />
      <button type="button" (click)="removeSkill(i)">Supprimer</button>
    </div>
  }
</div>
<button type="button" (click)="addSkill()">Ajouter une competence</button>
```

## Manipulation programmatique

```typescript
// Definir une valeur (tous les champs)
form.setValue({ firstName: 'John', lastName: 'Doe', email: 'john@doe.com' });

// Definir partiellement
form.patchValue({ firstName: 'Jane' });

// Reset
form.reset();           // remet a null (ou valeur initiale si nonNullable)

// Activer/desactiver
form.get('email')?.disable();
form.get('email')?.enable();

// Marquer comme touche (pour afficher les erreurs)
form.markAllAsTouched();
```

## updateOn

```typescript
// Validation a chaque frappe (defaut)
new FormControl('', { updateOn: 'change' });

// Validation au blur
new FormControl('', { updateOn: 'blur' });

// Validation au submit
new FormGroup({ ... }, { updateOn: 'submit' });
```

## Events Observable

```typescript
// Changements de valeur
this.form.get('email')?.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged(),
).subscribe(value => console.log(value));

// Changements de status
this.form.statusChanges.subscribe(status => {
  // 'VALID' | 'INVALID' | 'PENDING' | 'DISABLED'
});
```
