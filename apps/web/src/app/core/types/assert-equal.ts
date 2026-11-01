export type Expect<T extends true> = T;
export type MutualAssign<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
