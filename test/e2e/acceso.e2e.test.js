/**
 * E2E — control de acceso con la app entera: sin sesión, por rol y con tokens
 * no válidos (manipulados o caducados). Ver helpers/e2e.js.
 *
 * Reglas (README, "Sobre el control de acceso"):
 * - Sin sesión: las vistas privadas redirigen a / y la API responde 401.
 * - Usuario: no entra en la gestión (vistas → /dashboard, API → 403).
 * - Admin: no entra en las vistas del usuario (→ /movies) ni en sus favoritos (403).
 */

jest.mock("../../config/sqlDB", () => require("./helpers/sqlMemory").pool);

const jwt = require("jsonwebtoken");
const {
    app, request, Movie, setupE2E, createLucia, createAdmin, loginAs, movieData
} = require("./helpers/e2e");

setupE2E();

// Un ObjectId con formato válido (no hace falta que exista para probar los permisos)
const MOVIE_ID = "64b7f0c2a1b2c3d4e5f60718";

describe("Sin sesión", () => {
    test.each(["/", "/login", "/signup"])("la vista pública %s se ve (200)", async (url) => {
        const res = await request(app).get(url);
        expect(res.status).toBe(200);
    });

    test.each([
        "/dashboard", "/search", "/search/matrix", "/favorites", "/movies",
        `/movies/${MOVIE_ID}/edit`, "/profile", "/users", "/users/1/edit"
    ])("la vista privada %s redirige a /", async (url) => {
        const res = await request(app).get(url);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/");
    });

    test.each([
        ["get", "/api/movie/matrix"],
        ["post", "/api/movie"],
        ["put", `/api/movie/${MOVIE_ID}`],
        ["delete", `/api/movie/${MOVIE_ID}`],
        ["get", "/api/favorites"],
        ["post", "/api/favorites"],
        ["delete", "/api/favorites"],
        ["get", "/api/user"],
        ["put", "/api/user"],
        ["post", "/api/user"],
        ["put", "/api/user/1"],
        ["delete", "/api/user/1"]
    ])("%s %s responde 401", async (method, url) => {
        const res = await request(app)[method](url).send({});
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "No autenticado" });
    });
});

describe("Usuario (rol user)", () => {
    let lucia;

    beforeEach(async () => {
        await createLucia();
        lucia = await loginAs("lucia@filmapp.test");
    });

    test.each([`/movies/${MOVIE_ID}/edit`, "/users", "/users/1/edit"])(
        "la vista de admin %s le manda a su inicio (/dashboard)",
        async (url) => {
            const res = await lucia.get(url);
            expect(res.status).toBe(302);
            expect(res.headers.location).toBe("/dashboard");
        }
    );

    test("en /movies ve 'Mis películas', no la gestión", async () => {
        const res = await lucia.get("/movies");
        expect(res.status).toBe(200);
        expect(res.text).toContain("Mis películas");
        expect(res.text).not.toContain('action="/api/movie"');
    });

    test.each([
        ["post", "/api/movie"],
        ["put", `/api/movie/${MOVIE_ID}`],
        ["delete", `/api/movie/${MOVIE_ID}`],
        ["post", "/api/user"],
        ["put", "/api/user/1"],
        ["delete", "/api/user/1"]
    ])("la API de admin %s %s responde 403", async (method, url) => {
        const res = await lucia[method](url).send(movieData());
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ message: "No tienes permisos" });
    });

    test("un 403 no llega a tocar la BD: la película no se crea", async () => {
        await lucia.post("/api/movie").send(movieData()).expect(403);
        expect(await Movie.countDocuments()).toBe(0);
    });
});

describe("Admin (rol admin)", () => {
    let admin;

    beforeEach(async () => {
        await createAdmin();
        admin = await loginAs("admin@filmapp.test");
    });

    test.each(["/dashboard", "/search", "/search/matrix", "/favorites"])(
        "la vista de usuario %s le manda a su inicio (/movies)",
        async (url) => {
            const res = await admin.get(url);
            expect(res.status).toBe(302);
            expect(res.headers.location).toBe("/movies");
        }
    );

    test("en /movies ve la gestión de películas", async () => {
        const res = await admin.get("/movies");
        expect(res.status).toBe(200);
        expect(res.text).toContain('action="/api/movie"');
    });

    test.each([
        ["get", "/api/favorites"],
        ["post", "/api/favorites"],
        ["delete", "/api/favorites"]
    ])("los favoritos (%s %s) son solo del usuario: 403", async (method, url) => {
        const res = await admin[method](url).send({ movieId: "tt0133093", source: "omdb" });
        expect(res.status).toBe(403);
    });
});

describe("Tokens", () => {
    test("el token del login también vale en la cabecera Authorization (Postman)", async () => {
        await createLucia();
        const login = await request(app)
            .post("/api/login")
            .send({ email: "lucia@filmapp.test", password: "123456" });

        const res = await request(app)
            .get("/api/user")
            .set("Authorization", `Bearer ${login.body.token}`);

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe("lucia@filmapp.test");
    });

    test("token manipulado (firmado con otro secreto): 401 en la API y se borra la cookie", async () => {
        const fake = jwt.sign({ sub: 1, role: "admin" }, "otro_secreto");

        let res = await request(app).get("/api/user").set("Cookie", `token=${fake}`);
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token inválido o expirado" });
        expect(res.headers["set-cookie"].join(";")).toMatch(/token=;/);

        // En las vistas, de vuelta al inicio
        res = await request(app).get("/movies").set("Cookie", `token=${fake}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/");
    });

    test("token caducado: 401 en la API y redirección a / en las vistas", async () => {
        const expired = jwt.sign(
            { sub: 1, role: "user", exp: Math.floor(Date.now() / 1000) - 60 },
            process.env.JWT_SECRET
        );

        let res = await request(app).get("/api/favorites").set("Authorization", `Bearer ${expired}`);
        expect(res.status).toBe(401);

        res = await request(app).get("/dashboard").set("Cookie", `token=${expired}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/");
    });

    test("el logout funciona aunque el token ya no sea válido", async () => {
        const res = await request(app)
            .post("/api/logout")
            .set("Cookie", "token=basura")
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: "Sesión cerrada", redirectTo: "/" });
    });
});
