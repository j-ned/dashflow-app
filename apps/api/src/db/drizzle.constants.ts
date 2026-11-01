export const DRIZZLE = Symbol('DRIZZLE');

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
export type DrizzleDB = PostgresJsDatabase<typeof schema>;
