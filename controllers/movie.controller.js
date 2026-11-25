/**
 * Controlador de películas (API /api/movie).
 * La búsqueda por título la puede usar cualquier usuario con sesión;
 * crear, editar y borrar (solo películas de MongoDB) son solo para el admin.
 *
 * @module controllers/movie
 */

const mongoose = require("mongoose");
const movieService = require("../services/movie.service");
const Favorite = require("../models/favorite.model");

/**
 * GET /api/movie/:title
 * Busca películas por título (primero en OMDB y, si no hay resultados, en MongoDB).
 *
 * - 200 `{ movies }` si hay coincidencias.
 * - 400 si el título está vacío.
 * - 404 `{ message: "No hay resultados", movies: [] }` si no hay coincidencias.
 * - 500 si ocurre un error inesperado.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
const getMovieByTitle = async (req, res) => {
    const title = (req.params.title || "").trim();

    if (!title) {
        return res.status(400).json({ message: "Debes indicar un título" });
    }

    try {
        const movies = await movieService.searchMovies(title);

        if (movies.length === 0) {
            return res.status(404).json({ message: "No hay resultados", movies: [] });
        }

        return res.status(200).json({ movies });
    } catch (error) {
        console.error("Error en GET /api/movie/:title:", error);
        return res.status(500).json({ message: "Error al buscar películas" });
    }
};

/**
 * Si el error es de validación de Mongoose, devuelve la lista de mensajes.
 * - ValidationError: no cumple las reglas del modelo (ej. año fuera de rango, falta un campo).
 * - CastError: un campo tiene un tipo incorrecto (ej. year: "abc").
 *
 * @param {Error} error
 * @returns {string[]|null} Mensajes de error, o null si no es un error de validación.
 */
const getValidationErrors = (error) => {
    if (error.name !== "ValidationError" && error.name !== "CastError") {
        return null;
    }

    return error.errors
        ? Object.values(error.errors).map((err) => err.message)
        : [error.message];
};

/**
 * POST /api/movie (solo admin)
 * Crea una película en MongoDB con los datos del body.
 *
 * - 201 `{ movie }` si se ha creado.
 * - 400 `{ message: "Datos no válidos", errors }` si no pasa la validación del modelo.
 * - 500 si ocurre un error inesperado.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
const createMovie = async (req, res) => {
    try {
        const movie = await movieService.createMovie(req.body);

        return res.status(201).json({ movie });
    } catch (error) {
        const errors = getValidationErrors(error);
        if (errors) {
            return res.status(400).json({ message: "Datos no válidos", errors });
        }

        console.error("Error en POST /api/movie:", error);
        return res.status(500).json({ message: "Error al crear la película" });
    }
};

/**
 * PUT /api/movie/:id (solo admin)
 * Edita una película de MongoDB con los datos del body.
 *
 * - 200 `{ movie }` si se ha editado.
 * - 400 si el id no es válido o los datos no pasan la validación del modelo.
 * - 404 si no existe ninguna película con ese id.
 * - 500 si ocurre un error inesperado.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
const updateMovie = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "El id no es válido" });
    }

    try {
        const movie = await movieService.updateMovie(id, req.body);

        if (!movie) {
            return res.status(404).json({ message: "La película no existe" });
        }

        return res.status(200).json({ movie });
    } catch (error) {
        const errors = getValidationErrors(error);
        if (errors) {
            return res.status(400).json({ message: "Datos no válidos", errors });
        }

        console.error("Error en PUT /api/movie/:id:", error);
        return res.status(500).json({ message: "Error al editar la película" });
    }
};

/**
 * DELETE /api/movie/:id (solo admin)
 * Elimina una película de MongoDB por su _id y sus favoritos en SQL (de todos los usuarios).
 *
 * - 200 `{ message: "Película eliminada", movie, favoritesDeleted }` si se ha borrado.
 *   `favoritesDeleted` es el número de favoritos borrados (0 si falló el borrado en SQL).
 * - 400 si el id no es un ObjectId válido.
 * - 404 `{ message: "La película no existe" }` si no existe ninguna película con ese id.
 * - 500 si ocurre un error inesperado.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
const deleteMovie = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "El id no es válido" });
    }

    try {
        const movie = await movieService.deleteMovie(id);

        if (!movie) {
            return res.status(404).json({ message: "La película no existe" });
        }

        // Se borran los favoritos DESPUÉS de borrar en Mongo: si fallara Mongo,
        // los usuarios no perderían favoritos de una película que sigue existiendo.
        // Si falla SQL, la película ya está borrada: se avisa en consola y se responde 200
        // (los favoritos huérfanos los ignora GET /api/favorites).
        let favoritesDeleted = 0;
        try {
            favoritesDeleted = await Favorite.removeByMovie(id, "mongo");
        } catch (sqlError) {
            console.error("Película borrada, pero no se pudieron borrar sus favoritos:", sqlError);
        }

        return res.status(200).json({ message: "Película eliminada", movie, favoritesDeleted });
    } catch (error) {
        console.error("Error en DELETE /api/movie/:id:", error);
        return res.status(500).json({ message: "Error al eliminar la película" });
    }
};

module.exports = {
    getMovieByTitle,
    createMovie,
    updateMovie,
    deleteMovie
};
