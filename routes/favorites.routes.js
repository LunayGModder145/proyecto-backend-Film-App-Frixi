const express = require("express");
const favoritesController = require("../controllers/favorites.controller");

// El control de rol (solo "user") se aplica al montar el router en app.js
const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     FavoriteInput:
 *       type: object
 *       required: [movieId, source]
 *       properties:
 *         movieId:
 *           type: string
 *           description: imdbID si viene de OMDB, _id si viene de MongoDB
 *           example: tt0133093
 *         source:
 *           type: string
 *           enum: [omdb, mongo]
 *           example: omdb
 *     Favorite:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 1
 *         movie_id:
 *           type: string
 *           example: tt0133093
 *         source:
 *           type: string
 *           enum: [omdb, mongo]
 *           example: omdb
 *         created_at:
 *           type: string
 *           format: date-time
 *   responses:
 *     FavoriteBadRequest:
 *       description: Falta movieId o source, o source no es válido
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/favorites:
 *   get:
 *     summary: Obtener las películas favoritas del usuario
 *     description: Lee los favoritos en SQL y pide los datos de cada película a su fuente (OMDB o MongoDB).
 *     tags: [Favorites]
 *     responses:
 *       200:
 *         description: Películas favoritas (array vacío si no hay ninguna)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 movies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Movie'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", favoritesController.getFavorites);

/**
 * @swagger
 * /api/favorites:
 *   post:
 *     summary: Guardar una película en favoritos
 *     description: Solo guarda la relación usuario + película + fuente, no los datos de la película.
 *     tags: [Favorites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FavoriteInput'
 *     responses:
 *       201:
 *         description: Favorito guardado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favorite:
 *                   $ref: '#/components/schemas/Favorite'
 *       400:
 *         $ref: '#/components/responses/FavoriteBadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: La película ya está en favoritos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: La película ya está en favoritos
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", favoritesController.addFavorite);

/**
 * @swagger
 * /api/favorites:
 *   delete:
 *     summary: Quitar una película de favoritos
 *     tags: [Favorites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FavoriteInput'
 *     responses:
 *       200:
 *         description: Película quitada de favoritos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *             example:
 *               message: Película quitada de favoritos
 *       400:
 *         $ref: '#/components/responses/FavoriteBadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: La película no está en favoritos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: La película no está en favoritos
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/", favoritesController.removeFavorite);

module.exports = router;
