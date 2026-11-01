# Signal Forms Angular (v21+) — Reference

> Signal Forms est la **nouvelle approche recommandee** pour les formulaires Angular, basee entierement sur les Signals. Disponible a partir d'Angular v21.

## Regles critiques

- **JAMAIS** utiliser `null` ou `undefined` dans les modeles de formulaire
- Valeurs par defaut : `''` pour le texte, `0` pour les nombres, `[]` pour les tableaux, `false` pour les booleens
- Ne PAS mixer Signal Forms et Reactive Forms dans le meme composant

## Imports principaux

```typescript
import {
  FormField,
  FieldState,
  SignalForm,
  formField,
  validateAsync,
  applyEach,
} from '@angular/forms/signals';
```

## FieldState vs FormField

### FieldState — etat brut du champ

`FieldState` represente la valeur d'un champ. C'est un type simple.

### FormField — champ avec etat reactif

`FormField` est une **fonction** — il FAUT l'appeler pour acceder a l'etat.

```typescript
@Component({
  imports: [SignalForm],
  template: `
    <form [signalForm]="form">
      <input [formField]="form.name" />
      <input [formField]="form.email" type="email" />
      <input [formField]="form.age" type="number" />
    </form>
  `,
})
export class UserFormComponent {
  protected readonly form = new SignalForm({
    name: '',       // string — pas null !
    email: '',      // string
    age: 0,         // number — pas null !
  });

  // IMPORTANT : appeler le field comme une fonction pour acceder a l'etat
  protected readonly nameValue = computed(() => this.form.name());       // valeur courante
  protected readonly nameState = computed(() => this.form.name.state()); // etat complet (dirty, touched, errors, etc.)
}
```

> **Piege courant** : `form.name` retourne le FormField. `form.name()` retourne la **valeur**. `form.name.state()` retourne l'**etat**.

## Directive [formField]

```html
<input [formField]="form.username" />
<textarea [formField]="form.description"></textarea>
<select [formField]="form.country">
  <option value="fr">France</option>
  <option value="us">USA</option>
</select>
```

### Attributs interdits avec [formField]

Ne PAS utiliser ces attributs sur un element avec `[formField]` :

| Interdit | Raison |
|----------|--------|
| `[(ngModel)]` | Conflit de binding |
| `[value]` | Gere par formField |
| `(input)` | Gere par formField |
| `(change)` | Gere par formField |
| `name` | Optionnel, gere automatiquement |

## Validation

### Validation synchrone avec schema path

```typescript
import { SignalForm } from '@angular/forms/signals';

protected readonly form = new SignalForm({
  name: '',
  email: '',
  age: 0,
}, {
  validators: {
    // Validation par chemin de champ
    'name': (value: string) => {
      if (value.length < 2) return { minLength: { min: 2, actual: value.length } };
      return null;
    },
    'email': (value: string) => {
      if (!value.includes('@')) return { email: true };
      return null;
    },
    'age': (value: number) => {
      if (value < 18) return { min: { min: 18, actual: value } };
      return null;
    },
  },
});
```

### Verification des erreurs dans le template

```html
@let nameState = form.name.state();

<input [formField]="form.name" />

@if (nameState.touched && nameState.errors?.['minLength']) {
  <span class="error">Le nom doit contenir au moins {{ nameState.errors['minLength'].min }} caracteres</span>
}
```

## Validation asynchrone

```typescript
import { validateAsync } from '@angular/forms/signals';

protected readonly form = new SignalForm({
  username: '',
}, {
  asyncValidators: {
    // IMPORTANT : le parametre DOIT etre une fonction (pas une valeur directe)
    'username': validateAsync(
      // Fonction de validation — recoit la valeur, retourne Observable ou Promise
      (value: string) => {
        return this.userService.checkAvailability(value).pipe(
          map(available => available ? null : { taken: true }),
        );
      },
      {
        // onError est OBLIGATOIRE — gerer les erreurs reseau
        onError: (error) => {
          console.error('Validation failed:', error);
          return { networkError: true };
        },
      }
    ),
  },
});
```

> **Regles critiques pour validateAsync** :
> 1. Le premier parametre DOIT etre une **fonction** : `(value) => ...`
> 2. L'option `onError` est **OBLIGATOIRE** — pas de validation async sans gestion d'erreur

## Soumission du formulaire

Le callback de submit DOIT etre `async` et DOIT retourner une `Promise`.

```typescript
@Component({
  imports: [SignalForm],
  template: `
    <form [signalForm]="form" (signalFormSubmit)="onSubmit($event)">
      <input [formField]="form.name" />
      <input [formField]="form.email" type="email" />
      <button type="submit" [disabled]="!form.valid()">Envoyer</button>
    </form>
  `,
})
export class ContactFormComponent {
  private readonly contactService = inject(ContactService);

  protected readonly form = new SignalForm({
    name: '',
    email: '',
  });

  // DOIT etre async, DOIT retourner Promise
  protected async onSubmit(value: { name: string; email: string }): Promise<void> {
    await this.contactService.send(value);
    this.form.reset();
  }
}
```

## Gestion des tableaux avec applyEach

`applyEach` applique un validateur a chaque element d'un tableau. Il prend un **seul argument** (la fonction de validation).

```typescript
protected readonly form = new SignalForm({
  tags: [] as string[],
  items: [] as { name: string; qty: number }[],
}, {
  validators: {
    // Valider chaque tag individuellement
    'tags': applyEach((tag: string) => {
      if (tag.length === 0) return { required: true };
      return null;
    }),

    // Valider chaque item
    'items': applyEach((item: { name: string; qty: number }) => {
      if (item.qty < 0) return { negativeQty: true };
      return null;
    }),
  },
});
```

```typescript
// Ajouter/supprimer des elements
addTag(tag: string): void {
  this.form.tags.update(tags => [...tags, tag]);
}

removeTag(index: number): void {
  this.form.tags.update(tags => tags.filter((_, i) => i !== index));
}
```

## Objet context — proprietes disponibles

L'objet context est disponible dans les validateurs et les callbacks.

| Propriete | Type | Description |
|-----------|------|-------------|
| `value` | `T` | Valeur courante du champ |
| `valueOf(path)` | `(path: string) => unknown` | Lire la valeur d'un autre champ |
| `state` | `FieldState` | Etat du champ courant (dirty, touched, errors) |
| `stateOf(path)` | `(path: string) => FieldState` | Etat d'un autre champ |

```typescript
validators: {
  'confirmPassword': (value: string, ctx) => {
    const password = ctx.valueOf('password') as string;
    if (value !== password) return { mismatch: true };
    return null;
  },
}
```

## Pieges courants

| Piege | Erreur | Solution |
|-------|--------|----------|
| `form.name` sans `()` dans le template | Affiche `[object Object]` | Appeler `form.name()` pour la valeur |
| `null` comme valeur initiale | Erreur de type | Utiliser `''`, `0`, `[]`, `false` |
| `validateAsync(result)` au lieu de `validateAsync(() => result)` | Ne fonctionne pas | Toujours passer une **fonction** |
| Oublier `onError` dans `validateAsync` | Erreur de compilation | Toujours fournir `onError` |
| `onSubmit` synchrone | Erreur | Le callback DOIT etre `async` et retourner `Promise` |
| Utiliser `applyEach(fn, options)` | Erreur | `applyEach` prend un **seul** argument |
| Mixer `[formField]` et `[(ngModel)]` | Double binding | Choisir l'un ou l'autre |
| `form.reset()` → remet `null` | Invalide | `reset()` remet les **valeurs initiales** (pas null) |
