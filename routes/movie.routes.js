const express = require("express");
const movieController = require("../controllers/movie.controller");
const checkRole = require("../middlewares/role.middleware");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Movie:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: imdbID si viene de OMDB, _id si viene de MongoDB
 *           example: tt0133093
 *         source:
 *           type: string
 *           enum: [omdb, mongo]
 *           example: omdb
 *         title:
 *           type: string
 *           example: The Matrix
 *         poster:
 *           type: string
 *           nullable: true
 *         year:
 *           type: integer
 *           nullable: true
 *           example: 1999
 *         director:
 *           type: string
 *           nullable: true
 *         genre:
 *           type: string
 *           nullable: true
 *           example: Action, Sci-Fi
 *         runtime:
 *           type: integer
 *           nullable: true
 *           description: Duración en minutos
 *           example: 136
 *         synopsis:
 *           type: string
 *           nullable: true
 *         actors:
 *           type: array
 *           items:
 *             type: string
 *         rating:
 *           type: number
 *           nullable: true
 *           example: 8.7
 *     MovieInput:
 *       type: object
 *       description: Datos de una película de MongoDB. En POST todos los campos son obligatorios.
 *       required: [title, poster, year, director, genre, runtime, synopsis, actors, rating]
 *       properties:
 *         title:
 *           type: string
 *           example: The Matrix
 *         poster:
 *           type: string
 *           description: URL de la imagen
 *           example: https://example.com/matrix.jpg
 *         year:
 *           type: integer
 *           minimum: 1888
 *           description: Entre 1888 y el año actual + 5
 *           example: 1999
 *         director:
 *           type: string
 *           example: Lana Wachowski, Lilly Wachowski
 *         genre:
 *           type: string
 *           example: Action, Sci-Fi
 *         runtime:
 *           type: integer
 *           minimum: 1
 *           description: Duración en minutos
 *           example: 136
 *         synopsis:
 *           type: string
 *           example: Un hacker descubre que el mundo es una simulación.
 *         actors:
 *           description: Array de nombres o texto separado por comas
 *           oneOf:
 *             - type: array
 *               items:
 *                 type: string
 *             - type: string
 *           example: [Keanu Reeves, Carrie-Anne Moss]
 *         rating:
 *           type: number
 *           minimum: 0
 *           maximum: 10
 *           example: 8.7
 *     MovieResponse:
 *       type: object
 *       properties:
 *         movie:
 *           $ref: '#/components/schemas/Movie'
 */

/**
 * @swagger
 * /api/movie/{titleOrId}:
 *   parameters:
 *     - in: path
 *       name: titleOrId
 *       required: true
 *       schema:
 *         type: string
 *       description: |
 *         En GET, el título (o parte del título) que se busca, p. ej. `matrix`.
 *         En PUT y DELETE, el `_id` de la película en MongoDB.
 *         (En Express son dos rutas, `/movie/:title` y `/movie/:id`; OpenAPI las trata
 *         como la misma, por eso se documentan juntas.)
 *   get:
 *     summary: Buscar película o películas por título
 *     description: Busca primero en OMDB y, si no hay resultados, en MongoDB. Usuario o admin.
 *     tags: [Movies]
 *     responses:
 *       200:
 *         description: Películas encontradas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 movies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Movie'
 *       400:
 *         description: Título vacío
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Debes indicar un título
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: No hay resultados
 *         content:
 *           application/json:
 *             example:
 *               message: No hay resultados
 *               movies: []
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Editar una película (solo admin)
 *     description: Solo películas de MongoDB. Se pueden enviar solo los campos que cambian.
 *     tags: [Movies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MovieInput'
 *           example:
 *             title: The Matrix
 *             year: 1999
 *             runtime: 136
 *     responses:
 *       200:
 *         description: Película editada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MovieResponse'
 *       400:
 *         description: Id no válido o datos que no pasan la validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               idNoValido:
 *                 summary: Id no válido
 *                 value:
 *                   message: El id no es válido
 *               datosNoValidos:
 *                 summary: Datos no válidos
 *                 value:
 *                   message: Datos no válidos
 *                   errors: [La valoración no puede ser superior a 10]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: La película no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: La película no existe
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     summary: Eliminar una película (solo admin)
 *     description: Borra la película de MongoDB y también los favoritos asociados en SQL (de todos los usuarios).
 *     tags: [Movies]
 *     responses:
 *       200:
 *         description: Película eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Película eliminada
 *                 movie:
 *                   $ref: '#/components/schemas/Movie'
 *                 favoritesDeleted:
 *                   type: integer
 *                   description: Favoritos borrados en SQL (0 si falló el borrado en SQL)
 *                   example: 2
 *       400:
 *         description: Id no válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: El id no es válido
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: La película no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: La película no existe
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/movie/:title", movieController.getMovieByTitle);
router.put("/movie/:id", checkRole(["admin"]), movieController.updateMovie);
router.delete("/movie/:id", checkRole(["admin"]), movieController.deleteMovie);

/**
 * @swagger
 * /api/movie:
 *   post:
 *     summary: Crear una película (solo admin)
 *     description: Todos los campos son obligatorios. `actors` puede ser un array o un texto separado por comas.
 *     tags: [Movies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MovieInput'
 *     responses:
 *       201:
 *         description: Película creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MovieResponse'
 *       400:
 *         description: Datos que no pasan la validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             example:
 *               message: Datos no válidos
 *               errors: [El título es obligatorio, La duración es obligatoria]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/movie", checkRole(["admin"]), movieController.createMovie);

module.exports = router;
