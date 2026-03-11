import type { Hono } from 'hono';

export type AppEnv = {
  Variables: {
    userId: string;
    email: string;
  };
};

export type AppHono = Hono<AppEnv>;
