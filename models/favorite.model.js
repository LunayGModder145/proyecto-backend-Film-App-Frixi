/**
 * Modelo de favoritos (tabla `favorites` en PostgreSQL, ver docs/schema.sql).
 * Solo guarda la relación usuario + película + fuente, nunca los datos de la película.
 *
 * @module models/favorite
 */

const pool = require("../config/sqlDB");

/**
 * @typedef {Object} Favorite
 * @property {number} id
 * @property {number} user_id
 * @property {string} movie_id   imdbID (OMDB) o _id (MongoDB).
 * @property {"omdb"|"mongo"} source
 * @property {Date} created_at
 */

/**
 * Guarda una película como favorita de un usuario.
 * Si ya estaba guardada, Postgres lanza un error con code "23505" (unique_violation).
 *
 * @param {number} userId
 * @param {string} movieId
 * @param {"omdb"|"mongo"} source
 * @returns {Promise<Favorite>} La fila creada.
 */
const add = async (userId, movieId, source) => {
    const { rows } = await pool.query(
        `INSERT INTO favorites (user_id, movie_id, source)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, movieId, source]
    );
    return rows[0];
};

/**
 * Devuelve los favoritos de un usuario, del más reciente al más antiguo.
 * @param {number} userId
 * @returns {Promise<Favorite[]>}
 */
const getByUser = async (userId) => {
    const { rows } = await pool.query(
        `SELECT * FROM favorites
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
    );
    return rows;
};

/**
 * Quita una película de los favoritos de un usuario.
 * @param {number} userId
 * @param {string} movieId
 * @param {"omdb"|"mongo"} source
 * @returns {Promise<boolean>} true si se borró, false si no existía.
 */
const remove = async (userId, movieId, source) => {
    const { rowCount } = await pool.query(
        `DELETE FROM favorites
         WHERE user_id = $1 AND movie_id = $2 AND source = $3`,
        [userId, movieId, source]
    );
    return rowCount > 0;
};

/**
 * Quita una película de los favoritos de TODOS los usuarios.
 * Se usa al borrar una película de MongoDB (DELETE /api/movie).
 *
 * @param {string} movieId
 * @param {"omdb"|"mongo"} source
 * @returns {Promise<number>} Número de favoritos borrados.
 */
const removeByMovie = async (movieId, source) => {
    const { rowCount } = await pool.query(
        `DELETE FROM favorites
         WHERE movie_id = $1 AND source = $2`,
        [movieId, source]
    );
    return rowCount;
};

module.exports = {
    add,
    getByUser,
    remove,
    removeByMovie
};
