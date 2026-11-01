import type { FactoryProvider, InjectionToken } from '@nestjs/common';

/**
 * Enregistre une classe métier (sans décorateur Nest) sous son propre jeton : `inject` liste,
 * dans l'ordre du constructeur, les jetons à lui passer. Le tuple impose le bon nombre
 * d'arguments ; la correspondance jeton ↔ type reste, comme partout dans Nest, à la charge
 * de l'appelant.
 */
export function provideClass<A extends unknown[], T>(
  cls: new (...args: A) => T,
  ...inject: { [K in keyof A]: InjectionToken }
): FactoryProvider<T> {
  return {
    provide: cls,
    inject,
    useFactory: (...args: unknown[]) => new cls(...(args as A)),
  };
}
