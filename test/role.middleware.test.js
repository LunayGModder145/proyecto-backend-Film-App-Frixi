/**
 * Tests del middleware de rol (middlewares/role.middleware.js).
 */

const checkRole = require("../middlewares/role.middleware");

const mockRequest = ({ url = "/movies", user } = {}) => ({ originalUrl: url, user });

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
};

const user = { id: 1, role: "user" };
const admin = { id: 2, role: "admin" };

describe("checkRole", () => {
    test("rol permitido: deja pasar", () => {
        const next = jest.fn();

        checkRole(["admin"])(mockRequest({ user: admin }), mockResponse(), next);

        expect(next).toHaveBeenCalled();
    });

    test("varios roles permitidos: deja pasar a cualquiera de ellos", () => {
        const next = jest.fn();

        checkRole(["user", "admin"])(mockRequest({ user }), mockResponse(), next);

        expect(next).toHaveBeenCalled();
    });

    test("vista de admin abierta por un usuario: lo manda a /dashboard", () => {
        const res = mockResponse();
        const next = jest.fn();

        checkRole(["admin"])(mockRequest({ url: "/users", user }), res, next);

        expect(res.redirect).toHaveBeenCalledWith("/dashboard");
        expect(next).not.toHaveBeenCalled();
    });

    test("vista de usuario abierta por el admin: lo manda a /movies", () => {
        const res = mockResponse();

        checkRole(["user"])(mockRequest({ url: "/search", user: admin }), res, jest.fn());

        expect(res.redirect).toHaveBeenCalledWith("/movies");
    });

    test("API con rol sin permiso: 403 en JSON", () => {
        const res = mockResponse();

        checkRole(["user"])(mockRequest({ url: "/api/favorites", user: admin }), res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "No tienes permisos" });
        expect(res.redirect).not.toHaveBeenCalled();
    });

    test("sin usuario en una vista: redirige a /", () => {
        const res = mockResponse();

        checkRole(["user"])(mockRequest({ url: "/dashboard" }), res, jest.fn());

        expect(res.redirect).toHaveBeenCalledWith("/");
    });

    test("sin usuario en la API: 401 en JSON", () => {
        const res = mockResponse();

        checkRole(["admin"])(mockRequest({ url: "/api/movie" }), res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "No autenticado" });
    });
});
