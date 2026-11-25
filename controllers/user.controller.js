/**
 * Controlador de usuarios.
 *
 * Perfil propio (usuario o admin): GET /api/user y PUT /api/user trabajan SIEMPRE
 * con `req.user.id`, que sale del token (middlewares/auth.middleware.js): nunca de
 * la URL ni del body, así nadie puede leer ni editar el perfil de otro.
 *
 * Gestión de usuarios (solo admin, vista /users): POST /api/user,
 * PUT /api/user/:id y DELETE /api/user/:id. El id del usuario va en la URL.
 *
 * @module controllers/user
 */

const bcrypt = require('bcrypt');
const userModel = require('../models/user.model');
const { createSession } = require('../services/session.service');

const ROLES = ['user', 'admin'];
// Mismo mínimo que el formulario de registro (minlength="6")
const PASSWORD_MIN_LENGTH = 6;
const SALT_ROUNDS = 10;

// Mismo límite que la columna `name VARCHAR(100)` de docs/schema.sql
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 255;
// Validación sencilla: algo@algo.algo, sin espacios
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida y limpia el nombre y el email del body.
 *
 * @param {Object} body
 * @returns {{data: {name: string, email: string}, errors: string[]}}
 */
const validateProfile = (body = {}) => {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!name) {
    errors.push('El nombre es obligatorio');
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.push(`El nombre no puede tener más de ${NAME_MAX_LENGTH} caracteres`);
  }

  if (!email) {
    errors.push('El email es obligatorio');
  } else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(email)) {
    errors.push('El email no es válido');
  }

  return { data: { name, email }, errors };
};

/**
 * GET /api/user
 * Datos del usuario con la sesión iniciada, leídos de la base de datos
 * (no del token, que puede tener datos antiguos).
 */
const getUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);

    // El token es válido pero el usuario ya no existe (p. ej. lo borró un admin)
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error('Error en GET /api/user:', err);
    return res.status(500).json({ message: 'Error al obtener el usuario' });
  }
};

/**
 * PUT /api/user
 * Edita el nombre y el email del usuario con la sesión iniciada.
 * El body solo puede cambiar `name` y `email`: si llegan `role` o `id`, se ignoran.
 * Al terminar renueva el token, para que el menú y el saludo muestren ya los datos nuevos.
 */
const updateUser = async (req, res) => {
  const { data, errors } = validateProfile(req.body);

  if (errors.length) {
    return res.status(400).json({ message: 'Datos no válidos', errors });
  }

  try {
    const user = await userModel.updateUser(req.user.id, data);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    createSession(res, user);

    return res.status(200).json({ message: 'Perfil actualizado', user });
  } catch (err) {
    // 23505: el email ya lo usa otro usuario (índice único ux_users_email)
    if (err && err.code === '23505') {
      return res.status(400).json({
        message: 'Datos no válidos',
        errors: ['Ese email ya está registrado'],
      });
    }

    console.error('Error en PUT /api/user:', err);
    return res.status(500).json({ message: 'Error al actualizar el perfil' });
  }
};

// ---------- Gestión de usuarios (admin) ----------

/** Datos públicos de un usuario: nunca se devuelve password_hash ni google_id. */
const publicUser = ({ id, name, email, role, created_at }) => ({ id, name, email, role, created_at });

/** id de la URL → número entero positivo, o null si no tiene ese formato. */
const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** Valida nombre y email (como el perfil) y además el rol. */
const validateUserByAdmin = (body = {}) => {
  const { data, errors } = validateProfile(body);

  if (!ROLES.includes(body.role)) {
    errors.push('El rol tiene que ser "user" o "admin"');
  }

  return { data: { ...data, role: body.role }, errors };
};

/** El email ya lo usa otro usuario (índice único ux_users_email → error 23505). */
const isDuplicateEmail = (err) => Boolean(err && err.code === '23505');

/** Responde 400 con el error de email repetido, en el mismo formato que la validación. */
const duplicateEmailResponse = (res) =>
  res.status(400).json({ message: 'Datos no válidos', errors: ['Ese email ya está registrado'] });

/**
 * POST /api/user (admin)
 * Da de alta un usuario nuevo (con el rol que elija el admin).
 * A diferencia de /api/signup, NO abre sesión: el admin sigue siendo el admin.
 */
const createUserByAdmin = async (req, res) => {
  const { data, errors } = validateUserByAdmin(req.body);
  const password = req.body && req.body.password;

  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`La contraseña tiene que tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
  }

  if (errors.length) {
    return res.status(400).json({ message: 'Datos no válidos', errors });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userModel.createUser({ ...data, passwordHash });

    return res.status(201).json({ message: 'Usuario creado', user: publicUser(user) });
  } catch (err) {
    if (isDuplicateEmail(err)) return duplicateEmailResponse(res);

    console.error('Error en POST /api/user:', err);
    return res.status(500).json({ message: 'Error al crear el usuario' });
  }
};

/**
 * PUT /api/user/:id (admin)
 * Edita nombre, email y rol de cualquier usuario. La contraseña no se toca.
 * El admin no puede quitarse a sí mismo el rol de admin (podríais quedaros sin admin).
 */
const updateUserByAdmin = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  const { data, errors } = validateUserByAdmin(req.body);

  if (id === req.user.id && data.role !== 'admin') {
    errors.push('No puedes quitarte a ti mismo el rol de administrador');
  }

  if (errors.length) {
    return res.status(400).json({ message: 'Datos no válidos', errors });
  }

  try {
    const user = await userModel.updateUserByAdmin(id, data);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Si el admin se edita a sí mismo, renueva su token para que se vea el nombre nuevo
    if (id === req.user.id) {
      createSession(res, user);
    }

    return res.status(200).json({ message: 'Usuario actualizado', user: publicUser(user) });
  } catch (err) {
    if (isDuplicateEmail(err)) return duplicateEmailResponse(res);

    console.error('Error en PUT /api/user/:id:', err);
    return res.status(500).json({ message: 'Error al actualizar el usuario' });
  }
};

/**
 * DELETE /api/user/:id (admin)
 * Borra un usuario. Sus favoritos se borran solos (ON DELETE CASCADE en SQL).
 * El admin no puede borrarse a sí mismo.
 */
const deleteUserByAdmin = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: 'No puedes borrar tu propio usuario' });
  }

  try {
    const user = await userModel.deleteUser(id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.status(200).json({ message: 'Usuario eliminado', user });
  } catch (err) {
    console.error('Error en DELETE /api/user/:id:', err);
    return res.status(500).json({ message: 'Error al eliminar el usuario' });
  }
};

module.exports = {
  validateProfile,
  validateUserByAdmin,
  parseId,
  getUser,
  updateUser,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
};
