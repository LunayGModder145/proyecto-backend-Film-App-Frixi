/**
 * Modelo de películas de MongoDB (las que crea el admin), con Mongoose.
 *
 * @module models/movie
 */

const mongoose = require('mongoose');

const MIN_YEAR = 1888;
const MAX_YEAR = new Date().getFullYear() + 5;

/**
 * Esquema de una película guardada en MongoDB.
 *
 * @typedef {Object} Movie
 * @property {string} title       Título completo.
 * @property {string} poster     URL de la imagen representativa.
 * @property {number} year       Año de estreno.
 * @property {string} director   Director o directora.
 * @property {string} genre      Género(s).
 * @property {number} runtime    Duración en minutos.
 * @property {string} synopsis   Sinopsis de la película.
 * @property {string[]} actors  Actores principales.
 * @property {number} rating     Valoración de la película.
 */

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El título es obligatorio'],
      trim: true,
    },
    poster: {
      type: String,
      required: [true, 'La imagen es obligatoria'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'El año es obligatorio'],
      min: [MIN_YEAR, `El año no puede ser anterior a ${MIN_YEAR}`],
      max: [MAX_YEAR, `El año no puede ser posterior a ${MAX_YEAR}`],
    },
    director: {
      type: String,
      required: [true, 'El director es obligatorio'],
      trim: true,
    },
    genre: {
      type: String,
      required: [true, 'El género es obligatorio'],
      trim: true,
    },
    runtime: {
      type: Number,
      required: [true, 'La duración es obligatoria'],
      min: [1, 'La duración debe ser de al menos 1 minuto'],
    },
    synopsis: {
      type: String,
      required: [true, 'La sinopsis es obligatoria'],
      trim: true,
    },
    actors: {
      type: [String],
      required: [true, 'Los actores son obligatorios'],
    },
    rating: {
      type: Number,
      required: [true, 'La valoración es obligatoria'],
      min: [0, 'La valoración no puede ser inferior a 0'],
      max: [10, 'La valoración no puede ser superior a 10'],
    },
  },
  { timestamps: true }
);

/**
 * Modelo de Mongoose para la colección `movies`.
 * @type {import('mongoose').Model<Movie>}
 */
const Movie = mongoose.model('Movie', movieSchema);

module.exports = Movie;