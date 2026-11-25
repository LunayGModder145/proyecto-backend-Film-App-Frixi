/**
 * Tests del middleware de sesión (middlewares/auth.middleware.js) y de que
 * las vistas privadas lo usan (routes/views.routes.js).
 *
 * jwt es el real: se firman tokens de verdad con el mismo secreto que la app.
 */

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const isAuthenticated = require("../middlewares/auth.middleware");
const { JWT_SECRET } = require("../config/session");

const lucia = { id: 1, email: "lucia@filmapp.test", name: "Lucía Pérez", role: "user" };

const signToken = (payload, options = { expiresIn: "1h" }) => jwt.sign(payload, JWT_SECRET, options);

/** `req` falso: `url` decide si es API (/api/...) o vista. */
const mockRequest = ({ url = "/dashboard", cookie, authorization } = {}) => ({
    originalUrl: url,
    cookies: cookie ? { token: cookie } : {},
    headers: authorization ? { authorization } : {}
});

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

describe("isAuthenticated", () => {
    test("token válido en la cookie: rellena req.user y deja pasar", () => {
        const req = mockRequest({ cookie: signToken({ sub: 1, ...lucia }) });
        const res = mockResponse();
        const next = jest.fn();

        isAuthenticated(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(lucia);
        expect(res.redirect).not.toHaveBeenCalled();
    });

    test("token válido en la cabecera Bearer (API): deja pasar", () => {
        const req = mockRequest({ url: "/api/favorites", authorization: `Bearer ${signToken(lucia)}` });
        const next = jest.fn();

        isAuthenticated(req, mockResponse(), next);

        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe(1);
    });

    test("sin token en una vista: redirige a /", () => {
        const res = mockResponse();
        const next = jest.fn();

        isAuthenticated(mockRequest(), res, next);

        expect(res.redirect).toHaveBeenCalledWith("/");
        expect(next).not.toHaveBeenCalled();
    });

    test("sin token en la API: 401 en JSON", () => {
        const res = mockResponse();

        isAuthenticated(mockRequest({ url: "/api/movie/matrix" }), res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "No autenticado" });
    });

    test("token manipulado: borra la cookie y redirige a /", () => {
        const fake = jwt.sign({ ...lucia, role: "admin" }, "otro_secreto");
        const res = mockResponse();
        const next = jest.fn();

        isAuthenticated(mockRequest({ cookie: fake }), res, next);

        expect(res.clearCookie).toHaveBeenCalledWith("token", expect.objectContaining({ path: "/" }));
        expect(res.redirect).toHaveBeenCalledWith("/");
        expect(next).not.toHaveBeenCalled();
    });

    test("token caducado en la API: borra la cookie y responde 401", () => {
        const expired = signToken({ ...lucia, exp: Math.floor(Date.now() / 1000) - 60 }, {});
        const res = mockResponse();

        isAuthenticated(mockRequest({ url: "/api/user", cookie: expired }), res, jest.fn());

        expect(res.clearCookie).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Token inválido o expirado" });
    });

    test("ya no hay usuario falso: sin token no se cuela ningún req.user", () => {
        const req = mockRequest();
        isAuthenticated(req, mockResponse(), jest.fn());

        expect(req.user).toBeUndefined();
    });
});

describe("Vistas: públicas y privadas (views.routes.js)", () => {
    // Controladores simulados: aquí solo se prueba qué rutas exigen sesión
    jest.mock("../controllers/views.controller", () => {
        const ok = (name) => (req, res) => res.status(200).send(`${name}:${req.user ? req.user.role : "anon"}`);
        return {
            getHome: ok("home"), getLogin: ok("login"), getSignup: ok("signup"),
            getDashboard: ok("dashboard"), getSearch: ok("search"), getDetail: ok("detail"),
            getMovies: ok("movies"), getEditMovie: ok("edit"), getProfile: ok("profile"), getUsers: ok("users"),
            getEditUser: ok("editUser")
        };
    });

    const buildApp = () => {
        const app = express();
        app.use(cookieParser());
        app.use("/", require("../routes/views.routes"));
        return app;
    };

    test.each(["/", "/login", "/signup"])("%s es pública (200 sin sesión)", async (url) => {
        const res = await request(buildApp()).get(url);
        expect(res.status).toBe(200);
    });

    test.each([
        "/dashboard", "/search", "/search/matrix", "/movies", "/favorites",
        "/movies/64b7f0c2a1b2c3d4e5f60718/edit", "/profile", "/users", "/users/3/edit"
    ])("%s sin sesión redirige a /", async (url) => {
        const res = await request(buildApp()).get(url);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/");
    });

    test("con sesión entra y req.user es el del token, no uno falso", async () => {
        const res = await request(buildApp())
            .get("/dashboard")
            .set("Cookie", `token=${signToken(lucia)}`);

        expect(res.status).toBe(200);
        expect(res.text).toBe("dashboard:user");
    });

});

describe("Control de acceso por rol en las vistas (views.routes.js)", () => {
    const admin = { id: 2, email: "admin@filmapp.test", name: "Admin Demo", role: "admin" };
    const EDIT = "/movies/64b7f0c2a1b2c3d4e5f60718/edit";

    const buildApp = () => {
        const app = express();
        app.use(cookieParser());
        app.use("/", require("../routes/views.routes"));
        return app;
    };
    const getAs = (user, url) => request(buildApp()).get(url).set("Cookie", `token=${signToken(user)}`);

    // [url, ¿entra el usuario?, ¿entra el admin?]
    test.each([
        ["/dashboard", true, false],
        ["/search", true, false],
        ["/search/matrix", true, false],
        ["/favorites", true, false],
        ["/movies", true, true],
        ["/profile", true, true],
        [EDIT, false, true],
        ["/users", false, true],
        ["/users/3/edit", false, true]
    ])("%s → usuario: %s, admin: %s", async (url, userAllowed, adminAllowed) => {
        const asUser = await getAs(lucia, url);
        const asAdmin = await getAs(admin, url);

        if (userAllowed) {
            expect(asUser.status).toBe(200);
        } else {
            expect(asUser.status).toBe(302);
            expect(asUser.headers.location).toBe("/dashboard");
        }

        if (adminAllowed) {
            expect(asAdmin.status).toBe(200);
        } else {
            expect(asAdmin.status).toBe(302);
            expect(asAdmin.headers.location).toBe("/movies");
        }
    });
});
