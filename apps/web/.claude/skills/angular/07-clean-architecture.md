# Clean Architecture Angular (EAK) — Reference

## Structure 3 couches par feature

```
src/app/features/<feature>/
  ├── domain/             # TypeScript pur, zero dependance framework
  │   ├── models/         # Types de donnees (type, pas interface)
  │   ├── gateways/       # Contrats (interface ou abstract class)
  │   └── use-cases/      # Logique metier, 1 use case = 1 methode execute()
  ├── infra/              # Services Angular, communication externe
  │   ├── in-memory-*.gateway.ts
  │   ├── http-*.gateway.ts
  │   ├── *.adapter.ts    # Fonctions pures de transformation
  │   └── *.types.ts      # Types API specifiques (jamais dans domain)
  └── application/        # Couche UI
      ├── components/     # Dumb components (presentational)
      └── tokens/         # InjectionToken (optionnel)
```

### Nomenclature des fichiers

| Couche | Fichier | Convention |
|--------|---------|------------|
| Domain | `people.type.ts` | Modeles avec `.type.ts` |
| Domain | `get-people.gateway.ts` | Contrats avec `.gateway.ts` |
| Domain | `get-people.usecase.ts` | Use cases avec `.usecase.ts` |
| Infra | `http-people.gateway.ts` | Implementation prefixee par le type |
| Infra | `in-memory-people.gateway.ts` | In-memory prefixe |
| Infra | `people.adapter.ts` | Adaptateurs avec `.adapter.ts` |
| Infra | `swapi.types.ts` | Types API avec `.types.ts` |

## Regle de dependance

```
Application → Domain ← Infra
```

- **Application** → **Domain** : utilise les use cases et les modeles
- **Infra** → **Domain** : implemente les gateways definis dans le domain
- **Domain** → **RIEN** : zero import Angular, zero couplage framework
- **Application** ne depend **JAMAIS** directement d'**Infra**

Le wiring se fait dans `app.config.ts` via les providers DI.

## Domain

### Regles strictes

- Pas de `@Injectable`, pas de `signal()`, pas de `inject()`
- TypeScript + RxJS uniquement
- `type` pour les modeles (pas `interface` — pas de declaration merging)
- `interface` pour les contrats gateway (ou `abstract class` pour la DI)
- Union types plutot que enums
- Modeles en **anglais** meme si l'UI est en francais
- Chaque use case = **1 methode `execute()`** (SRP)

### Modeles

```typescript
// domain/models/people.type.ts
export type Gender = 'male' | 'female' | 'none';

export type People = {
  name: string;
  height: number;
  gender: Gender;
  skills: string[];
};

// Union type plutot que enum
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';
```

### Gateways (contrats)

```typescript
// domain/gateways/get-people.gateway.ts
import { Observable } from 'rxjs';
import { People } from '../models/people.type';

export abstract class GetPeopleGateway {
  abstract getPeople(): Observable<People[]>;
}
```

```typescript
// domain/gateways/save-people.gateway.ts
export abstract class SavePeopleGateway {
  abstract savePerson(person: People): Observable<People>;
}
```

### Use cases

```typescript
// domain/use-cases/get-people.usecase.ts
import { Observable } from 'rxjs';
import { People } from '../models/people.type';
import { GetPeopleGateway } from '../gateways/get-people.gateway';

export class GetPeopleUseCase {
  constructor(private readonly _gateway: GetPeopleGateway) {}

  execute(): Observable<People[]> {
    return this._gateway.getPeople();
  }
}
```

```typescript
// Use case avec logique metier
export class FilterPeopleByGenderUseCase {
  constructor(private readonly _gateway: GetPeopleGateway) {}

  execute(gender: Gender): Observable<People[]> {
    return this._gateway.getPeople().pipe(
      map(people => people.filter(p => p.gender === gender)),
    );
  }
}
```

## Infra

### Regles

- `@Injectable()` sur les gateways concrets
- `implements GatewayInterface`
- In-memory : `BehaviorSubject` + `defer()` pour simuler l'async
- HTTP : `inject(HttpClient)` + `pipe(map(adapter))`
- Adapters = **fonctions pures**, pas des classes
- Types API dans `infra/` uniquement (jamais dans domain)

### Types API

```typescript
// infra/swapi.types.ts
export type SwapiPeople = {
  name: string;
  height: string;   // string dans l'API, number dans le domain
  gender: string;
  skills: string;    // CSV dans l'API, array dans le domain
};
```

### Adapter (fonction pure)

```typescript
// infra/people.adapter.ts
import { People, Gender } from '../domain/models/people.type';
import { SwapiPeople } from './swapi.types';

export function toPeople(raw: SwapiPeople): People {
  return {
    name: raw.name,
    height: parseInt(raw.height, 10) || 0,
    gender: raw.gender as Gender,
    skills: raw.skills.split(', ').filter(Boolean),
  };
}

export function toSwapiPeople(people: People): SwapiPeople {
  return {
    name: people.name,
    height: String(people.height),
    gender: people.gender,
    skills: people.skills.join(', '),
  };
}
```

### Gateway HTTP

```typescript
// infra/http-people.gateway.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { People } from '../domain/models/people.type';
import { GetPeopleGateway } from '../domain/gateways/get-people.gateway';
import { SwapiPeople } from './swapi.types';
import { toPeople } from './people.adapter';

@Injectable()
export class HttpPeopleGateway implements GetPeopleGateway {
  private readonly http = inject(HttpClient);

  getPeople(): Observable<People[]> {
    return this.http.get<SwapiPeople[]>('/api/people').pipe(
      map(list => list.map(toPeople)),
    );
  }
}
```

### Gateway In-Memory

```typescript
// infra/in-memory-people.gateway.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, defer } from 'rxjs';
import { People } from '../domain/models/people.type';
import { GetPeopleGateway } from '../domain/gateways/get-people.gateway';

const MOCK_DATA: People[] = [
  { name: 'Luke', height: 172, gender: 'male', skills: ['Force', 'Lightsaber'] },
  { name: 'Leia', height: 150, gender: 'female', skills: ['Diplomacy', 'Force'] },
];

@Injectable()
export class InMemoryPeopleGateway implements GetPeopleGateway {
  private readonly people$ = new BehaviorSubject<People[]>(MOCK_DATA);

  getPeople(): Observable<People[]> {
    return defer(() => this.people$.asObservable());
  }
}
```

## Switch d'implementation

```typescript
// app.config.ts — une seule ligne a changer
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),

    // Implementation concrete — changer ici pour switcher
    { provide: GetPeopleGateway, useClass: HttpPeopleGateway },

    // Ou par environnement :
    // { provide: GetPeopleGateway, useClass: environment.production
    //     ? HttpPeopleGateway
    //     : InMemoryPeopleGateway },
  ],
};
```

## Use case Injectable (option pragmatique)

Pour les projets qui preferent eviter le wiring manuel des use cases :

```typescript
@Injectable({ providedIn: 'root' })
export class GetPeopleUseCase {
  private readonly _gateway = inject(GetPeopleGateway);

  execute(): Observable<People[]> {
    return this._gateway.getPeople();
  }
}
```

**Trade-off** : ajoute une dependance Angular dans le domain mais simplifie le wiring.
Pour les projets stricts, garder le use case pur et le fournir via factory :

```typescript
// app.config.ts
{
  provide: GetPeopleUseCase,
  useFactory: () => new GetPeopleUseCase(inject(GetPeopleGateway)),
}
```

## Utilisation dans un composant

```typescript
// application/pages/people-list.ts
@Component({
  selector: 'people-list-page',
  imports: [PeopleCard],
  template: `
    @for (person of people(); track person.name) {
      <people-card [person]="person" />
    } @empty {
      <p>Aucune personne trouvee</p>
    }
  `,
})
export class PeopleListPage {
  private readonly useCase = inject(GetPeopleUseCase);
  protected readonly people = toSignal(this.useCase.execute(), { initialValue: [] });
}
```

## Principes

| Principe | Application |
|----------|-------------|
| **YAGNI** | Ne pas ajouter de couche avant d'en avoir besoin |
| **SRP** | Chaque use case fait une seule chose |
| **Screaming Architecture** | Les noms de dossiers revelent l'intention metier |
| **Immutabilite** | Toujours de nouvelles references, jamais de mutation |
| **Pragmatisme > purete** | Adapter la rigueur a la taille de l'equipe |
| **Dependency Rule** | Les dependances pointent vers l'interieur (domain) |
| **Open/Closed** | Ajouter une implementation sans modifier le domain |

## Checklist nouvelle feature

1. Definir les **types** dans `domain/models/`
2. Definir le **contrat gateway** dans `domain/gateways/`
3. Ecrire le **use case** dans `domain/use-cases/`
4. Implementer le **gateway in-memory** dans `infra/` (TDD)
5. Implementer le **gateway HTTP** dans `infra/` (avec adapter)
6. Wirer dans `app.config.ts`
7. Creer le **composant page** (smart) dans `application/`
8. Creer les **composants presentationnels** (dumb) dans `application/components/` — nommer `people-card.ts`, `people-item.ts`, etc. (sans `.component`)
