/**
 * Tests de la vista de gestión de películas (admin):
 * - movieService.getAllMovies y updateMovie (actors en texto -> array)
 * - views.controller: getMovies (admin) y getEditMovie
 *
 * MongoDB y SQL están simulados: estos tests no tocan ninguna base de datos.
 */

// config/sqlDB se conecta a Supabase nada más requerirlo: se sustituye por un pool falso
jest.mock("../config/sqlDB", () => ({ query: jest.fn() }));

const path = require("path");
const pug = require("pug");
const Movie = require("../models/movie.model");
const movieService = require("../services/movie.service");
const views = require("../controllers/views.controller");

const VALID_ID = "64b7f0c2a1b2c3d4e5f60718";
const admin = { id: 2, name: "Admin Demo", role: "admin" };

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
    actors: ["Keanu Reeves", "Carrie-Anne Moss"],
    rating: 8.7
};

/** `res` falso de Express que guarda el status, la vista y sus datos. */
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    return res;
};

/** Simula una consulta de Mongoose encadenada (find().sort().lean(), findById().lean()...). */
const mockQuery = (result) => {
    const query = {
        sort: jest.fn(() => query),
        lean: jest.fn(() => Promise.resolve(result))
    };
    return query;
};

beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("movieService.getAllMovies", () => {
    test("devuelve todas las películas normalizadas, de la más reciente a la más antigua", async () => {
        const query = mockQuery([{ _id: VALID_ID, ...fakeMovie }]);
        jest.spyOn(Movie, "find").mockReturnValue(query);

        const movies = await movieService.getAllMovies();

        expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(movies).toEqual([fakeMovie]);
    });

    test("devuelve [] si no hay películas", async () => {
        jest.spyOn(Movie, "find").mockReturnValue(mockQuery([]));

        expect(await movieService.getAllMovies()).toEqual([]);
    });
});

describe("movieService.updateMovie", () => {
    test("convierte actors de texto a array (el formulario de editar lo manda como texto)", async () => {
        const spy = jest.spyOn(Movie, "findByIdAndUpdate").mockReturnValue(mockQuery({ _id: VALID_ID, ...fakeMovie }));

        await movieService.updateMovie(VALID_ID, { actors: "Keanu Reeves, Carrie-Anne Moss" });

        expect(spy.mock.calls[0][1].actors).toEqual(["Keanu Reeves", "Carrie-Anne Moss"]);
    });

    test("no añade actors si no viene en los datos", async () => {
        const spy = jest.spyOn(Movie, "findByIdAndUpdate").mockReturnValue(mockQuery({ _id: VALID_ID, ...fakeMovie }));

        await movieService.updateMovie(VALID_ID, { year: 2000 });

        expect(spy.mock.calls[0][1]).toEqual({ year: 2000 });
    });
});

describe("GET /movies como admin (views.getMovies)", () => {
    test("200 y pinta adminMovies con todas las películas", async () => {
        jest.spyOn(movieService, "getAllMovies").mockResolvedValue([fakeMovie]);
        const res = mockResponse();

        await views.getMovies({ user: admin }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.render).toHaveBeenCalledWith("adminMovies", expect.objectContaining({ movies: [fakeMovie], error: null }));
    });

    test("500 y un mensaje de error si falla MongoDB", async () => {
        jest.spyOn(movieService, "getAllMovies").mockRejectedValue(new Error("Mongo caído"));
        const res = mockResponse();

        await views.getMovies({ user: admin }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        const data = res.render.mock.calls[0][1];
        expect(data.movies).toEqual([]);
        expect(data.error).toMatch(/No se han podido cargar/);
    });
});

describe("GET /movies/:id/edit (views.getEditMovie)", () => {
    test("200 y pinta editMovie con la película", async () => {
        jest.spyOn(movieService, "getMovieBySource").mockResolvedValue(fakeMovie);
        const res = mockResponse();

        await views.getEditMovie({ params: { id: VALID_ID }, user: admin }, res);

        expect(movieService.getMovieBySource).toHaveBeenCalledWith(VALID_ID, "mongo");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.render).toHaveBeenCalledWith("editMovie", expect.objectContaining({ movie: fakeMovie }));
    });

    test("404 si la película no existe", async () => {
        jest.spyOn(movieService, "getMovieBySource").mockResolvedValue(null);
        const res = mockResponse();

        await views.getEditMovie({ params: { id: VALID_ID }, user: admin }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("404 sin consultar la BBDD si el id no tiene formato de MongoDB", async () => {
        const spy = jest.spyOn(movieService, "getMovieBySource");
        const res = mockResponse();

        await views.getEditMovie({ params: { id: "hola" }, user: admin }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(spy).not.toHaveBeenCalled();
    });

    test("500 si falla MongoDB", async () => {
        jest.spyOn(movieService, "getMovieBySource").mockRejectedValue(new Error("Mongo caído"));
        const res = mockResponse();

        await views.getEditMovie({ params: { id: VALID_ID }, user: admin }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("Plantillas Pug", () => {
    const render = (view, data) => pug.renderFile(path.join(__dirname, "..", "views", `${view}.pug`), { user: admin, ...data });

    test("adminMovies pinta las tarjetas con Editar y Eliminar", () => {
        const html = render("adminMovies", { movies: [fakeMovie], error: null });

        expect(html).toContain(`href="/movies/${VALID_ID}/edit"`);
        expect(html).toContain(`data-id="${VALID_ID}"`);
        expect(html).toContain("js-movie-form");
    });

    test("editMovie pinta el formulario relleno con PUT", () => {
        const html = render("editMovie", { movie: fakeMovie, error: null });

        expect(html).toContain('data-method="PUT"');
        expect(html).toContain(`action="/api/movie/${VALID_ID}"`);
        expect(html).toContain('value="The Matrix"');
        expect(html).toContain('value="Keanu Reeves, Carrie-Anne Moss"');
    });

    test("editMovie muestra un aviso si la película no existe", () => {
        const html = render("editMovie", { movie: null, error: null });

        expect(html).toContain("La película no existe");
    });
});
