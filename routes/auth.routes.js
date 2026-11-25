const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Este router solo tiene rutas públicas (Google OAuth): se monta en /api/auth
// antes que las rutas privadas de la API (ver app.js).
// Login, registro y logout se registran en app.js, pero se documentan aquí
// porque Swagger solo lee los archivos de routes/ (ver config/swagger.js).

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Iniciar sesión con email y contraseña
 *     description: |
 *       Abre la sesión con un JWT en la cookie httpOnly `token`.
 *       Desde el formulario de la vista redirige a /dashboard (usuario) o /movies (admin);
 *       si se envía JSON responde con JSON (incluye el `token` para usarlo como Bearer).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login correcto (petición JSON)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login correcto
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: Lucía Pérez
 *                     email:
 *                       type: string
 *                       example: lucia@filmapp.test
 *                     role:
 *                       type: string
 *                       enum: [user, admin]
 *                       example: user
 *                 redirectTo:
 *                   type: string
 *                   example: /dashboard
 *                 token:
 *                   type: string
 *                   description: El mismo JWT de la cookie
 *       302:
 *         description: Login correcto (formulario). Redirige a /dashboard o /movies según el rol.
 *       400:
 *         description: Falta el email o la contraseña (JSON, o la vista de login con el error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Email y contraseña obligatorios
 *       401:
 *         description: Credenciales inválidas (mismo mensaje si el email no existe o falla la contraseña)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Credenciales inválidas
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /api/signup:
 *   post:
 *     summary: Registrarse (crear cuenta de usuario)
 *     description: |
 *       Lo usa el formulario de la vista /signup. Crea el usuario con rol `user`,
 *       guarda la contraseña cifrada con bcrypt, abre la sesión (cookie `token`)
 *       y redirige a /dashboard.
 *       Siempre responde con una vista o una redirección, nunca con JSON.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Lucía Pérez
 *               email:
 *                 type: string
 *                 format: email
 *                 example: lucia@filmapp.test
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "123456"
 *     responses:
 *       302:
 *         description: Usuario creado y sesión abierta. Redirige a /dashboard.
 *       400:
 *         description: Faltan datos o el email ya está registrado (vuelve a pintar /signup con el error)
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       500:
 *         description: Error interno al registrar el usuario (vista /signup con el error)
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: |
 *       Borra la cookie `token`. Es pública: funciona aunque el token haya caducado.
 *       Desde el botón "Salir" de la vista redirige a /; si se envía JSON responde con JSON.
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Sesión cerrada (petición JSON)
 *         content:
 *           application/json:
 *             example:
 *               message: Sesión cerrada
 *               redirectTo: /
 *       302:
 *         description: Sesión cerrada (formulario). Redirige a /.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: lucia@filmapp.test
 *         password:
 *           type: string
 *           format: password
 *           example: "123456"
 */

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Iniciar sesión con Google
 *     description: |
 *       Redirige a la pantalla de consentimiento de Google. Al terminar, Google vuelve a
 *       /api/auth/google/callback. No se puede probar desde Swagger: hay que abrirla en el navegador.
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirección a la pantalla de login de Google
 */
router.get('/google', authController.googleAuth);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Vuelta de Google después del login (callback de OAuth)
 *     description: |
 *       La llama Google, no el usuario. Cambia el `code` por los datos del perfil,
 *       busca o crea el usuario (rol `user`), abre la sesión (cookie `token`)
 *       y redirige a la página de inicio de su rol.
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Código de autorización que envía Google
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: Lo envía Google si el usuario cancela o algo falla
 *     responses:
 *       302:
 *         description: Sesión abierta. Redirige a /dashboard (usuario) o /movies (admin).
 *       400:
 *         description: Falta `code` o Google devolvió un error (vista de login con el error)
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       500:
 *         description: Error al autenticar con Google (vista de login con el error)
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/google/callback', authController.googleCallback);

module.exports = router;
