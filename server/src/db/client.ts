import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';

export type Schema = typeof schema;
/** Works for both drivers: postgres-js in production, PGlite in dev/tests. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
export type DbOrTx = Db | Tx;

/** drizzle/ migrations folder — next to src/ in dev, next to dist/ when bundled. */
function migrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const candidate of [path.resolve(here, '../../drizzle'), path.resolve(here, '../drizzle')]) {
    if (fs.existsSync(path.join(candidate, 'meta/_journal.json'))) return candidate;
  }
  throw new Error('Could not find the drizzle/ migrations folder');
}

export interface Database {
  db: Db;
  close: () => Promise<void>;
}

/**
 * Connect and run pending migrations.
 * databaseUrl set → real Postgres. Otherwise PGlite at dataDir ('memory://' for tests).
 */
export async function openDatabase(options: { databaseUrl?: string; dataDir?: string }): Promise<Database> {
  if (options.databaseUrl) {
    const client = postgres(options.databaseUrl, { max: 10 });
    const db = drizzlePostgres(client, { schema });
    await migratePostgres(db, { migrationsFolder: migrationsFolder() });
    return { db: db as unknown as Db, close: () => client.end() };
  }

  const dataDir = options.dataDir ?? 'memory://';
  if (!dataDir.startsWith('memory://')) fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: migrationsFolder() });
  return { db: db as unknown as Db, close: () => client.close() };
}
