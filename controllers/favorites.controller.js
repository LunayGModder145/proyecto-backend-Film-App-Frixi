/**
 * Controlador de favoritos del usuario (API /api/favorites).
 * Siempre trabaja con `req.user.id` (del token), nunca con un id de la URL o del body.
 *
 * @module controllers/favorites
 */

const mongoose = require("mongoose");
const Favorite = require("../models/favorite.model");
const favoriteService = require("../services/favorite.service");

const VALID_SOURCES = ["omdb", "mongo"];

/** Código de Postgres para "unique_violation" (la fila ya existe). */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * Valida el body { movieId, source } de POST y DELETE.
 * @param {Object} body
 * @returns {{ movieId?: string, source?: string, error?: string }}
 */
const parseFavoriteBody = (body = {}) => {
    const movieId = typeof body.movieId === "string" ? body.movieId.trim() : "";
    const { source } = body;

    if (!movieId || !source) {
        return { error: "Debes indicar movieId y source" };
    }
    if (!VALID_SOURCES.includes(source)) {
        return { error: `source debe ser uno de: ${VALID_SOURCES.join(", ")}` };
    }
    if (source === "mongo" && !mongoose.isValidObjectId(movieId)) {
        return { error: "El movieId no es un id de MongoDB válido" };
    }

    return { movieId, source };
};

/**
 * POST /api/favorites
 * Guarda la relación usuario + película + fuente (no los datos de la película).
 *
 * - 201 `{ favorite }` si se ha guardado.
 * - 400 si falta movieId/source o source no es válido.
 * - 409 si la película ya estaba en favoritos.
 * - 500 si ocurre un error inesperado.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
const addFavorite = async (req, res) => {
    const { movieId, source, error } = parseFavoriteBody(req.body);
    if (error) {
        return res.status(400).json({ message: error });
    }

    try {
        const favorite = await Favorite.add(req.user.id, movieId, source);
        return res.status(201).json({ favorite });
    } catch (err) {
        if (err.code === PG_UNIQUE_VIOLATION) {
            return res.status(409).json({ message: "La película ya está en favoritos" });
        }
        console.error("Error en POST /api/favorites:", err);
        return res.status(500).json({ message: "Error al guardar el favorito" });
    }
};

/**
 * GET /api/favorites
 * Devuelve las películas favoritas del usuario con todos sus datos,
 * pidiendo cada una a su fuente original (OMDB o MongoDB).
 * Las que ya no existen o fallan al pedirse se omiten.
 *
 * - 200 `{ movies }` (array vacío si no tiene favoritas).
 * - 500 si ocurre un error inesperado.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
const getFavorites = async (req, res) => {
    try {
        const movies = await favoriteService.getFavoriteMovies(req.user.id);
        return res.status(200).json({ movies });
    } catch (err) {
        console.error("Error en GET /api/favorites:", err);
        return res.status(500).json({ message: "Error al obtener los favoritos" });
    }
};

/**
 * DELETE /api/favorites
 * Quita una película de los favoritos del usuario.
 *
 * - 200 si se ha quitado.
 * - 400 si falta movieId/source o source no es válido.
 * - 404 si la película no estaba en favoritos.
 * - 500 si ocurre un error inesperado.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
const removeFavorite = async (req, res) => {
    const { movieId, source, error } = parseFavoriteBody(req.body);
    if (error) {
        return res.status(400).json({ message: error });
    }

    try {
        const removed = await Favorite.remove(req.user.id, movieId, source);
        if (!removed) {
            return res.status(404).json({ message: "La película no está en favoritos" });
        }
        return res.status(200).json({ message: "Película quitada de favoritos" });
    } catch (err) {
        console.error("Error en DELETE /api/favorites:", err);
        return res.status(500).json({ message: "Error al quitar el favorito" });
    }
};

module.exports = {
    addFavorite,
    getFavorites,
    removeFavorite
};
