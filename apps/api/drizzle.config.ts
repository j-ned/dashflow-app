import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Journal séparé : ne pas écraser drizzle.__drizzle_migrations (Hono).
  migrations: { table: '__drizzle_migrations_nest', schema: 'drizzle' },
});
