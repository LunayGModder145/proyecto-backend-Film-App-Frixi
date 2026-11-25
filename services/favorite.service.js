/**
 * Servicio de favoritos: une la tabla `favorites` (SQL) con las fuentes
 * de datos de las películas (OMDB o MongoDB).
 * Lo usan la API (GET /api/favorites) y la vista "Mis películas" (/movies).
 *
 * @module services/favorite
 */

const Favorite = require("../models/favorite.model");
const movieService = require("./movie.service");

/** @typedef {import("./omdb.service").MovieResult} MovieResult */

/**
 * Devuelve las películas favoritas de un usuario con todos sus datos,
 * pidiendo cada una a su fuente original.
 * Las que ya no existen o fallan al pedirse se omiten, para que un fallo
 * de OMDB o una película borrada de MongoDB no rompa la lista entera.
 *
 * @param {number} userId
 * @returns {Promise<MovieResult[]>}
 */
const getFavoriteMovies = async (userId) => {
    const favorites = await Favorite.getByUser(userId);

    const results = await Promise.allSettled(
        favorites.map((fav) => movieService.getMovieBySource(fav.movie_id, fav.source))
    );

    return results
        .filter((result) => result.status === "fulfilled" && result.value)
        .map((result) => result.value);
};

/**
 * Añade `isFavorite` a cada película según los favoritos del usuario,
 * para que las vistas pinten el botón "Añadir a Favoritos" ya desactivado.
 * Solo lee la tabla `favorites` (no pide nada a OMDB ni a MongoDB).
 * Si no hay usuario o falla la consulta, se devuelven todas como no favoritas
 * para no romper la búsqueda por esto.
 *
 * @param {number|undefined} userId
 * @param {MovieResult[]} movies
 * @returns {Promise<(MovieResult & { isFavorite: boolean })[]>}
 */
const markFavorites = async (userId, movies) => {
    let keys = new Set();

    if (userId && movies.length) {
        try {
            const favorites = await Favorite.getByUser(userId);
            keys = new Set(favorites.map((fav) => `${fav.source}:${fav.movie_id}`));
        } catch (err) {
            console.error("Error cargando favoritos del usuario:", err);
        }
    }

    return movies.map((movie) => ({
        ...movie,
        isFavorite: keys.has(`${movie.source}:${movie.id}`)
    }));
};

module.exports = {
    getFavoriteMovies,
    markFavorites
};
