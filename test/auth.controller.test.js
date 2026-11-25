/**
 * Tests del login: POST /api/login y la redirección según el rol.
 *
 * El modelo de usuarios (SQL) y la config de Google están simulados con jest.mock,
 * así que estos tests no tocan Supabase. bcrypt y jwt son los reales.
 */

// config/sqlDB se conecta a Supabase nada más requerirlo: se sustituye por un pool falso
jest.mock("../config/sqlDB", () => ({ query: jest.fn() }));
jest.mock("../models/user.model");
jest.mock("../config/oauth", () => ({
    getGoogleAuthUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
    getGoogleUserProfile: jest.fn()
}));

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const { login, logout, signup, getRedirectByRole } = require("../controllers/auth.controller");

const { JWT_SECRET } = require("../config/session");
const PASSWORD = "123456";
let passwordHash;

/** `req` falso: `json` indica si llega como JSON (API) o como formulario (vista). */
const mockRequest = (body, { json = false } = {}) => ({
    body,
    is: (type) => (json && type === "application/json" ? type : false)
});

/** `res` falso de Express que guarda lo que se envía. */
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

const dbUser = (role) => ({
    id: role === "admin" ? 2 : 1,
    name: role === "admin" ? "Admin Demo" : "Lucía Pérez",
    email: role === "admin" ? "admin@filmapp.test" : "lucia@filmapp.test",
    password_hash: passwordHash,
    google_id: null,
    role
});

/** Devuelve el contenido del JWT guardado en la cookie `token`. */
const tokenFromCookie = (res) => {
    const [name, token, options] = res.cookie.mock.calls[0];
    expect(name).toBe("token");
    expect(options.httpOnly).toBe(true);
    return jwt.verify(token, JWT_SECRET);
};

beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    console.error.mockRestore();
});

describe("getRedirectByRole", () => {
    test("el usuario va a /dashboard", () => {
        expect(getRedirectByRole("user")).toBe("/dashboard");
    });

    test("el administrador va a /movies", () => {
        expect(getRedirectByRole("admin")).toBe("/movies");
    });
});

describe("POST /api/login (formulario de la vista)", () => {
    test("usuario: abre sesión y redirige a /dashboard", async () => {
        userModel.findByEmail.mockResolvedValue(dbUser("user"));
        const res = mockResponse();

        await login(mockRequest({ email: " lucia@filmapp.test ", password: PASSWORD }), res);

        expect(userModel.findByEmail).toHaveBeenCalledWith("lucia@filmapp.test");
        expect(res.redirect).toHaveBeenCalledWith("/dashboard");
        const payload = tokenFromCookie(res);
        expect(payload).toMatchObject({ id: 1, email: "lucia@filmapp.test", name: "Lucía Pérez", role: "user" });
        expect(payload).not.toHaveProperty("password_hash");
    });

    test("admin: abre sesión y redirige a /movies", async () => {
        userModel.findByEmail.mockResolvedValue(dbUser("admin"));
        const res = mockResponse();

        await login(mockRequest({ email: "admin@filmapp.test", password: PASSWORD }), res);

        expect(res.redirect).toHaveBeenCalledWith("/movies");
        expect(tokenFromCookie(res).role).toBe("admin");
    });

    test("faltan campos: 400 y vuelve a pintar login con el error", async () => {
        const res = mockResponse();

        await login(mockRequest({ email: "lucia@filmapp.test" }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.render).toHaveBeenCalledWith("login", expect.objectContaining({ error: "Email y contraseña obligatorios" }));
        expect(userModel.findByEmail).not.toHaveBeenCalled();
    });

    test("contraseña incorrecta: 401, sin cookie y con el error en la vista", async () => {
        userModel.findByEmail.mockResolvedValue(dbUser("user"));
        const res = mockResponse();

        await login(mockRequest({ email: "lucia@filmapp.test", password: "otra" }), res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.render).toHaveBeenCalledWith("login", expect.objectContaining({ error: "Credenciales inválidas" }));
        expect(res.cookie).not.toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
    });

    test("email que no existe: 401 con el mismo mensaje", async () => {
        userModel.findByEmail.mockResolvedValue(null);
        const res = mockResponse();

        await login(mockRequest({ email: "nadie@filmapp.test", password: PASSWORD }), res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.render).toHaveBeenCalledWith("login", expect.objectContaining({ error: "Credenciales inválidas" }));
    });

    test("usuario solo de Google (sin contraseña): 401", async () => {
        userModel.findByEmail.mockResolvedValue({ ...dbUser("user"), password_hash: null, google_id: "g-123" });
        const res = mockResponse();

        await login(mockRequest({ email: "lucia@filmapp.test", password: PASSWORD }), res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.cookie).not.toHaveBeenCalled();
    });

    test("error de la base de datos: 500 con el error en la vista", async () => {
        userModel.findByEmail.mockRejectedValue(new Error("BD caída"));
        const res = mockResponse();

        await login(mockRequest({ email: "lucia@filmapp.test", password: PASSWORD }), res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.render).toHaveBeenCalledWith("login", expect.objectContaining({ error: "Error interno en el login" }));
    });
});

describe("POST /api/login (JSON)", () => {
    test("login correcto: 200 con el usuario, redirectTo y token", async () => {
        userModel.findByEmail.mockResolvedValue(dbUser("admin"));
        const res = mockResponse();

        await login(mockRequest({ email: "admin@filmapp.test", password: PASSWORD }, { json: true }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.redirectTo).toBe("/movies");
        expect(body.user).toEqual({ id: 2, name: "Admin Demo", email: "admin@filmapp.test", role: "admin" });
        expect(jwt.verify(body.token, JWT_SECRET).role).toBe("admin");
        expect(res.redirect).not.toHaveBeenCalled();
    });

    test("credenciales inválidas: 401 en JSON (no pinta la vista)", async () => {
        userModel.findByEmail.mockResolvedValue(null);
        const res = mockResponse();

        await login(mockRequest({ email: "nadie@filmapp.test", password: PASSWORD }, { json: true }), res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Credenciales inválidas" });
        expect(res.render).not.toHaveBeenCalled();
    });

    test("email que no es texto: 400 en vez de romper con 500", async () => {
        const res = mockResponse();

        await login(mockRequest({ email: 123, password: PASSWORD }, { json: true }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Email y contraseña obligatorios" });
    });
});

describe("Token igual en login y signup", () => {
    test("signup guarda en el token también el nombre (como el login)", async () => {
        userModel.createUser.mockResolvedValue({ id: 3, name: "Nueva", email: "nueva@filmapp.test", role: "user" });
        const res = mockResponse();

        await signup(mockRequest({ name: "Nueva", email: "nueva@filmapp.test", password: PASSWORD }), res);

        expect(res.redirect).toHaveBeenCalledWith("/dashboard");
        expect(tokenFromCookie(res)).toMatchObject({ id: 3, name: "Nueva", role: "user" });
    });
});

describe("POST /api/logout", () => {
    test("formulario (botón Salir): borra la cookie token y redirige a /", () => {
        const res = mockResponse();

        logout(mockRequest({}), res);

        expect(res.clearCookie).toHaveBeenCalledWith("token", expect.objectContaining({ httpOnly: true, path: "/" }));
        expect(res.redirect).toHaveBeenCalledWith("/");
        expect(res.json).not.toHaveBeenCalled();
    });

    test("JSON: borra la cookie y responde 200 con redirectTo", () => {
        const res = mockResponse();

        logout(mockRequest({}, { json: true }), res);

        expect(res.clearCookie).toHaveBeenCalledWith("token", expect.any(Object));
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: "Sesión cerrada", redirectTo: "/" });
        expect(res.redirect).not.toHaveBeenCalled();
    });

    test("funciona sin sesión (no necesita req.user ni token)", () => {
        const res = mockResponse();
        const req = mockRequest(undefined);

        expect(() => logout(req, res)).not.toThrow();
        expect(res.redirect).toHaveBeenCalledWith("/");
    });

    test("borra la cookie con las mismas opciones con las que se creó", async () => {
        userModel.findByEmail.mockResolvedValue(dbUser("user"));
        const loginRes = mockResponse();
        await login(mockRequest({ email: "lucia@filmapp.test", password: PASSWORD }), loginRes);
        const { maxAge, ...createdOptions } = loginRes.cookie.mock.calls[0][2];

        const res = mockResponse();
        logout(mockRequest({}), res);

        expect(maxAge).toBeGreaterThan(0);
        expect(res.clearCookie.mock.calls[0][1]).toEqual(createdOptions);
    });
});
