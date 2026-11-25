/**
 * Middleware de rol: deja pasar solo a los roles indicados.
 * Uso: checkRole(['admin']) o checkRole(['user', 'admin']).
 *
 * Va siempre DESPUÉS de isAuthenticated, que rellena `req.user` con el token.
 *
 * - API (/api/...): 401 si no hay usuario, 403 si su rol no tiene permiso (JSON).
 * - Vistas: sin usuario redirige a /; si su rol no tiene permiso lo manda
 *   a la página de inicio de su rol (admin → /movies, usuario → /dashboard),
 *   como pide el README ("el Administrador no podrá acceder a ninguna de las otras").
 *
 * @module middlewares/role
 */

const { getHomeByRole } = require('../config/session');

/**
 * Crea el middleware que comprueba el rol de `req.user`.
 *
 * @param {Array<"user"|"admin">} allowedRoles Roles que pueden pasar.
 * @returns {import('express').RequestHandler}
 * @example
 * // routes/movie.routes.js (isAuthenticated ya va antes, en app.js)
 * router.post('/movie', checkRole(['admin']), movieController.createMovie);
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;
    const isApi = req.originalUrl.startsWith('/api');

    if (!user) {
      if (isApi) {
        return res.status(401).json({ message: 'No autenticado' });
      }
      return res.redirect('/');
    }

    if (allowedRoles.includes(user.role)) {
      return next();
    }

    if (isApi) {
      return res.status(403).json({ message: 'No tienes permisos' });
    }
    return res.redirect(getHomeByRole(user.role));
  };
};

module.exports = checkRole;
