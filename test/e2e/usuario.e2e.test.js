/**
 * E2E — flujos del usuario: registro, login, búsqueda, detalle, favoritos,
 * perfil y logout, de principio a fin y con la app entera (ver helpers/e2e.js).
 */

jest.mock("../../config/sqlDB", () => require("./helpers/sqlMemory").pool);

const {
    app, request, pool, setupE2E, createLucia, loginAs, PASSWORD
} = require("./helpers/e2e");

setupE2E();

const MATRIX = { movieId: "tt0133093", source: "omdb" };

describe("Usuario: registro → buscar → favoritos → quitar → logout", () => {
    test("el flujo completo desde el navegador", async () => {
        const browser = request.agent(app);

        // 1. Se registra con el formulario (urlencoded, como lo manda el navegador)
        let res = await browser
            .post("/api/signup")
            .type("form")
            .send({ name: "Lucía Pérez", email: "Lucia@FilmApp.test", password: PASSWORD });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/dashboard");
        expect(res.headers["set-cookie"].join(";")).toMatch(/token=.+HttpOnly/i);

        // En SQL: email en minúsculas, rol user y contraseña cifrada (nunca en claro)
        const { rows: [saved] } = await pool.query("SELECT email, role, password_hash FROM users");
        expect(saved).toMatchObject({ email: "lucia@filmapp.test", role: "user" });
        expect(saved.password_hash).not.toBe(PASSWORD);
        expect(saved.password_hash).toMatch(/^\$2[aby]\$/);

        // 2. Ya tiene sesión: el dashboard la saluda por su nombre
        res = await browser.get("/dashboard");
        expect(res.status).toBe(200);
        expect(res.text).toContain("Hola, Lucía Pérez");

        // 3. Busca "matrix": salen las dos películas de OMDB con su botón de favoritos
        res = await browser.get("/search").query({ title: "matrix" });
        expect(res.status).toBe(200);
        expect(res.text).toContain("The Matrix");
        expect(res.text).toContain("The Matrix Reloaded");
        expect(res.text).toContain("★ Añadir a Favoritos");
        expect(res.text).not.toContain("★ En Mis películas");

        // La API devuelve el formato común de la app (el que no depende de la fuente)
        res = await browser.get("/api/movie/matrix");
        expect(res.status).toBe(200);
        expect(res.body.movies[0]).toEqual({
            id: "tt0133093",
            source: "omdb",
            title: "The Matrix",
            poster: "https://example.com/matrix.jpg",
            year: 1999,
            director: "Lana Wachowski, Lilly Wachowski",
            genre: "Action, Sci-Fi",
            runtime: 136,
            synopsis: "Un hacker descubre que el mundo en el que vive es una simulación.",
            actors: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
            rating: 8.7
        });
        // "N/A" de OMDB se convierte en null
        expect(res.body.movies[1].poster).toBeNull();

        // 4. Abre el detalle: sinopsis, actores y rating
        res = await browser.get("/search/" + encodeURIComponent("The Matrix"));
        expect(res.status).toBe(200);
        expect(res.text).toContain("Un hacker descubre que el mundo en el que vive es una simulación.");
        expect(res.text).toContain("Carrie-Anne Moss");
        expect(res.text).toContain("8.7");

        // 5. La añade a favoritos (lo hace public/js/favorites.js con fetch y JSON)
        res = await browser.post("/api/favorites").send(MATRIX);
        expect(res.status).toBe(201);

        // En SQL solo se guarda la relación usuario + película + fuente, no los datos
        const { rows: favs } = await pool.query("SELECT * FROM favorites");
        expect(favs).toHaveLength(1);
        expect(favs[0]).toMatchObject({ movie_id: "tt0133093", source: "omdb" });
        expect(Object.keys(favs[0]).sort()).toEqual(["created_at", "id", "movie_id", "source", "user_id"]);

        // Añadirla otra vez: 409, y sigue habiendo un solo favorito
        res = await browser.post("/api/favorites").send(MATRIX);
        expect(res.status).toBe(409);
        expect((await pool.query("SELECT * FROM favorites")).rows).toHaveLength(1);

        // Al volver a buscar, el botón sale ya desactivado
        res = await browser.get("/search").query({ title: "The Matrix" });
        expect(res.text).toContain("★ En Mis películas");

        // 6. "Mis películas": los datos se piden a su fuente original (OMDB)
        res = await browser.get("/api/favorites");
        expect(res.status).toBe(200);
        expect(res.body.movies).toHaveLength(1);
        expect(res.body.movies[0]).toMatchObject({ id: "tt0133093", title: "The Matrix", runtime: 136 });

        res = await browser.get("/movies");
        expect(res.status).toBe(200);
        expect(res.text).toContain("The Matrix");
        expect(res.text).toContain('data-id="tt0133093"');
        expect(res.text).toContain("Quitar");

        // 7. La quita de favoritos
        res = await browser.delete("/api/favorites").send(MATRIX);
        expect(res.status).toBe(200);

        res = await browser.delete("/api/favorites").send(MATRIX);
        expect(res.status).toBe(404);

        res = await browser.get("/api/favorites");
        expect(res.body.movies).toEqual([]);

        // 8. Cierra sesión con el botón del menú (formulario): vuelve al inicio sin sesión
        res = await browser.post("/api/logout").type("form").send({});
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/");

        res = await browser.get("/dashboard");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/");

        res = await browser.get("/api/favorites");
        expect(res.status).toBe(401);
    });

    test("busca algo que no existe en ninguna fuente: 'No hay resultados'", async () => {
        await createLucia();
        const browser = await loginAs("lucia@filmapp.test");

        let res = await browser.get("/search").query({ title: "zzz inexistente" });
        expect(res.status).toBe(200);
        expect(res.text).toContain('No hay resultados para "zzz inexistente"');

        res = await browser.get("/api/movie/zzz inexistente");
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ message: "No hay resultados", movies: [] });

        res = await browser.get("/search/zzz inexistente");
        expect(res.status).toBe(404);
    });

    test("los favoritos son de cada usuario: otro usuario no ve ni quita los míos", async () => {
        await createLucia();
        const lucia = await loginAs("lucia@filmapp.test");
        await lucia.post("/api/favorites").send(MATRIX).expect(201);

        // Otro usuario se registra con el formulario
        const pablo = request.agent(app);
        await pablo
            .post("/api/signup")
            .type("form")
            .send({ name: "Pablo", email: "pablo@filmapp.test", password: PASSWORD })
            .expect(302);

        let res = await pablo.get("/api/favorites");
        expect(res.body.movies).toEqual([]);

        res = await pablo.delete("/api/favorites").send(MATRIX);
        expect(res.status).toBe(404);

        res = await lucia.get("/api/favorites");
        expect(res.body.movies).toHaveLength(1);
    });
});

describe("Usuario: login", () => {
    beforeEach(createLucia);

    test("login con el formulario: redirige a /dashboard con la cookie de sesión", async () => {
        const browser = request.agent(app);

        let res = await browser
            .post("/api/login")
            .type("form")
            .send({ email: "LUCIA@filmapp.test", password: PASSWORD });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/dashboard");

        res = await browser.get("/dashboard");
        expect(res.status).toBe(200);
    });

    test("contraseña incorrecta: vuelve a pintar el login con el error y no abre sesión", async () => {
        const browser = request.agent(app);

        let res = await browser
            .post("/api/login")
            .type("form")
            .send({ email: "lucia@filmapp.test", password: "mala" });

        expect(res.status).toBe(401);
        expect(res.text).toContain("Credenciales inválidas");
        expect(res.headers["set-cookie"]).toBeUndefined();

        res = await browser.get("/dashboard");
        expect(res.headers.location).toBe("/");
    });

    test("email que no existe: mismo mensaje que con la contraseña mala (JSON)", async () => {
        const res = await request(app).post("/api/login").send({ email: "nadie@filmapp.test", password: PASSWORD });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Credenciales inválidas" });
    });

    test("registrarse con un email que ya existe (con otras mayúsculas): 400", async () => {
        const res = await request(app)
            .post("/api/signup")
            .type("form")
            .send({ name: "Otra Lucía", email: "LUCIA@FILMAPP.TEST", password: PASSWORD });

        expect(res.status).toBe(400);
        expect(res.text).toContain("Ese email ya está registrado");
        expect((await pool.query("SELECT * FROM users")).rows).toHaveLength(1);
    });
});

describe("Usuario: perfil", () => {
    test("edita su nombre y email: se guarda, el token se renueva y no puede cambiarse el rol", async () => {
        await createLucia();
        const browser = await loginAs("lucia@filmapp.test");

        let res = await browser.get("/profile");
        expect(res.status).toBe(200);
        expect(res.text).toContain('value="lucia@filmapp.test"');

        res = await browser
            .put("/api/user")
            .send({ name: "Lucía P. García", email: "lucia.garcia@filmapp.test", role: "admin" });
        expect(res.status).toBe(200);
        expect(res.body.user).toMatchObject({ name: "Lucía P. García", email: "lucia.garcia@filmapp.test", role: "user" });

        // El saludo del dashboard sale del token: si se ve el nombre nuevo, se ha renovado
        res = await browser.get("/dashboard");
        expect(res.text).toContain("Hola, Lucía P. García");

        res = await browser.get("/api/user");
        expect(res.body.user).toMatchObject({ email: "lucia.garcia@filmapp.test", role: "user" });

        // Con el email nuevo puede entrar; con el antiguo ya no
        await loginAs("lucia.garcia@filmapp.test");
        res = await request(app).post("/api/login").send({ email: "lucia@filmapp.test", password: PASSWORD });
        expect(res.status).toBe(401);
    });

    test("no puede ponerse el email de otro usuario", async () => {
        await createLucia();
        await request(app)
            .post("/api/signup")
            .type("form")
            .send({ name: "Pablo", email: "pablo@filmapp.test", password: PASSWORD })
            .expect(302);
        const browser = await loginAs("lucia@filmapp.test");

        const res = await browser.put("/api/user").send({ name: "Lucía", email: "Pablo@FilmApp.test" });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(["Ese email ya está registrado"]);
    });
});
