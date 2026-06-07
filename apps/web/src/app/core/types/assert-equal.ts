// Assertion compile-time d'équivalence de forme entre deux types.
// Basée sur l'assignabilité bidirectionnelle → tolère les différences `readonly`
// (un schéma Zod infère des types mutables, les modèles domaine sont souvent `readonly`),
// mais échoue si un champ requis manque, est en trop, ou a un type différent.
export type Expect<T extends true> = T;
export type MutualAssign<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
