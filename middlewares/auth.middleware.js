/**
 * Middleware de sesión: comprueba que hay una sesión abierta (JWT válido)
 * y rellena `req.user` con los datos del token.
 *
 * El token se busca en la cookie `token` (la que crean login, signup y Google)
 * o en la cabecera `Authorization: Bearer <token>` (para Postman o la API).
 *
 * Si no hay sesión, o el token es inválido o ha caducado:
 * - las rutas de la API responden 401 en JSON,
 * - las vistas redirigen al inicio (/), como pide el README.
 *
 * Va siempre ANTES de checkRole, que necesita el `req.user` que pone este.
 *
 * @module middlewares/auth
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET, COOKIE_OPTIONS } = require('../config/session');

/**
 * Saca el token de la cookie o, si no hay, de la cabecera Authorization.
 *
 * @param {import('express').Request} req
 * @returns {string|null} El token, o null si no viene.
 */
const getToken = (req) => {
  const cookieToken = req.cookies && req.cookies.token;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers && req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() || null;
  }
  return null;
};

/**
 * Respuesta cuando no hay sesión válida: 401 en la API, redirección en las vistas.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} message Mensaje del JSON (solo en la API).
 */
const denyAccess = (req, res, message) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(401).json({ message });
  }
  return res.redirect('/');
};

/**
 * Verifica el JWT y, si es válido, pone en `req.user` el id, email, nombre y rol
 * y pasa al siguiente middleware. Si está caducado o manipulado, borra la cookie.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const isAuthenticated = (req, res, next) => {
  const token = getToken(req);

  if (!token) {
    return denyAccess(req, res, 'No autenticado');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
    return next();
  } catch (err) {
    // Token caducado o manipulado: se borra la cookie para que el navegador
    // no lo siga enviando en cada petición
    res.clearCookie('token', COOKIE_OPTIONS);
    return denyAccess(req, res, 'Token inválido o expirado');
  }
};

module.exports = isAuthenticated;
