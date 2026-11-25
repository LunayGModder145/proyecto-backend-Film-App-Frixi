/**
 * Servicio de acceso a la API externa OMDB (http://www.omdbapi.com/).
 * Devuelve siempre las películas en el formato común de la app
 * (el mismo que las películas de MongoDB), con `source: "omdb"`.
 *
 * @module services/omdb
 */

const OMDB_URL = "https://www.omdbapi.com/";

/**
 * Película en el formato común de la app, sea cual sea su fuente.
 *
 * @typedef {Object} MovieResult
 * @property {string} id            imdbID (OMDB) o _id (MongoDB).
 * @property {"omdb"|"mongo"} source Fuente de los datos (necesaria para favoritos).
 * @property {string} title
 * @property {string|null} poster
 * @property {number|null} year
 * @property {string|null} director
 * @property {string|null} genre
 * @property {number|null} runtime  Duración en minutos.
 * @property {string|null} synopsis
 * @property {string[]} actors
 * @property {number|null} rating
 */

/**
 * OMDB usa "N/A" cuando no tiene un dato. Lo convertimos en null.
 * @param {string} value
 * @returns {string|null}
 */
const clean = (value) => (value && value !== "N/A" ? value : null);

/**
 * Convierte un string a número entero ("136 min" -> 136, "2005–2010" -> 2005).
 * @param {string} value
 * @returns {number|null}
 */
const toInt = (value) => {
    const number = parseInt(clean(value), 10);
    return Number.isNaN(number) ? null : number;
};

/**
 * Convierte el detalle de una película de OMDB al formato común de la app.
 * @param {Object} raw Respuesta de OMDB para una película (búsqueda por `i`).
 * @returns {MovieResult}
 */
const normalizeOmdbMovie = (raw) => {
    const rating = parseFloat(clean(raw.imdbRating));
    const actors = clean(raw.Actors);

    return {
        id: raw.imdbID,
        source: "omdb",
        title: raw.Title,
        poster: clean(raw.Poster),
        year: toInt(raw.Year),
        director: clean(raw.Director),
        genre: clean(raw.Genre),
        runtime: toInt(raw.Runtime),
        synopsis: clean(raw.Plot),
        actors: actors ? actors.split(",").map((actor) => actor.trim()) : [],
        rating: Number.isNaN(rating) ? null : rating
    };
};

/**
 * Hace una petición a OMDB con los parámetros indicados.
 * @param {Object<string, string>} params Parámetros de búsqueda de OMDB.
 * @returns {Promise<Object>} JSON devuelto por OMDB.
 * @throws {Error} Si falta la API key o OMDB responde con un error HTTP.
 */
const requestOmdb = async (params) => {
    const apiKey = process.env.OMDB_API_KEY;
    if (!apiKey) {
        throw new Error("Falta la variable de entorno OMDB_API_KEY");
    }

    const url = new URL(OMDB_URL);
    url.search = new URLSearchParams({ apikey: apiKey, ...params });

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`OMDB respondió con estado ${response.status}`);
    }

    return response.json();
};

/**
 * Obtiene el detalle completo de una película de OMDB por su imdbID.
 * @param {string} imdbID
 * @returns {Promise<MovieResult|null>} La película, o null si OMDB no la encuentra.
 */
const getById = async (imdbID) => {
    const data = await requestOmdb({ i: imdbID, plot: "full" });
    return data.Response === "True" ? normalizeOmdbMovie(data) : null;
};

/**
 * Busca películas por título en OMDB.
 * La búsqueda de OMDB (`s`) solo devuelve título, año y póster, así que
 * pedimos el detalle de cada coincidencia para tener director, género, duración...
 *
 * @param {string} title Título (o parte del título) a buscar.
 * @returns {Promise<MovieResult[]>} Coincidencias; array vacío si no hay ninguna.
 */
const searchByTitle = async (title) => {
    const data = await requestOmdb({ s: title, type: "movie" });

    if (data.Response !== "True" || !Array.isArray(data.Search)) {
        return [];
    }

    // Si falla el detalle de una película concreta, la descartamos sin romper la búsqueda
    const results = await Promise.allSettled(
        data.Search.map((item) => getById(item.imdbID))
    );

    return results
        .filter((result) => result.status === "fulfilled" && result.value)
        .map((result) => result.value);
};

module.exports = {
    normalizeOmdbMovie,
    getById,
    searchByTitle
};
