/**
 * Loads SQL files from prisma/sql/ at module load and exposes them as
 * named string constants. Constitution II requires that no T-SQL string
 * literals appear in TypeScript application code. App code imports these
 * constants and passes them to prisma.$queryRawUnsafe / $executeRawUnsafe
 * with bound parameters. The `.sql` files remain the only place the
 * actual T-SQL lives.
 *
 * Why not Prisma TypedSQL? It does not support the sqlserver provider as
 * of Prisma 6.x.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SQL_DIR = resolve(process.cwd(), 'prisma/sql')

function load(filename: string): string {
  return readFileSync(resolve(SQL_DIR, filename), 'utf8')
}

export const SEARCH_EVENTS_SQL = load('searchEvents.sql')
export const UPSERT_EVENTS_SQL = load('upsertEvents.sql')
