/**
 * Tests del controlador de películas: POST /api/movie y DELETE /api/movie/:id.
 *
 * El servicio de películas y el modelo de favoritos (SQL) están simulados con
 * jest.mock, así que estos tests no tocan MongoDB ni Supabase.
 */

// config/sqlDB se conecta a Supabase nada más requerirlo: se sustituye por un pool falso
jest.mock("../config/sqlDB", () => ({ query: jest.fn() }));
jest.mock("../services/movie.service");
jest.mock("../models/favorite.model");

const movieService = require("../services/movie.service");
const Favorite = require("../models/favorite.model");
const Movie = require("../models/movie.model");
const { createMovie, deleteMovie } = require("../controllers/movie.controller");

/** Crea un `res` falso de Express que guarda el status y el JSON enviados. */
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const VALID_ID = "64b7f0c2a1b2c3d4e5f60718";

const fakeMovie = {
    id: VALID_ID,
    source: "mongo",
    title: "The Matrix",
    poster: "https://example.com/matrix.jpg",
    year: 1999,
    director: "Lana Wachowski",
    genre: "Sci-Fi",
    runtime: 136,
    synopsis: "Un hacker descubre que el mundo es una simulación.",
    actors: ["Keanu Reeves"],
    rating: 8.7
};

beforeEach(() => {
    jest.clearAllMocks();
    // Silencia los console.error esperados de los casos de error
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    console.error.mockRestore();
});

describe("POST /api/movie (createMovie)", () => {
    test("201 y la película creada si los datos son válidos", async () => {
        movieService.createMovie.mockResolvedValue(fakeMovie);
        const req = { body: { title: "The Matrix" } };
        const res = mockResponse();

        await createMovie(req, res);

        expect(movieService.createMovie).toHaveBeenCalledWith(req.body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ movie: fakeMovie });
    });

    test("400 con la lista de errores si no pasa la validación del modelo", async () => {
        // Error de validación real de Mongoose: película sin ningún campo y año fuera de rango
        const validationError = await new Movie({ year: 1500 }).validate().catch((e) => e);
        movieService.createMovie.mockRejectedValue(validationError);
        const res = mockResponse();

        await createMovie({ body: { year: 1500 } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        const body = res.json.mock.calls[0][0];
        expect(body.message).toBe("Datos no válidos");
        expect(body.errors).toEqual(expect.arrayContaining([
            "El título es obligatorio",
            "La sinopsis es obligatoria",
            "La valoración es obligatoria",
            "El año no puede ser anterior a 1888"
        ]));
    });

    test("400 si un campo tiene un tipo incorrecto (CastError)", async () => {
        const castError = await new Movie({ ...fakeMovie, year: "abc" }).validate().catch((e) => e);
        movieService.createMovie.mockRejectedValue(castError);
        const res = mockResponse();

        await createMovie({ body: { year: "abc" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toBe("Datos no válidos");
    });

    test("500 si ocurre un error inesperado", async () => {
        movieService.createMovie.mockRejectedValue(new Error("Mongo caído"));
        const res = mockResponse();

        await createMovie({ body: {} }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Error al crear la película" });
    });
});

describe("DELETE /api/movie/:id (deleteMovie)", () => {
    test("200, borra la película y sus favoritos en SQL", async () => {
        movieService.deleteMovie.mockResolvedValue(fakeMovie);
        Favorite.removeByMovie.mockResolvedValue(2);
        const res = mockResponse();

        await deleteMovie({ params: { id: VALID_ID } }, res);

        expect(movieService.deleteMovie).toHaveBeenCalledWith(VALID_ID);
        expect(Favorite.removeByMovie).toHaveBeenCalledWith(VALID_ID, "mongo");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Película eliminada",
            movie: fakeMovie,
            favoritesDeleted: 2
        });
    });

    test("200 con favoritesDeleted 0 si nadie la tenía en favoritos", async () => {
        movieService.deleteMovie.mockResolvedValue(fakeMovie);
        Favorite.removeByMovie.mockResolvedValue(0);
        const res = mockResponse();

        await deleteMovie({ params: { id: VALID_ID } }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].favoritesDeleted).toBe(0);
    });

    test("200 aunque falle SQL (la película ya está borrada) y se registra el error", async () => {
        movieService.deleteMovie.mockResolvedValue(fakeMovie);
        Favorite.removeByMovie.mockRejectedValue(new Error("Supabase caído"));
        const res = mockResponse();

        await deleteMovie({ params: { id: VALID_ID } }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].favoritesDeleted).toBe(0);
        expect(console.error).toHaveBeenCalled();
    });

    test("404 y NO toca los favoritos si la película no existe", async () => {
        movieService.deleteMovie.mockResolvedValue(null);
        const res = mockResponse();

        await deleteMovie({ params: { id: VALID_ID } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(Favorite.removeByMovie).not.toHaveBeenCalled();
    });

    test("400 y no toca ninguna base de datos si el id no es válido", async () => {
        const res = mockResponse();

        await deleteMovie({ params: { id: "no-es-un-id" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(movieService.deleteMovie).not.toHaveBeenCalled();
        expect(Favorite.removeByMovie).not.toHaveBeenCalled();
    });

    test("500 si falla el borrado en MongoDB, sin tocar los favoritos", async () => {
        movieService.deleteMovie.mockRejectedValue(new Error("Mongo caído"));
        const res = mockResponse();

        await deleteMovie({ params: { id: VALID_ID } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(Favorite.removeByMovie).not.toHaveBeenCalled();
    });
});
