import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL || "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

/**
 * Automatická oprava databáze: když v ní chybí sloupec, který je ve schema.ts
 * (např. po aktualizaci webu), přidá ho. Chybějící tabulky vytvoří.
 */
async function ensureColumns(c: Client) {
  for (const value of Object.values(schema)) {
    if (!(value instanceof SQLiteTable)) continue;
    const table = getTableConfig(value);
    const info = await c.execute(`PRAGMA table_info("${table.name}")`);
    if (info.rows.length === 0) {
      // Tabulka chybí → vytvoříme ji (bez indexů a cizích klíčů, ty doplní db:push)
      const cols = table.columns.map((col) => {
        const def = col.default;
        const simple = typeof def === "number" || typeof def === "string" || typeof def === "boolean";
        let sqlCol = `"${col.name}" ${col.getSQLType()}`;
        if (col.primary) sqlCol += " PRIMARY KEY" + ((col as unknown as { autoIncrement?: boolean }).autoIncrement ? " AUTOINCREMENT" : "");
        if (col.notNull && !col.primary) sqlCol += " NOT NULL";
        if (simple) sqlCol += ` DEFAULT ${typeof def === "string" ? `'${def.replace(/'/g, "''")}'` : Number(def)}`;
        return sqlCol;
      });
      await c.execute(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
      console.log(`[db] Vytvořena tabulka ${table.name}`);
      continue;
    }
    const existing = new Set(info.rows.map((r) => String(r.name)));
    for (const col of table.columns) {
      if (existing.has(col.name)) continue;
      const def = col.default;
      const hasSimpleDefault = typeof def === "number" || typeof def === "string" || typeof def === "boolean";
      const defSql = hasSimpleDefault ? ` DEFAULT ${typeof def === "string" ? `'${def.replace(/'/g, "''")}'` : Number(def)}` : "";
      const notNull = col.notNull && hasSimpleDefault ? " NOT NULL" : "";
      await c.execute(`ALTER TABLE "${table.name}" ADD COLUMN "${col.name}" ${col.getSQLType()}${notNull}${defSql}`);
      console.log(`[db] Přidán sloupec ${table.name}.${col.name}`);
    }
  }
}

await ensureColumns(client).catch((e) => console.error("[db] Kontrola databáze selhala:", e));

export const db = drizzle(client, { schema });
export { schema };
