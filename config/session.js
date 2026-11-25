/**
 * Configuración de la sesión (JWT en la cookie `token`).
 * La usan controllers/auth.controller.js (abrir y cerrar sesión) y
 * middlewares/auth.middleware.js (comprobarla), para que los dos usen
 * siempre el mismo secreto y las mismas opciones de la cookie.
 *
 * @module config/session
 */

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

/**
 * Opciones de la cookie `token`. Crearla y borrarla tiene que hacerse con las mismas:
 * el navegador solo borra la cookie si coinciden (path, sameSite, secure…).
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Página de inicio de cada rol (README, "Formulario de acceso"):
 * el administrador a /movies (gestión) y el usuario a /dashboard.
 * La usan el login (adónde ir tras entrar) y checkRole (adónde mandar
 * a quien abre una vista que no es de su rol).
 *
 * @param {"user"|"admin"} role
 * @returns {string}
 */
const getHomeByRole = (role) => (role === 'admin' ? '/movies' : '/dashboard');

module.exports = {
  getHomeByRole,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  COOKIE_OPTIONS,
  COOKIE_MAX_AGE,
};
