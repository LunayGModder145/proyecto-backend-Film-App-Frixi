const express = require('express');
const views = require('../controllers/views.controller');
const isAuthenticated = require('../middlewares/auth.middleware');
const checkRole = require('../middlewares/role.middleware');

const router = express.Router();

// Vistas públicas
router.get('/', views.getHome);
router.get('/login', views.getLogin);
router.get('/signup', views.getSignup);

// Vistas privadas: sin sesión redirigen a / (README, "Sobre el control de acceso").
// isAuthenticated va en cada ruta y no con router.use(): este router está montado
// en "/", así que un router.use() también bloquearía las rutas públicas de la API
// (/api/login, /api/signup…) que se registran después en app.js.
// isAuthenticated siempre antes de checkRole, que necesita req.user.
//
// Control de acceso por rol: quien abre una vista que no es de su rol
// vuelve a su página de inicio (admin → /movies, usuario → /dashboard).
const onlyUser = [isAuthenticated, checkRole(['user'])];
const onlyAdmin = [isAuthenticated, checkRole(['admin'])];
const anyRole = [isAuthenticated, checkRole(['user', 'admin'])];

// Solo usuario
router.get('/dashboard', onlyUser, views.getDashboard);
router.get('/search', onlyUser, views.getSearch);
router.get('/search/:title', onlyUser, views.getDetail);
router.get('/favorites', onlyUser, views.getMovies);

// Solo administrador
router.get('/movies/:id/edit', onlyAdmin, views.getEditMovie);
router.get('/users', onlyAdmin, views.getUsers);
router.get('/users/:id/edit', onlyAdmin, views.getEditUser);

// Los dos roles: /movies pinta "Mis películas" (usuario) o "Gestionar películas" (admin)
router.get('/movies', anyRole, views.getMovies);
router.get('/profile', anyRole, views.getProfile);

module.exports = router;
