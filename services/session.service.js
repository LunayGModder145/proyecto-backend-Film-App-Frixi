/**
 * Servicio de sesión: abre la sesión firmando el JWT y guardándolo en la cookie `token`.
 *
 * Lo usan el login, el registro y Google (controllers/auth.controller.js) y la
 * edición del perfil (controllers/user.controller.js), que renueva el token para
 * que el nombre y el email nuevos se vean al momento.
 *
 * @module services/session
 */

const jwt = require('jsonwebtoken');
const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  COOKIE_OPTIONS,
  COOKIE_MAX_AGE,
} = require('../config/session');

/**
 * Firma el JWT y lo guarda en la cookie `token` (httpOnly).
 * El token tiene siempre los mismos datos: los que lee middlewares/auth.middleware.js
 * para rellenar `req.user`. Nunca incluye la contraseña.
 *
 * @param {Object} res Respuesta de Express.
 * @param {{id: number, email: string, name: string, role: string}} user
 * @returns {string} El token firmado.
 */
const createSession = (res, user) => {
  const token = jwt.sign(
    {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge: COOKIE_MAX_AGE });

  return token;
};

module.exports = { createSession };
