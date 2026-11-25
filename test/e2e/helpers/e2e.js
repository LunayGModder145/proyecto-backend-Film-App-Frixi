/**
 * Utilidades comunes de los tests e2e.
 *
 * Los e2e recorren la app ENTERA (app.js: rutas, middlewares, controladores,
 * servicios, modelos y vistas Pug) con peticiones HTTP de supertest, como haría
 * el navegador. Lo único que cambia son las bases de datos y OMDB:
 * - PostgreSQL → pg-mem con docs/schema.sql (helpers/sqlMemory.js)
 * - MongoDB    → mongodb-memory-server (un mongod real, en memoria)
 * - OMDB       → fetch falso con un catálogo fijo (helpers/fakeOmdb.js)
 *
 * No tocan Supabase ni el Mongo real y no necesitan el .env.
 *
 * Cada archivo de test tiene que empezar con (jest.mock no se puede meter en un helper):
 *   jest.mock("../../config/sqlDB", () => require("./helpers/sqlMemory").pool);
 */

const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { pool, resetSql } = require("./sqlMemory");
const { fakeOmdbFetch } = require("./fakeOmdb");

// omdb.service.js exige una API key (aunque aquí no llega a salir a internet)
process.env.OMDB_API_KEY = process.env.OMDB_API_KEY || "clave_falsa_e2e";

const app = require("../../../app");
const Movie = require("../../../models/movie.model");
const userModel = require("../../../models/user.model");

const PASSWORD = "123456";

/**
 * Registra los beforeAll/afterAll/beforeEach que necesita cada archivo e2e:
 * arranca Mongo en memoria y, antes de cada test, vacía las dos BBDD y pone la OMDB falsa.
 */
const setupE2E = () => {
    let mongo;

    // La primera vez, mongodb-memory-server descarga el binario de mongod (puede tardar)
    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        // El driver de MongoDB (7.x) carga `os` con un import() dinámico, que Jest no
        // permite sin ESM experimental: los metadatos del handshake salen vacíos y el
        // servidor rechaza la conexión ("Missing required sub-document 'driver'").
        // Se le pasa `os` a mano. Solo pasa en Jest: la app real no lo necesita.
        await mongoose.connect(mongo.getUri(), { runtimeAdapters: { os: require("os") } });
    }, 120000);

    afterAll(async () => {
        await mongoose.disconnect();
        if (mongo) await mongo.stop();
    });

    beforeEach(async () => {
        resetSql();
        await Movie.deleteMany({});
        jest.spyOn(global, "fetch").mockImplementation(fakeOmdbFetch);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
};

/**
 * Crea un usuario directamente en la BD (el admin no se puede registrar por /api/signup).
 * @param {{name: string, email: string, role?: "user"|"admin", password?: string}} data
 */
const createUser = async ({ name, email, role = "user", password = PASSWORD }) => {
    const passwordHash = await bcrypt.hash(password, 4);
    return userModel.createUser({ name, email, passwordHash, role });
};

const createLucia = () => createUser({ name: "Lucía Pérez", email: "lucia@filmapp.test" });
const createAdmin = () => createUser({ name: "Admin Demo", email: "admin@filmapp.test", role: "admin" });

/**
 * "Navegador" con sesión: un agente de supertest guarda la cookie `token`
 * y la manda en las siguientes peticiones, igual que el navegador.
 */
const loginAs = async (email, password = PASSWORD) => {
    const agent = request.agent(app);
    const res = await agent.post("/api/login").send({ email, password });
    expect(res.status).toBe(200);
    return agent;
};

/** Película válida para POST /api/movie (actors en texto, como llega del formulario). */
const movieData = (extra = {}) => ({
    title: "Película Local",
    poster: "https://example.com/local.jpg",
    year: 2024,
    director: "Directora Local",
    genre: "Drama",
    runtime: 95,
    synopsis: "Una película que solo existe en nuestra base de datos.",
    actors: "Actriz Uno, Actor Dos",
    rating: 7.5,
    ...extra
});

/** Número de filas de la tabla favorites (para comprobar borrados en SQL). */
const countFavorites = async () => {
    const { rows } = await pool.query("SELECT COUNT(*) AS n FROM favorites");
    return Number(rows[0].n);
};

module.exports = {
    app,
    request,
    pool,
    Movie,
    PASSWORD,
    setupE2E,
    createUser,
    createLucia,
    createAdmin,
    loginAs,
    movieData,
    countFavorites
};
