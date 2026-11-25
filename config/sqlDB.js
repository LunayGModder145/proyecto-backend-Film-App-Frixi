/**
 * Conexión a PostgreSQL (Supabase): usuarios y favoritos.
 * Exporta un Pool de `pg` que comparten todos los modelos SQL.
 * La conexión se configura con DATABASE_URL.
 *
 * @module config/sqlDB
 */

const { Pool } = require('pg');
require('dotenv').config();

/** @type {import('pg').Pool} */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('Conectado a PostgreSQL en Supabase exitosamente!');
});

// Prueba temporal de consulta para forzar la conexión al arrancar
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
  } else {
    console.log('Consulta de prueba exitosa, hora en la BD:', res.rows[0].now);
  }
});

module.exports = pool;