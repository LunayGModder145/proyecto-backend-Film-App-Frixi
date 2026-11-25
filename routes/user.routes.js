const express = require("express");
const userController = require("../controllers/user.controller");
const checkRole = require("../middlewares/role.middleware");

// Este router se monta en /api con isAuthenticated delante (ver app.js):
// todas sus rutas exigen sesión y trabajan con req.user.
// - /user (sin id): el perfil propio, usuario o admin.
// - /user y /user/:id con checkRole(["admin"]): gestión de usuarios (vista /users).
const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ProfileInput:
 *       type: object
 *       required: [name, email]
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 100
 *           example: Lucía Pérez
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           example: lucia@filmapp.test
 *     UserByAdminInput:
 *       allOf:
 *         - $ref: '#/components/schemas/ProfileInput'
 *         - type: object
 *           required: [role]
 *           properties:
 *             role:
 *               type: string
 *               enum: [user, admin]
 *               example: user
 *     UserResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *   parameters:
 *     UserId:
 *       in: path
 *       name: id
 *       required: true
 *       schema:
 *         type: integer
 *         minimum: 1
 *       description: id del usuario en SQL (si no es un entero positivo responde 404)
 *   responses:
 *     UserValidationError:
 *       description: Datos no válidos o email ya registrado (lista en `errors`)
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidationError'
 *           example:
 *             message: Datos no válidos
 *             errors: [Ese email ya está registrado]
 *     UserNotFound:
 *       description: El usuario no existe
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             message: Usuario no encontrado
 */

/**
 * @swagger
 * /api/user:
 *   get:
 *     summary: Obtener el perfil del usuario con la sesión iniciada
 *     description: Usuario o administrador. Los datos se leen de la base de datos (SQL); nunca incluye la contraseña.
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Datos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: El usuario del token ya no existe (p. ej. lo borró un admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Usuario no encontrado
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/user", userController.getUser);

/**
 * @swagger
 * /api/user:
 *   put:
 *     summary: Editar el perfil del usuario con la sesión iniciada
 *     description: |
 *       Solo se pueden cambiar `name` y `email` del propio usuario (el id sale del token).
 *       Si llegan `role` o `id` en el body, se ignoran. Renueva la cookie `token` con los datos nuevos.
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfileInput'
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *             example:
 *               message: Perfil actualizado
 *               user:
 *                 id: 1
 *                 name: Lucía Pérez
 *                 email: lucia@filmapp.test
 *                 role: user
 *                 created_at: 2026-11-20T10:00:00.000Z
 *       400:
 *         $ref: '#/components/responses/UserValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: El usuario del token ya no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Usuario no encontrado
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/user", userController.updateUser);

/**
 * @swagger
 * /api/user:
 *   post:
 *     summary: Crear un usuario (solo admin)
 *     description: |
 *       Da de alta un usuario con el rol elegido. A diferencia de /api/signup, NO abre sesión
 *       (el admin sigue con la suya). La contraseña se guarda cifrada con bcrypt.
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/UserByAdminInput'
 *               - type: object
 *                 required: [password]
 *                 properties:
 *                   password:
 *                     type: string
 *                     format: password
 *                     minLength: 6
 *                     example: "123456"
 *     responses:
 *       201:
 *         description: Usuario creado (sin la contraseña)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *             example:
 *               message: Usuario creado
 *               user:
 *                 id: 2
 *                 name: Nuevo Usuario
 *                 email: nuevo@filmapp.test
 *                 role: user
 *                 created_at: 2026-11-22T10:00:00.000Z
 *       400:
 *         $ref: '#/components/responses/UserValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/user", checkRole(["admin"]), userController.createUserByAdmin);

/**
 * @swagger
 * /api/user/{id}:
 *   parameters:
 *     - $ref: '#/components/parameters/UserId'
 *   put:
 *     summary: Editar un usuario (solo admin)
 *     description: |
 *       Cambia nombre, email y rol. La contraseña no se puede cambiar desde aquí.
 *       El admin no puede quitarse a sí mismo el rol de admin.
 *       Si el admin se edita a sí mismo, se renueva su cookie `token`.
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserByAdminInput'
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: Datos no válidos, email ya registrado o intento de quitarse el rol de admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             example:
 *               message: Datos no válidos
 *               errors: [No puedes quitarte a ti mismo el rol de administrador]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/UserNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     summary: Borrar un usuario (solo admin)
 *     description: Sus favoritos se borran también (ON DELETE CASCADE). El admin no puede borrarse a sí mismo.
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *         content:
 *           application/json:
 *             example:
 *               message: Usuario eliminado
 *               user:
 *                 id: 2
 *                 name: Nuevo Usuario
 *                 email: nuevo@filmapp.test
 *       400:
 *         description: Intento de borrar el propio usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: No puedes borrar tu propio usuario
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/UserNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/user/:id", checkRole(["admin"]), userController.updateUserByAdmin);
router.delete("/user/:id", checkRole(["admin"]), userController.deleteUserByAdmin);

module.exports = router;
