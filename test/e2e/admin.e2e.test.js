/**
 * E2E — flujos del administrador: gestión de películas (MongoDB) y de usuarios (SQL),
 * y cómo afectan a los usuarios (búsqueda y favoritos). Ver helpers/e2e.js.
 */

jest.mock("../../config/sqlDB", () => require("./helpers/sqlMemory").pool);

const {
    app, request, pool, Movie, PASSWORD,
    setupE2E, createLucia, createAdmin, loginAs, movieData, countFavorites
} = require("./helpers/e2e");

setupE2E();

describe("Admin: crear → editar → el usuario la encuentra y la guarda → borrar", () => {
    test("el ciclo de vida completo de una película de MongoDB", async () => {
        await createAdmin();
        await createLucia();

        // 1. El admin entra con el formulario y va directo a la gestión (/movies)
        const admin = request.agent(app);
        let res = await admin
            .post("/api/login")
            .type("form")
            .send({ email: "admin@filmapp.test", password: PASSWORD });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/movies");

        res = await admin.get("/movies");
        expect(res.status).toBe(200);
        expect(res.text).toContain("No hay películas en la base de datos.");

        // 2. Crear con datos no válidos: 400 con los errores y no se guarda nada
        res = await admin.post("/api/movie").send(movieData({ title: "", rating: 11 }));
        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(expect.arrayContaining([
            "El título es obligatorio",
            "La valoración no puede ser superior a 10"
        ]));
        expect(await Movie.countDocuments()).toBe(0);

        // 3. Crear bien: los actores llegan en texto (formulario) y se guardan como array
        res = await admin.post("/api/movie").send(movieData());
        expect(res.status).toBe(201);
        const movie = res.body.movie;
        expect(movie).toMatchObject({
            source: "mongo",
            title: "Película Local",
            actors: ["Actriz Uno", "Actor Dos"]
        });
        expect(await Movie.countDocuments()).toBe(1);

        res = await admin.get("/movies");
        expect(res.text).toContain("Película Local");
        expect(res.text).toContain(`href="/movies/${movie.id}/edit"`);

        // 4. Editar: el formulario sale relleno; la validación también se aplica al editar
        res = await admin.get(`/movies/${movie.id}/edit`);
        expect(res.status).toBe(200);
        expect(res.text).toContain('value="Película Local"');

        res = await admin.put(`/api/movie/${movie.id}`).send({ rating: -1 });
        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(["La valoración no puede ser inferior a 0"]);

        res = await admin.put(`/api/movie/${movie.id}`).send({ title: "Película Local (Director's Cut)", runtime: 120 });
        expect(res.status).toBe(200);
        expect(res.body.movie).toMatchObject({ title: "Película Local (Director's Cut)", runtime: 120, rating: 7.5 });

        // 5. El usuario la busca: OMDB no tiene nada con ese título, así que sale de MongoDB
        const lucia = await loginAs("lucia@filmapp.test");

        res = await lucia.get("/search").query({ title: "director's cut" });
        expect(res.status).toBe(200);
        expect(res.text).toContain("Película Local (Director's Cut)");
        expect(res.text).toContain(`value="${movie.id}"`);
        expect(res.text).toContain('value="mongo"');

        res = await lucia.get("/api/movie/local");
        expect(res.status).toBe(200);
        expect(res.body.movies).toHaveLength(1);
        expect(res.body.movies[0]).toMatchObject({ id: movie.id, source: "mongo" });

        // ...y la guarda en favoritos (junto con una de OMDB)
        await lucia.post("/api/favorites").send({ movieId: movie.id, source: "mongo" }).expect(201);
        await lucia.post("/api/favorites").send({ movieId: "tt0133093", source: "omdb" }).expect(201);

        res = await lucia.get("/api/favorites");
        expect(res.body.movies.map((m) => m.title).sort()).toEqual(["Película Local (Director's Cut)", "The Matrix"]);

        // 6. El admin la borra: se borra de MongoDB y también su favorito en SQL
        res = await admin.delete(`/api/movie/${movie.id}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ message: "Película eliminada", favoritesDeleted: 1 });
        expect(await Movie.countDocuments()).toBe(0);
        expect(await countFavorites()).toBe(1); // solo queda The Matrix (OMDB)

        // A la usuaria solo le queda la de OMDB, y la película ya no sale en la búsqueda
        res = await lucia.get("/api/favorites");
        expect(res.body.movies.map((m) => m.title)).toEqual(["The Matrix"]);

        res = await lucia.get("/api/movie/local");
        expect(res.status).toBe(404);

        // Borrarla otra vez: 404; un id con formato no válido: 400
        res = await admin.delete(`/api/movie/${movie.id}`);
        expect(res.status).toBe(404);
        res = await admin.delete("/api/movie/no-es-un-id");
        expect(res.status).toBe(400);
    });
});

describe("Admin: gestión de usuarios", () => {
    test("crear → cambiar el rol → borrar (y se borran sus favoritos)", async () => {
        await createAdmin();
        const admin = await loginAs("admin@filmapp.test");

        // 1. Da de alta un usuario: el admin NO pierde su sesión (no es un signup)
        let res = await admin
            .post("/api/user")
            .send({ name: "Marta", email: "Marta@FilmApp.test", password: "secreto1", role: "user" });
        expect(res.status).toBe(201);
        expect(res.body.user).not.toHaveProperty("password_hash");
        expect(res.headers["set-cookie"]).toBeUndefined();
        const martaId = res.body.user.id;

        res = await admin.get("/users");
        expect(res.status).toBe(200);
        expect(res.text).toContain("Marta");
        expect(res.text).toContain(`href="/users/${martaId}/edit"`);

        // Email repetido (con otras mayúsculas): 400
        res = await admin
            .post("/api/user")
            .send({ name: "Otra", email: "marta@filmapp.test", password: "secreto1", role: "user" });
        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(["Ese email ya está registrado"]);

        // 2. Marta puede entrar con la contraseña que le puso el admin, y guarda un favorito
        const marta = await loginAs("marta@filmapp.test", "secreto1");
        await marta.post("/api/favorites").send({ movieId: "tt0133093", source: "omdb" }).expect(201);

        // 3. El admin la hace admin: al volver a entrar va a la gestión de películas
        res = await admin.get(`/users/${martaId}/edit`);
        expect(res.status).toBe(200);
        expect(res.text).toContain('value="marta@filmapp.test"');

        res = await admin.put(`/api/user/${martaId}`).send({ name: "Marta", email: "marta@filmapp.test", role: "admin" });
        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe("admin");

        res = await request(app).post("/api/login").send({ email: "marta@filmapp.test", password: "secreto1" });
        expect(res.body.redirectTo).toBe("/movies");

        // 4. El admin la borra: sus favoritos desaparecen solos (ON DELETE CASCADE)
        res = await admin.delete(`/api/user/${martaId}`);
        expect(res.status).toBe(200);
        expect(await countFavorites()).toBe(0);

        res = await admin.get("/users");
        expect(res.text).not.toContain("marta@filmapp.test");

        // Ya no puede entrar, y su token antiguo (aún válido) ya no encuentra su usuario
        res = await request(app).post("/api/login").send({ email: "marta@filmapp.test", password: "secreto1" });
        expect(res.status).toBe(401);

        res = await marta.get("/api/user");
        expect(res.status).toBe(404);
    });

    test("el admin no puede borrarse ni quitarse el rol a sí mismo", async () => {
        const { id: adminId } = await createAdmin();
        const admin = await loginAs("admin@filmapp.test");

        let res = await admin.delete(`/api/user/${adminId}`);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("No puedes borrar tu propio usuario");

        res = await admin.put(`/api/user/${adminId}`).send({ name: "Admin Demo", email: "admin@filmapp.test", role: "user" });
        expect(res.status).toBe(400);

        const { rows } = await pool.query("SELECT role FROM users WHERE id = $1", [adminId]);
        expect(rows[0].role).toBe("admin");
    });
});
