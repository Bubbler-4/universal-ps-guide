import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
  exec: (query: string) => Promise<D1ExecResult>;
  batch: <T extends unknown[]>(
    statements: D1PreparedStatement[]
  ) => Promise<T>;
};

export type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  run: () => Promise<D1Result>;
  all: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
  first: <T = Record<string, unknown>>(colName?: string) => Promise<T | null>;
  raw: <T extends unknown[]>() => Promise<T[]>;
};

export type D1Result<T = Record<string, unknown>> = {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
};

export type D1ExecResult = {
  count: number;
  duration: number;
};

export function getDb(d1: D1Database) {
  return drizzle(d1 as never, { schema });
}
