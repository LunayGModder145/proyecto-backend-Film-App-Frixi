/**
 * Controlador de autenticación: registro, login con email y contraseña,
 * login con Google (OAuth) y logout.
 *
 * Todos abren la sesión igual (services/session.service.js): JWT en la cookie
 * `token`, y después redirigen a la página de inicio del rol.
 *
 * @module controllers/auth
 */

const bcrypt = require('bcrypt');
const userModel = require('../models/user.model');
const {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserProfile,
} = require('../config/oauth');
// Opciones de la cookie (para borrarla en el logout) y página de inicio de cada rol
const { COOKIE_OPTIONS, getHomeByRole } = require('../config/session');
// Firma el JWT y lo guarda en la cookie: compartido con la edición del perfil
const { createSession } = require('../services/session.service');

/**
 * Página a la que se va después de iniciar sesión: la de inicio de su rol
 * (admin → /movies, usuario → /dashboard). Ver getHomeByRole en config/session.js.
 */
const getRedirectByRole = getHomeByRole;

/**
 * POST /api/logout
 * Cierra la sesión borrando la cookie `token` y vuelve al inicio (README).
 * Es pública: funciona aunque el token ya haya caducado o no exista.
 * Como el JWT no se guarda en el servidor, cerrar sesión = borrar la cookie.
 */
const logout = (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);

  if (wantsJson(req)) {
    return res.status(200).json({ message: 'Sesión cerrada', redirectTo: '/' });
  }
  return res.redirect('/');
};

/**
 * ¿La petición viene de JS/Postman con JSON (responder JSON)
 * o del formulario de la vista (responder con una vista o una redirección)?
 */
const wantsJson = (req) => Boolean(req.is('application/json'));

/**
 * Responde a un login fallido: JSON para la API, o vuelve a pintar
 * el formulario de login con el mensaje en `error` (la vista ya lo muestra).
 */
const loginError = (req, res, status, message) => {
  if (wantsJson(req)) {
    return res.status(status).json({ message });
  }
  return res.status(status).render('login', {
    title: 'Film App - Iniciar sesión',
    error: message,
  });
};

/**
 * POST /api/login
 * Valida email y contraseña, abre la sesión con JWT y redirige según el rol.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return loginError(req, res, 400, 'Email y contraseña obligatorios');
    }

    const user = await userModel.findByEmail(email.trim());

    // Mismo mensaje si no existe el email o si falla la contraseña:
    // así no se revela qué emails están registrados.
    // Sin password_hash = usuario que solo entra con Google.
    if (!user || !user.password_hash) {
      return loginError(req, res, 401, 'Credenciales inválidas');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return loginError(req, res, 401, 'Credenciales inválidas');
    }

    const token = createSession(res, user);
    const redirectTo = getRedirectByRole(user.role);

    if (wantsJson(req)) {
      return res.status(200).json({
        message: 'Login correcto',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        redirectTo,
        token,
      });
    }

    return res.redirect(redirectTo);
  } catch (err) {
    console.error('Error en login:', err);
    return loginError(req, res, 500, 'Error interno en el login');
  }
};

/**
 * GET /api/auth/google
 * Manda al usuario a la pantalla de Google para elegir cuenta.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const googleAuth = (req, res) => {
  const url = getGoogleAuthUrl();
  return res.redirect(url);
};

/**
 * GET /api/auth/google/callback (la URL de GOOGLE_CALLBACK_URL)
 * Google vuelve aquí con `?code=...`: se cambia por el perfil del usuario,
 * se busca o se crea en la base de datos, se abre la sesión y se redirige según el rol.
 *
 * - 400 (vista login) si el usuario cancela o no llega el `code`.
 * - 500 (vista login) si falla Google o la base de datos.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const googleCallback = async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error || !code) {
      return res.status(400).render('login', {
        error: 'No se pudo completar el inicio de sesión con Google',
      });
    }

    const tokenData = await exchangeCodeForTokens(code);
    const profile = await getGoogleUserProfile(tokenData.access_token);

    const user = await userModel.findOrCreateGoogleUser({
      googleId: profile.id,
      email: profile.email,
      name: profile.name,
    });

    createSession(res, user);
    return res.redirect(getRedirectByRole(user.role));
  } catch (err) {
    console.error('Error en el Google OAuth callback:', err);
    return res.status(500).render('login', {
      error: 'Error al autenticar con Google',
    });
  }
};

/**
 * POST /api/signup
 * Registra un usuario nuevo (siempre con rol `user`), cifra la contraseña
 * con bcrypt, abre la sesión y redirige a /dashboard.
 *
 * - 400 (vista signup) si falta algún campo o el email ya está registrado.
 * - 500 (vista signup) si ocurre un error inesperado.
 *
 * @param {import('express').Request} req Body: `{ name, email, password }`.
 * @param {import('express').Response} res
 */
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).render('signup', {
        error: 'Completa nombre, email y contraseña',
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await userModel.createUser({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
    });

    createSession(res, user);
    return res.redirect('/dashboard');
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(400).render('signup', {
        error: 'Ese email ya está registrado',
      });
    }

    console.error('Error en signup:', err);
    return res.status(500).render('signup', {
      error: 'Error interno al registrar el usuario',
    });
  }
};

module.exports = {
  getRedirectByRole,
  login,
  logout,
  signup,
  googleAuth,
  googleCallback,
};
