/**
 * Modelo de usuarios (tabla `users` en PostgreSQL, ver docs/schema.sql).
 * Consultas SQL parametrizadas ($1, $2...) para evitar inyección SQL.
 *
 * Las búsquedas que usa el login (findByEmail, findByGoogleId) devuelven también
 * `password_hash` y `google_id`; las que acaban en una respuesta o una vista no.
 *
 * @module models/user
 */

const db = require('../config/sqlDB');
const pool = db.pool || db;

/**
 * Fila completa de la tabla `users` (incluye los datos de acceso).
 * Solo se usa dentro del backend: nunca se envía tal cual al cliente.
 *
 * @typedef {Object} UserRow
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {string|null} password_hash Null si el usuario solo entra con Google.
 * @property {string|null} google_id     Null si nunca ha entrado con Google.
 * @property {"user"|"admin"} role
 * @property {Date} created_at
 */

/**
 * Busca un usuario por email sin distinguir mayúsculas (login con contraseña).
 *
 * @param {string} email
 * @returns {Promise<UserRow|null>} El usuario, o null si no existe.
 */
const findByEmail = async (email) => {
  const query = `
    SELECT id, name, email, password_hash, google_id, role, created_at
    FROM users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
};

/**
 * Busca un usuario por su id de Google (login con Google OAuth).
 *
 * @param {string} googleId Id del perfil de Google (`profile.id`).
 * @returns {Promise<UserRow|null>} El usuario, o null si no existe.
 */
const findByGoogleId = async (googleId) => {
  const query = `
    SELECT id, name, email, password_hash, google_id, role, created_at
    FROM users
    WHERE google_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [googleId]);
  return rows[0] || null;
};

/**
 * Devuelve el usuario que entra con Google y lo crea si hace falta:
 * 1. Si ya existe con ese google_id, lo devuelve.
 * 2. Si existe con ese email (se registró con contraseña), le enlaza el google_id.
 * 3. Si no existe, lo crea con rol `user` y sin contraseña.
 *    Si Google no da nombre, usa la parte del email antes de la @.
 *
 * @param {Object} profile Datos del perfil de Google.
 * @param {string} profile.googleId
 * @param {string} profile.email
 * @param {string} [profile.name]
 * @returns {Promise<UserRow>}
 */
const findOrCreateGoogleUser = async ({ googleId, email, name }) => {
  const existingByGoogleId = await findByGoogleId(googleId);
  if (existingByGoogleId) {
    return existingByGoogleId;
  }

  const existingByEmail = await findByEmail(email);
  if (existingByEmail) {
    const updateQuery = `
      UPDATE users
      SET google_id = $1
      WHERE id = $2
      RETURNING id, name, email, password_hash, google_id, role, created_at
    `;
    const { rows } = await pool.query(updateQuery, [googleId, existingByEmail.id]);
    return rows[0];
  }

  const insertQuery = `
    INSERT INTO users (name, email, password_hash, google_id, role)
    VALUES ($1, $2, NULL, $3, 'user')
    RETURNING id, name, email, password_hash, google_id, role, created_at
  `;
  const { rows } = await pool.query(insertQuery, [
    name || email.split('@')[0],
    email,
    googleId,
  ]);
  return rows[0];
};

/**
 * Crea un usuario con contraseña (POST /api/signup y POST /api/user del admin).
 * Si el email ya existe, Postgres lanza el error 23505 (índice único ux_users_email).
 *
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.email
 * @param {string} data.passwordHash Contraseña ya cifrada con bcrypt.
 * @param {"user"|"admin"} [data.role="user"]
 * @returns {Promise<UserRow>} El usuario creado.
 */
const createUser = async ({ name, email, passwordHash, role = 'user' }) => {
  const query = `
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, password_hash, google_id, role, created_at
  `;
  const { rows } = await pool.query(query, [name, email, passwordHash, role]);
  return rows[0];
};

/**
 * Datos públicos de un usuario por su id (sin password_hash ni google_id).
 * Lo usan GET /api/user y la vista /profile.
 *
 * @param {number} id
 * @returns {Promise<{id: number, name: string, email: string, role: string, created_at: Date}|null>}
 */
const findById = async (id) => {
  const query = `
    SELECT id, name, email, role, created_at
    FROM users
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Edita el nombre y el email de un usuario (PUT /api/user).
 * Solo esos dos campos: nunca el rol, el id ni la contraseña.
 * Si el email ya lo usa otro usuario, Postgres lanza el error 23505
 * (índice único ux_users_email, ver docs/schema.sql).
 *
 * @param {number} id
 * @param {{name: string, email: string}} data
 * @returns {Promise<{id: number, name: string, email: string, role: string, created_at: Date}|null>}
 *   El usuario editado, o null si no existe.
 */
const updateUser = async (id, { name, email }) => {
  const query = `
    UPDATE users
    SET name = $1, email = $2
    WHERE id = $3
    RETURNING id, name, email, role, created_at
  `;
  const { rows } = await pool.query(query, [name, email, id]);
  return rows[0] || null;
};

/**
 * Lista de todos los usuarios para la vista /users (admin), sin datos de acceso
 * (ni password_hash ni google_id). `has_google` indica si puede entrar con Google.
 *
 * @returns {Promise<Array<{id: number, name: string, email: string, role: string, created_at: Date, has_google: boolean}>>}
 */
const findAll = async () => {
  const query = `
    SELECT id, name, email, role, created_at, (google_id IS NOT NULL) AS has_google
    FROM users
    ORDER BY created_at DESC, id DESC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

/**
 * El admin edita a cualquier usuario: nombre, email y rol (PUT /api/user/:id).
 * La contraseña no se toca. Si el email ya existe, Postgres lanza el error 23505.
 *
 * @param {number} id
 * @param {{name: string, email: string, role: "user"|"admin"}} data
 * @returns {Promise<{id: number, name: string, email: string, role: string, created_at: Date}|null>}
 *   El usuario editado, o null si no existe.
 */
const updateUserByAdmin = async (id, { name, email, role }) => {
  const query = `
    UPDATE users
    SET name = $1, email = $2, role = $3
    WHERE id = $4
    RETURNING id, name, email, role, created_at
  `;
  const { rows } = await pool.query(query, [name, email, role, id]);
  return rows[0] || null;
};

/**
 * Borra un usuario (DELETE /api/user/:id, admin).
 * Sus favoritos se borran solos: la tabla favorites tiene ON DELETE CASCADE.
 *
 * @param {number} id
 * @returns {Promise<{id: number, name: string, email: string}|null>} El usuario borrado, o null si no existía.
 */
const deleteUser = async (id) => {
  const query = `
    DELETE FROM users
    WHERE id = $1
    RETURNING id, name, email
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

module.exports = {
  findByEmail,
  findByGoogleId,
  findById,
  findAll,
  findOrCreateGoogleUser,
  createUser,
  updateUser,
  updateUserByAdmin,
  deleteUser,
};
