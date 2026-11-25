/**
 * Tests de movieService.createMovie.
 *
 * Movie.create está simulado: se comprueba QUÉ datos le llegan a Mongo
 * (campos permitidos y actors convertido en array) sin necesitar la BBDD.
 */

// Por si el servicio llega a cargar config/sqlDB (se conecta a Supabase al requerirlo)
jest.mock("../config/sqlDB", () => ({ query: jest.fn() }));

const Movie = require("../models/movie.model");
const movieService = require("../services/movie.service");

const validData = {
    title: "The Matrix",
    poster: "https://example.com/matrix.jpg",
    year: 1999,
    director: "Lana Wachowski",
    genre: "Sci-Fi",
    runtime: 136,
    synopsis: "Un hacker descubre que el mundo es una simulación.",
    actors: ["Keanu Reeves", "Carrie-Anne Moss"],
    rating: 8.7
};

let createSpy;

beforeEach(() => {
    // Simula Movie.create: construye el documento (sin guardarlo) y lo devuelve
    createSpy = jest.spyOn(Movie, "create").mockImplementation(async (data) => new Movie(data));
});

afterEach(() => {
    createSpy.mockRestore();
});

describe("movieService.createMovie", () => {
    test("devuelve la película en el formato común con source 'mongo'", async () => {
        const movie = await movieService.createMovie(validData);

        expect(movie).toMatchObject({ ...validData, source: "mongo" });
        expect(typeof movie.id).toBe("string");
    });

    test("convierte actors de texto separado por comas a array", async () => {
        await movieService.createMovie({ ...validData, actors: " Keanu Reeves ,Carrie-Anne Moss, " });

        const saved = createSpy.mock.calls[0][0];
        expect(saved.actors).toEqual(["Keanu Reeves", "Carrie-Anne Moss"]);
    });

    test("deja actors tal cual si ya es un array", async () => {
        await movieService.createMovie(validData);

        expect(createSpy.mock.calls[0][0].actors).toEqual(validData.actors);
    });

    test("ignora campos que no son del modelo (_id, createdAt...)", async () => {
        await movieService.createMovie({ ...validData, _id: "hackeado", createdAt: "2000-01-01", isAdmin: true });

        const saved = createSpy.mock.calls[0][0];
        expect(saved).not.toHaveProperty("_id");
        expect(saved).not.toHaveProperty("createdAt");
        expect(saved).not.toHaveProperty("isAdmin");
    });
});
