# Classes TypeScript — Reference

## Classe de base
```typescript
class User {
  readonly id: number;
  name: string;
  private password: string;
  protected role: string;

  constructor(id: number, name: string, password: string) {
    this.id = id;
    this.name = name;
    this.password = password;
    this.role = 'user';
  }

  greet(): string {
    return `Hello, ${this.name}`;
  }
}
```

## Parameter properties (raccourci constructeur)
```typescript
class User {
  constructor(
    readonly id: number,
    public name: string,
    private password: string,
    protected role: string = 'user',
  ) {}
}
```

## Visibilite
| Modificateur | Acces |
|-------------|-------|
| public | partout (defaut) |
| protected | classe + sous-classes |
| private | classe uniquement |
| readonly | lecture seule apres construction |

## Abstract
```typescript
abstract class Shape {
  abstract area(): number;
  abstract perimeter(): number;

  describe(): string {
    return `Area: ${this.area()}, Perimeter: ${this.perimeter()}`;
  }
}

class Circle extends Shape {
  constructor(private radius: number) { super(); }
  area(): number { return Math.PI * this.radius ** 2; }
  perimeter(): number { return 2 * Math.PI * this.radius; }
}
```

## Implements
```typescript
interface Serializable {
  serialize(): string;
}

class User implements Serializable {
  constructor(public name: string) {}
  serialize(): string { return JSON.stringify({ name: this.name }); }
}
```

## Getters / Setters
```typescript
class Temperature {
  private _celsius: number;

  constructor(celsius: number) { this._celsius = celsius; }

  get fahrenheit(): number { return this._celsius * 9 / 5 + 32; }
  set fahrenheit(f: number) { this._celsius = (f - 32) * 5 / 9; }
}
```

## Static
```typescript
class MathUtils {
  static PI = 3.14159;
  static square(n: number): number { return n * n; }
}
MathUtils.square(5); // 25
```
