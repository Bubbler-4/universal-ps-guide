import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import * as schema from "./schema";

export type DB = ReturnType<typeof drizzleD1>;

export function createD1DB(d1: any) {
  return drizzleD1(d1, { schema });
}
