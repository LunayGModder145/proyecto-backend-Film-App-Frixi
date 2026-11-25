/**
 * Servicio de películas: une las dos fuentes de datos (OMDB y MongoDB)
 * para que el origen sea transparente para el usuario.
 *
 * @module services/movie
 */

const omdbService = require("./omdb.service");
const Movie = require("../models/movie.model");

/** @typedef {import("./omdb.service").MovieResult} MovieResult */

/**
 * Convierte un documento de MongoDB al formato común de la app.
 * @param {Object} doc Documento de la colección `movies`.
 * @returns {MovieResult}
 */
const normalizeMongoMovie = (doc) => ({
    id: String(doc._id),
    source: "mongo",
    title: doc.title,
    poster: doc.poster,
    year: doc.year,
    director: doc.director,
    genre: doc.genre,
    runtime: doc.runtime,
    synopsis: doc.synopsis,
    actors: doc.actors || [],
    rating: doc.rating
});

/**
 * Escapa los caracteres especiales de regex para buscar el texto tal cual.
 * @param {string} text
 * @returns {string}
 */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Busca películas por título en MongoDB (parcial y sin distinguir mayúsculas).
 * @param {string} title
 * @returns {Promise<MovieResult[]>}
 */
const searchInMongo = async (title) => {
    const docs = await Movie.find({
        title: new RegExp(escapeRegex(title), "i")
    }).lean();

    return docs.map(normalizeMongoMovie);
};

/**
 * Busca películas por título siguiendo el orden del enunciado:
 *  1. Primero en OMDB. Si hay resultados, se devuelven (sin guardarlos en BBDD).
 *  2. Si OMDB no encuentra nada, se busca en MongoDB.
 *  3. Si tampoco hay nada, se devuelve un array vacío.
 *
 * Si OMDB falla (caído, sin API key...), se sigue buscando en MongoDB.
 *
 * @param {string} title Título (o parte del título) a buscar.
 * @returns {Promise<MovieResult[]>}
 */
const searchMovies = async (title) => {
    try {
        const omdbMovies = await omdbService.searchByTitle(title);
        if (omdbMovies.length > 0) {
            return omdbMovies;
        }
    } catch (error) {
        console.error("Error buscando en OMDB, se busca en MongoDB:", error.message);
    }

    return searchInMongo(title);
};

/**
 * Devuelve todas las películas de MongoDB, de la más reciente a la más antigua.
 * Se usa en la vista de gestión del administrador (/movies).
 *
 * @returns {Promise<MovieResult[]>}
 */
const getAllMovies = async () => {
    const docs = await Movie.find().sort({ createdAt: -1 }).lean();

    return docs.map(normalizeMongoMovie);
};

/**
 * Si `actors` llega como texto ("Actor 1, Actor 2", típico de un formulario),
 * lo convierte en array. Si ya es un array (o no viene), lo deja igual.
 *
 * @param {string|string[]|undefined} actors
 * @returns {string[]|undefined}
 */
const parseActors = (actors) => {
    if (typeof actors !== "string") {
        return actors;
    }

    return actors
        .split(",")
        .map((actor) => actor.trim())
        .filter((actor) => actor !== "");
};

/**
 * Edita una película de MongoDB.
 * - runValidators: aplica las validaciones del modelo también al editar.
 * - returnDocument 'after': devuelve la película ya editada (no la antigua).
 * - `actors` en texto se convierte en array (igual que al crear).
 *
 * @param {string} id _id de la película en MongoDB.
 * @param {Object} data Campos nuevos de la película.
 * @returns {Promise<MovieResult|null>} La película editada, o null si no existe.
 */
const updateMovie = async (id, data = {}) => {
    if (data.actors !== undefined) {
        data = { ...data, actors: parseActors(data.actors) };
    }

    const movie = await Movie.findByIdAndUpdate(id, data, {
        runValidators: true,
        returnDocument: "after"
    }).lean();

    return movie ? normalizeMongoMovie(movie) : null;
};

/**
 * Elimina una película de MongoDB por su _id.
 *
 * @param {string} id _id de la película en MongoDB.
 * @returns {Promise<MovieResult|null>} La película borrada normalizada, o null si no existía.
 */
const deleteMovie = async (id) => {
    const movie = await Movie.findByIdAndDelete(id).lean();

    return movie ? normalizeMongoMovie(movie) : null;
};

/**
 * Crea una película en MongoDB.
 * - Solo se guardan los campos del modelo (no se puede colar un _id, createdAt...).
 * - Si `actors` llega como texto ("Actor 1, Actor 2", típico de un formulario),
 *   se convierte en array.
 * - La validación la hace el esquema de Mongoose: si algo no cumple,
 *   `create` lanza un ValidationError o CastError.
 *
 * @param {Object} data Datos de la película (normalmente req.body).
 * @returns {Promise<MovieResult>} La película creada normalizada.
 */
const createMovie = async (data = {}) => {
    const { title, poster, year, director, genre, runtime, synopsis, rating } = data;
    const actors = parseActors(data.actors);

    const movie = await Movie.create({
        title, poster, year, director, genre, runtime, synopsis, actors, rating
    });

    return normalizeMongoMovie(movie.toObject());
};

/**
 * Obtiene una película completa pidiéndola a su fuente original.
 * Se usa para los favoritos, que en SQL solo guardan id + fuente.
 *
 * @param {string} id imdbID (OMDB) o _id (MongoDB).
 * @param {"omdb"|"mongo"} source
 * @returns {Promise<MovieResult|null>} La película, o null si ya no existe.
 */
const getMovieBySource = async (id, source) => {
    if (source === "omdb") {
        return omdbService.getById(id);
    }

    if (source === "mongo") {
        const doc = await Movie.findById(id).lean();
        return doc ? normalizeMongoMovie(doc) : null;
    }

    return null;
};

module.exports = {
    normalizeMongoMovie,
    searchMovies,
    getAllMovies,
    createMovie,
    updateMovie,
    deleteMovie,
    getMovieBySource
};
