/**
 * Tests de la gestión de usuarios (admin):
 * - POST /api/user, PUT /api/user/:id y DELETE /api/user/:id (controlador)
 * - el modelo (findAll, updateUserByAdmin, deleteUser)
 * - las vistas /users y /users/:id/edit
 * - que las rutas de la API son solo para el admin
 *
 * SQL está simulado: estos tests no tocan Supabase.
 */

// config/sqlDB se conecta a Supabase nada más requerirlo: se sustituye por un pool falso
jest.mock("../config/sqlDB", () => ({ query: jest.fn() }));

const path = require("path");
const pug = require("pug");
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const pool = require("../config/sqlDB");
const userModel = require("../models/user.model");
const users = require("../controllers/user.controller");
const views = require("../controllers/views.controller");

const admin = { id: 2, name: "Admin Demo", email: "admin@filmapp.test", role: "admin" };
const lucia = { id: 1, name: "Lucía Pérez", email: "lucia@filmapp.test", role: "user", created_at: new Date("2026-11-20") };

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    return res;
};

const asAdmin = (extra = {}) => ({ user: admin, params: {}, body: {}, ...extra });

beforeEach(() => {
    jest.restoreAllMocks();
    pool.query.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/user (admin crea un usuario)", () => {
    const body = { name: "Nuevo", email: "Nuevo@FilmApp.test", password: "123456", role: "user" };

    test("201: guarda la contraseña cifrada, no devuelve el hash y NO abre sesión", async () => {
        jest.spyOn(userModel, "createUser").mockImplementation(async (data) => ({
            id: 3, name: data.name, email: data.email, role: data.role,
            password_hash: data.passwordHash, google_id: null, created_at: new Date()
        }));
        const res = mockResponse();

        await users.createUserByAdmin(asAdmin({ body }), res);

        const saved = userModel.createUser.mock.calls[0][0];
        expect(saved).toMatchObject({ name: "Nuevo", email: "nuevo@filmapp.test", role: "user" });
        expect(saved.passwordHash).not.toBe("123456");
        expect(await bcrypt.compare("123456", saved.passwordHash)).toBe(true);

        expect(res.status).toHaveBeenCalledWith(201);
        const { user } = res.json.mock.calls[0][0];
        expect(user).not.toHaveProperty("password_hash");
        expect(user).not.toHaveProperty("google_id");
        expect(res.cookie).not.toHaveBeenCalled();
    });

    test("el admin puede crear otro admin", async () => {
        jest.spyOn(userModel, "createUser").mockResolvedValue({ ...lucia, id: 4, role: "admin" });
        const res = mockResponse();

        await users.createUserByAdmin(asAdmin({ body: { ...body, role: "admin" } }), res);

        expect(userModel.createUser.mock.calls[0][0].role).toBe("admin");
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test("400 con todos los errores: nombre, email, rol y contraseña", async () => {
        jest.spyOn(userModel, "createUser");
        const res = mockResponse();

        await users.createUserByAdmin(asAdmin({ body: { name: "", email: "mal", password: "123", role: "jefe" } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].errors).toEqual([
            "El nombre es obligatorio",
            "El email no es válido",
            'El rol tiene que ser "user" o "admin"',
            "La contraseña tiene que tener al menos 6 caracteres"
        ]);
        expect(userModel.createUser).not.toHaveBeenCalled();
    });

    test("400 si el email ya existe", async () => {
        jest.spyOn(userModel, "createUser").mockRejectedValue(Object.assign(new Error("dup"), { code: "23505" }));
        const res = mockResponse();

        await users.createUserByAdmin(asAdmin({ body }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].errors).toEqual(["Ese email ya está registrado"]);
    });

    test("500 si falla la base de datos", async () => {
        jest.spyOn(userModel, "createUser").mockRejectedValue(new Error("BD caída"));
        const res = mockResponse();

        await users.createUserByAdmin(asAdmin({ body }), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("PUT /api/user/:id (admin edita un usuario)", () => {
    test("200: cambia nombre, email y rol; no renueva el token del admin", async () => {
        const updated = { ...lucia, role: "admin" };
        jest.spyOn(userModel, "updateUserByAdmin").mockResolvedValue(updated);
        const res = mockResponse();

        await users.updateUserByAdmin(asAdmin({ params: { id: "1" }, body: { name: "Lucía Pérez", email: "lucia@filmapp.test", role: "admin", password: "nueva" } }), res);

        expect(userModel.updateUserByAdmin).toHaveBeenCalledWith(1, { name: "Lucía Pérez", email: "lucia@filmapp.test", role: "admin" });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.cookie).not.toHaveBeenCalled();
    });

    test("la contraseña del body se ignora (no se puede cambiar desde aquí)", async () => {
        jest.spyOn(userModel, "updateUserByAdmin").mockResolvedValue(lucia);

        await users.updateUserByAdmin(asAdmin({ params: { id: "1" }, body: { ...lucia, password: "otra" } }), mockResponse());

        expect(userModel.updateUserByAdmin.mock.calls[0][1]).not.toHaveProperty("password");
    });

    test("400 si el admin intenta quitarse a sí mismo el rol de admin", async () => {
        jest.spyOn(userModel, "updateUserByAdmin");
        const res = mockResponse();

        await users.updateUserByAdmin(asAdmin({ params: { id: "2" }, body: { name: "Admin", email: "admin@filmapp.test", role: "user" } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].errors).toEqual(["No puedes quitarte a ti mismo el rol de administrador"]);
        expect(userModel.updateUserByAdmin).not.toHaveBeenCalled();
    });

    test("si el admin se edita a sí mismo (sin quitarse el rol), renueva su token", async () => {
        jest.spyOn(userModel, "updateUserByAdmin").mockResolvedValue({ ...admin, name: "Admin Nuevo" });
        const res = mockResponse();

        await users.updateUserByAdmin(asAdmin({ params: { id: "2" }, body: { name: "Admin Nuevo", email: "admin@filmapp.test", role: "admin" } }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.cookie).toHaveBeenCalledWith("token", expect.any(String), expect.any(Object));
    });

    test.each(["abc", "0", "-1", "1.5"])("id no válido (%s): 404 sin consultar la BD", async (id) => {
        jest.spyOn(userModel, "updateUserByAdmin");
        const res = mockResponse();

        await users.updateUserByAdmin(asAdmin({ params: { id }, body: lucia }), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(userModel.updateUserByAdmin).not.toHaveBeenCalled();
    });

    test("404 si el usuario no existe", async () => {
        jest.spyOn(userModel, "updateUserByAdmin").mockResolvedValue(null);
        const res = mockResponse();

        await users.updateUserByAdmin(asAdmin({ params: { id: "99" }, body: lucia }), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("400 si el email ya lo usa otro usuario", async () => {
        jest.spyOn(userModel, "updateUserByAdmin").mockRejectedValue(Object.assign(new Error("dup"), { code: "23505" }));
        const res = mockResponse();

        await users.updateUserByAdmin(asAdmin({ params: { id: "1" }, body: { ...lucia, email: "admin@filmapp.test" } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe("DELETE /api/user/:id (admin borra un usuario)", () => {
    test("200 y el usuario borrado", async () => {
        jest.spyOn(userModel, "deleteUser").mockResolvedValue({ id: 1, name: "Lucía Pérez", email: "lucia@filmapp.test" });
        const res = mockResponse();

        await users.deleteUserByAdmin(asAdmin({ params: { id: "1" } }), res);

        expect(userModel.deleteUser).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("400 si el admin intenta borrarse a sí mismo (no toca la BD)", async () => {
        jest.spyOn(userModel, "deleteUser");
        const res = mockResponse();

        await users.deleteUserByAdmin(asAdmin({ params: { id: "2" } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "No puedes borrar tu propio usuario" });
        expect(userModel.deleteUser).not.toHaveBeenCalled();
    });

    test("404 si no existe o el id no es válido", async () => {
        jest.spyOn(userModel, "deleteUser").mockResolvedValue(null);
        const res1 = mockResponse();
        const res2 = mockResponse();

        await users.deleteUserByAdmin(asAdmin({ params: { id: "99" } }), res1);
        await users.deleteUserByAdmin(asAdmin({ params: { id: "abc" } }), res2);

        expect(res1.status).toHaveBeenCalledWith(404);
        expect(res2.status).toHaveBeenCalledWith(404);
        expect(userModel.deleteUser).toHaveBeenCalledTimes(1);
    });

    test("500 si falla la base de datos", async () => {
        jest.spyOn(userModel, "deleteUser").mockRejectedValue(new Error("BD caída"));
        const res = mockResponse();

        await users.deleteUserByAdmin(asAdmin({ params: { id: "1" } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("Modelo de usuarios (consultas SQL de la gestión)", () => {
    test("findAll: no devuelve password_hash ni google_id", async () => {
        pool.query.mockResolvedValue({ rows: [lucia] });

        await userModel.findAll();

        const [sql] = pool.query.mock.calls[0];
        expect(sql).not.toMatch(/password_hash/);
        expect(sql).not.toMatch(/SELECT[^;]*\bgoogle_id\b\s*,/);
        expect(sql).toMatch(/has_google/);
    });

    test("updateUserByAdmin: cambia name, email y role (nunca la contraseña), parametrizado", async () => {
        pool.query.mockResolvedValue({ rows: [lucia] });

        await userModel.updateUserByAdmin(1, { name: "Lucía", email: "lucia@filmapp.test", role: "user" });

        const [sql, params] = pool.query.mock.calls[0];
        expect(sql).toMatch(/SET name = \$1, email = \$2, role = \$3/);
        expect(sql).not.toMatch(/password_hash/);
        expect(params).toEqual(["Lucía", "lucia@filmapp.test", "user", 1]);
    });

    test("deleteUser: DELETE parametrizado; null si no existía", async () => {
        pool.query.mockResolvedValue({ rows: [] });

        expect(await userModel.deleteUser(99)).toBeNull();
        const [sql, params] = pool.query.mock.calls[0];
        expect(sql).toMatch(/DELETE FROM users\s+WHERE id = \$1/);
        expect(params).toEqual([99]);
    });
});

describe("Vistas /users y /users/:id/edit", () => {
    const render = (view, data) => pug.renderFile(path.join(__dirname, "..", "views", `${view}.pug`), data);

    test("/users pinta la lista real de la BD, y el admin no tiene botón de borrarse", async () => {
        jest.spyOn(userModel, "findAll").mockResolvedValue([lucia, { ...admin, created_at: new Date() }]);
        const res = mockResponse();

        await views.getUsers({ user: admin }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const html = render("users", res.render.mock.calls[0][1]);
        expect(html).toContain("Lucía Pérez");
        expect(html).toContain('href="/users/1/edit"');
        expect(html).toContain('data-id="1"');
        expect(html).not.toContain('class="btn btn--danger js-delete-user" type="button" data-id="2"');
        expect(html).toContain("(tú)");
        // El formulario de alta va a la API del admin, no a /api/signup (que abriría sesión)
        expect(html).toContain('action="/api/user"');
        expect(html).not.toContain("/api/signup");
    });

    test("/users: 500 y mensaje si falla la BD", async () => {
        jest.spyOn(userModel, "findAll").mockRejectedValue(new Error("BD caída"));
        const res = mockResponse();

        await views.getUsers({ user: admin }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(render("users", res.render.mock.calls[0][1])).toContain("No se han podido cargar los usuarios");
    });

    test("/users/:id/edit: formulario relleno, sin contraseña y con el rol seleccionado", async () => {
        jest.spyOn(userModel, "findById").mockResolvedValue({ ...lucia, role: "admin" });
        const res = mockResponse();

        await views.getEditUser({ user: admin, params: { id: "1" } }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const html = render("editUser", res.render.mock.calls[0][1]);
        expect(html).toContain('value="lucia@filmapp.test"');
        expect(html).toContain('action="/api/user/1"');
        expect(html).toContain('data-method="PUT"');
        expect(html).not.toContain('name="password"');
        expect(html).toMatch(/<option value="admin" selected/);
    });

    test("/users/:id/edit: 404 si no existe o el id no es válido", async () => {
        jest.spyOn(userModel, "findById").mockResolvedValue(null);
        const res1 = mockResponse();
        const res2 = mockResponse();

        await views.getEditUser({ user: admin, params: { id: "99" } }, res1);
        await views.getEditUser({ user: admin, params: { id: "abc" } }, res2);

        expect(res1.status).toHaveBeenCalledWith(404);
        expect(res2.status).toHaveBeenCalledWith(404);
        expect(userModel.findById).toHaveBeenCalledTimes(1);
        expect(render("editUser", res1.render.mock.calls[0][1])).toContain("El usuario no existe");
    });
});

describe("Rutas de la API: la gestión es solo para el admin (user.routes.js)", () => {
    const buildApp = (sessionUser) => {
        const app = express();
        app.use(express.json());
        // Simula isAuthenticated: aquí solo se prueba checkRole en cada ruta
        app.use((req, res, next) => { req.user = sessionUser; next(); });
        app.use("/api", require("../routes/user.routes"));
        return app;
    };

    test.each([
        ["post", "/api/user"],
        ["put", "/api/user/1"],
        ["delete", "/api/user/1"]
    ])("%s %s con un usuario normal: 403", async (method, url) => {
        jest.spyOn(userModel, "createUser");
        jest.spyOn(userModel, "updateUserByAdmin");
        jest.spyOn(userModel, "deleteUser");

        const res = await request(buildApp({ id: 1, role: "user" }))[method](url).send({});

        expect(res.status).toBe(403);
        expect(userModel.createUser).not.toHaveBeenCalled();
        expect(userModel.updateUserByAdmin).not.toHaveBeenCalled();
        expect(userModel.deleteUser).not.toHaveBeenCalled();
    });

    test("PUT /api/user (perfil propio, sin id) sigue funcionando para un usuario normal", async () => {
        jest.spyOn(userModel, "updateUser").mockResolvedValue(lucia);

        const res = await request(buildApp({ id: 1, role: "user" }))
            .put("/api/user")
            .send({ name: "Lucía Pérez", email: "lucia@filmapp.test" });

        expect(res.status).toBe(200);
        expect(userModel.updateUser).toHaveBeenCalledWith(1, { name: "Lucía Pérez", email: "lucia@filmapp.test" });
    });
});
