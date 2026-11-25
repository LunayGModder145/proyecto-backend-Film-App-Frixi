/**
 * Tests del perfil: GET /api/user, PUT /api/user, el modelo de usuarios
 * (findById / updateUser) y la vista /profile.
 *
 * SQL está simulado: estos tests no tocan Supabase.
 */

// config/sqlDB se conecta a Supabase nada más requerirlo: se sustituye por un pool falso
jest.mock("../config/sqlDB", () => ({ query: jest.fn() }));

const path = require("path");
const pug = require("pug");
const jwt = require("jsonwebtoken");
const pool = require("../config/sqlDB");
const userModel = require("../models/user.model");
const { getUser, updateUser, validateProfile } = require("../controllers/user.controller");
const views = require("../controllers/views.controller");
const { JWT_SECRET } = require("../config/session");

const lucia = { id: 1, name: "Lucía Pérez", email: "lucia@filmapp.test", role: "user", created_at: new Date("2026-11-20") };

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    return res;
};

beforeEach(() => {
    jest.restoreAllMocks();
    pool.query.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("validateProfile", () => {
    test("limpia espacios y pasa el email a minúsculas", () => {
        const { data, errors } = validateProfile({ name: "  Lucía  ", email: " Lucia@FilmApp.test " });

        expect(errors).toEqual([]);
        expect(data).toEqual({ name: "Lucía", email: "lucia@filmapp.test" });
    });

    test("nombre y email vacíos: dos errores", () => {
        const { errors } = validateProfile({ name: "   ", email: "" });

        expect(errors).toEqual(["El nombre es obligatorio", "El email es obligatorio"]);
    });

    test("email sin formato válido", () => {
        expect(validateProfile({ name: "Lucía", email: "lucia@" }).errors).toEqual(["El email no es válido"]);
    });

    test("nombre de más de 100 caracteres (límite de la columna)", () => {
        expect(validateProfile({ name: "a".repeat(101), email: "a@b.es" }).errors[0]).toMatch(/100/);
    });

    test("valores que no son texto cuentan como vacíos", () => {
        expect(validateProfile({ name: 123, email: ["a@b.es"] }).errors).toHaveLength(2);
    });

    test("solo devuelve name y email (role e id se descartan)", () => {
        const { data } = validateProfile({ name: "Lucía", email: "a@b.es", role: "admin", id: 99 });

        expect(Object.keys(data)).toEqual(["name", "email"]);
    });
});

describe("GET /api/user", () => {
    test("200 con los datos del usuario de la sesión", async () => {
        jest.spyOn(userModel, "findById").mockResolvedValue(lucia);
        const res = mockResponse();

        await getUser({ user: { id: 1 } }, res);

        expect(userModel.findById).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ user: lucia });
    });

    test("404 si el usuario del token ya no existe", async () => {
        jest.spyOn(userModel, "findById").mockResolvedValue(null);
        const res = mockResponse();

        await getUser({ user: { id: 99 } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("500 si falla la base de datos", async () => {
        jest.spyOn(userModel, "findById").mockRejectedValue(new Error("BD caída"));
        const res = mockResponse();

        await getUser({ user: { id: 1 } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("PUT /api/user", () => {
    test("200: edita solo al usuario de la sesión y renueva el token con los datos nuevos", async () => {
        const updated = { ...lucia, name: "Lucía P.", email: "nueva@filmapp.test" };
        jest.spyOn(userModel, "updateUser").mockResolvedValue(updated);
        const res = mockResponse();

        await updateUser({ user: { id: 1 }, body: { name: "Lucía P.", email: "nueva@filmapp.test" } }, res);

        expect(userModel.updateUser).toHaveBeenCalledWith(1, { name: "Lucía P.", email: "nueva@filmapp.test" });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: "Perfil actualizado", user: updated });

        const [cookieName, token] = res.cookie.mock.calls[0];
        expect(cookieName).toBe("token");
        expect(jwt.verify(token, JWT_SECRET)).toMatchObject({ id: 1, name: "Lucía P.", email: "nueva@filmapp.test", role: "user" });
    });

    test("no se puede cambiar el rol ni editar a otro usuario desde el body", async () => {
        jest.spyOn(userModel, "updateUser").mockResolvedValue(lucia);
        const res = mockResponse();

        await updateUser({ user: { id: 1 }, body: { name: "Lucía", email: "lucia@filmapp.test", role: "admin", id: 2 } }, res);

        expect(userModel.updateUser).toHaveBeenCalledWith(1, { name: "Lucía", email: "lucia@filmapp.test" });
    });

    test("400 con la lista de errores si los datos no son válidos (no toca la BD)", async () => {
        jest.spyOn(userModel, "updateUser");
        const res = mockResponse();

        await updateUser({ user: { id: 1 }, body: { name: "", email: "mal" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Datos no válidos",
            errors: ["El nombre es obligatorio", "El email no es válido"]
        });
        expect(userModel.updateUser).not.toHaveBeenCalled();
    });

    test("400 si el email ya lo usa otro usuario (error 23505 de Postgres)", async () => {
        jest.spyOn(userModel, "updateUser").mockRejectedValue(Object.assign(new Error("duplicate"), { code: "23505" }));
        const res = mockResponse();

        await updateUser({ user: { id: 1 }, body: { name: "Lucía", email: "admin@filmapp.test" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Datos no válidos", errors: ["Ese email ya está registrado"] });
        expect(res.cookie).not.toHaveBeenCalled();
    });

    test("404 si el usuario ya no existe", async () => {
        jest.spyOn(userModel, "updateUser").mockResolvedValue(null);
        const res = mockResponse();

        await updateUser({ user: { id: 99 }, body: { name: "Lucía", email: "a@b.es" } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.cookie).not.toHaveBeenCalled();
    });

    test("500 si falla la base de datos", async () => {
        jest.spyOn(userModel, "updateUser").mockRejectedValue(new Error("BD caída"));
        const res = mockResponse();

        await updateUser({ user: { id: 1 }, body: { name: "Lucía", email: "a@b.es" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("Modelo de usuarios (consultas SQL)", () => {
    test("findById: consulta parametrizada y sin password_hash", async () => {
        pool.query.mockResolvedValue({ rows: [lucia] });

        const user = await userModel.findById(1);

        const [sql, params] = pool.query.mock.calls[0];
        expect(params).toEqual([1]);
        expect(sql).toMatch(/WHERE id = \$1/);
        expect(sql).not.toMatch(/password_hash/);
        expect(user).toEqual(lucia);
    });

    test("findById: null si no existe", async () => {
        pool.query.mockResolvedValue({ rows: [] });

        expect(await userModel.findById(99)).toBeNull();
    });

    test("updateUser: solo cambia name y email, parametrizado y sin devolver el hash", async () => {
        pool.query.mockResolvedValue({ rows: [lucia] });

        await userModel.updateUser(1, { name: "Lucía", email: "lucia@filmapp.test" });

        const [sql, params] = pool.query.mock.calls[0];
        expect(params).toEqual(["Lucía", "lucia@filmapp.test", 1]);
        expect(sql).toMatch(/SET name = \$1, email = \$2/);
        expect(sql).not.toMatch(/role\s*=/);
        expect(sql).not.toMatch(/password_hash/);
    });
});

describe("Vista /profile (views.getProfile)", () => {
    const render = (data) => pug.renderFile(path.join(__dirname, "..", "views", "profile.pug"), data);

    test("pinta los datos de la BD, no los del token", async () => {
        jest.spyOn(userModel, "findById").mockResolvedValue(lucia);
        const res = mockResponse();
        const tokenUser = { id: 1, name: "Nombre antiguo del token", role: "user" };

        await views.getProfile({ user: tokenUser }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const [view, data] = res.render.mock.calls[0];
        expect(view).toBe("profile");
        expect(data.profile).toEqual(lucia);

        const html = render(data);
        expect(html).toContain("Lucía Pérez");
        expect(html).toContain('value="lucia@filmapp.test"');
        expect(html).toContain("js-edit-profile");
    });

    test("500 y mensaje de error si falla la BD", async () => {
        jest.spyOn(userModel, "findById").mockRejectedValue(new Error("BD caída"));
        const res = mockResponse();

        await views.getProfile({ user: { id: 1, role: "user" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(render(res.render.mock.calls[0][1])).toContain("No se ha podido cargar tu perfil");
    });

    test("404 si el usuario ya no existe", async () => {
        jest.spyOn(userModel, "findById").mockResolvedValue(null);
        const res = mockResponse();

        await views.getProfile({ user: { id: 99, role: "user" } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(render(res.render.mock.calls[0][1])).toContain("No se ha encontrado tu usuario");
    });
});
