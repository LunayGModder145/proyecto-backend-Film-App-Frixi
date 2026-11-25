/**
 * PostgreSQL en memoria (pg-mem) para los tests e2e.
 *
 * Carga el esquema real (docs/schema.sql), así se prueban de verdad las
 * restricciones de la BD: email único sin distinguir mayúsculas, favorito
 * repetido (error 23505) y ON DELETE CASCADE de los favoritos.
 *
 * Cada test e2e sustituye config/sqlDB por este pool:
 *   jest.mock("../../config/sqlDB", () => require("./helpers/sqlMemory").pool);
 */

const fs = require("fs");
const path = require("path");
const { newDb } = require("pg-mem");

const schema = fs
    .readFileSync(path.join(__dirname, "..", "..", "..", "docs", "schema.sql"), "utf8")
    // Row Level Security es cosa de Supabase: pg-mem no lo entiende y aquí no hace falta
    .replace(/^ALTER TABLE .* ROW LEVEL SECURITY;$/gm, "");

const db = newDb();
db.public.none(schema);

// Mismo interfaz que el Pool de `pg` que usan los modelos (pool.query)
const { Pool } = db.adapters.createPg();
const pool = new Pool();

// Foto de la BD recién creada (tablas vacías) para dejarla igual antes de cada test
const emptyDb = db.backup();

/** Vacía las tablas: cada test empieza con la BD como recién creada. */
const resetSql = () => emptyDb.restore();

module.exports = { pool, resetSql };
