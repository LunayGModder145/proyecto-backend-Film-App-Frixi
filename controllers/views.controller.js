/**
 * Controlador de las vistas web (Server Side Rendering con Pug).
 * Cada función pinta una plantilla de /views con los datos que necesita.
 *
 * En las vistas privadas, `req.user` lo rellena middlewares/auth.middleware.js
 * con los datos del token (id, email, name, role). En las públicas
 * (/, /login, /signup) vale undefined y las vistas lo tienen en cuenta.
 *
 * @module controllers/views
 */

const mongoose = require('mongoose');
const movieService = require('../services/movie.service');
const favoriteService = require('../services/favorite.service');
const userModel = require('../models/user.model');

/** GET / - Inicio con formulario de login */
const getHome = (req, res) => {
    res.render('home', { title: 'Film App - Inicio' });
};

/** GET /login - Formulario de login */
const getLogin = (req, res) => {
    res.render('login', { title: 'Film App - Iniciar sesión' });
};

/** GET /signup - Formulario de registro */
const getSignup = (req, res) => {
    res.render('signup', { title: 'Film App - Registro' });
};

/** GET /dashboard - Panel de control del usuario */
const getDashboard = (req, res) => {
    res.render('dashboard', {
        title: 'Film App - Panel de control',
        user: req.user
    });
};

/** GET /search?title=... - Buscador de películas (OMDB y, si no hay nada, MongoDB) */
const getSearch = async (req, res) => {
    const query = (req.query.title || '').trim();

    let movies = [];
    let error = null;

    if (query) {
        try {
            movies = await movieService.searchMovies(query);
            movies = await favoriteService.markFavorites(req.user?.id, movies);
        } catch (err) {
            console.error('Error en GET /search:', err);
            error = 'No se han podido buscar películas. Inténtalo de nuevo.';
        }
    }

    res.render('search', {
        title: 'Film App - Buscar',
        user: req.user,
        query,
        movies,
        error
    });
};

/**
 * GET /search/:title - Detalle de una película.
 * Se busca por título y se elige la que coincide exactamente (sin mayúsculas);
 * si ninguna coincide exacta, la primera de los resultados.
 */
const getDetail = async (req, res) => {
    const title = (req.params.title || '').trim();

    let movie = null;
    let error = null;

    try {
        const movies = await movieService.searchMovies(title);

        movie =
            movies.find(
                m => m.title.toLowerCase() === title.toLowerCase()
            ) ||
            movies[0] ||
            null;

        if (movie) {
            [movie] = await favoriteService.markFavorites(req.user?.id, [movie]);
        }

    } catch (err) {
        console.error('Error en GET /search/:title:', err);
        error = 'No se ha podido cargar la película. Inténtalo de nuevo.';
    }

    let status = 200;

    if (error) {
        status = 500;
    } else if (!movie) {
        status = 404;
    }

    res.status(status).render('detail', {
        title: 'Film App - Detalle',
        user: req.user,
        movie,
        error
    });
};

/**
 * GET /movies (y /favorites)
 * El README usa /movies para el usuario (sus favoritas) y para el admin (gestión),
 * así que se elige la vista según el rol.
 */
const getMovies = async (req, res) => {

    if (req.user && req.user.role === 'admin') {
        // Gestión: todas las películas de MongoDB (las de OMDB no se pueden editar ni borrar)
        let movies = [];
        let error = null;

        try {
            movies = await movieService.getAllMovies();
        } catch (err) {
            console.error('Error en GET /movies (admin):', err);
            error = 'No se han podido cargar las películas. Inténtalo de nuevo.';
        }

        return res.status(error ? 500 : 200).render('adminMovies', {
            title: 'Film App - Gestionar películas',
            user: req.user,
            movies,
            error
        });
    }

    // Favoritos del usuario (SQL) con sus datos pedidos a su fuente (OMDB o MongoDB)
    let movies = [];
    let error = null;

    try {
        movies = await favoriteService.getFavoriteMovies(req.user.id);
    } catch (err) {
        console.error('Error en GET /movies:', err);
        error = 'No se han podido cargar tus películas. Inténtalo de nuevo.';
    }

    res.status(error ? 500 : 200).render('movies', {
        title: 'Film App - Mis películas',
        user: req.user,
        movies,
        error
    });
};

/**
 * GET /movies/:id/edit (solo admin)
 * Formulario de edición con los datos actuales de la película (MongoDB).
 * Al guardar, public/js/adminMovies.js lo envía con fetch a PUT /api/movie/:id.
 */
const getEditMovie = async (req, res) => {
    const { id } = req.params;
    let movie = null;
    let error = null;

    // Si el id no tiene formato de MongoDB, la película no puede existir
    if (mongoose.isValidObjectId(id)) {
        try {
            movie = await movieService.getMovieBySource(id, 'mongo');
        } catch (err) {
            console.error('Error en GET /movies/:id/edit:', err);
            error = 'No se ha podido cargar la película. Inténtalo de nuevo.';
        }
    }

    let status = 200;
    if (error) status = 500;
    else if (!movie) status = 404;

    res.status(status).render('editMovie', { title: 'Film App - Editar película', user: req.user, movie, error });
};

/**
 * GET /profile - Perfil del usuario o del administrador.
 * Los datos se leen de la BD (SQL) y no del token, que puede tener datos antiguos.
 * El formulario lo envía public/js/profile.js con fetch a PUT /api/user.
 */
const getProfile = async (req, res) => {
    let profile = null;
    let error = null;

    try {
        profile = await userModel.findById(req.user.id);
    } catch (err) {
        console.error('Error en GET /profile:', err);
        error = 'No se ha podido cargar tu perfil. Inténtalo de nuevo.';
    }

    let status = 200;
    if (error) status = 500;
    else if (!profile) status = 404;

    res.status(status).render('profile', {
        title: 'Film App - Mi perfil',
        user: req.user,
        profile,
        error
    });
};

/**
 * GET /users - Gestión de usuarios (solo admin): lista real de la BD (SQL).
 * Crear, editar y borrar se hacen con fetch desde public/js/adminUsers.js.
 */
const getUsers = async (req, res) => {
    let users = [];
    let error = null;

    try {
        users = await userModel.findAll();
    } catch (err) {
        console.error('Error en GET /users:', err);
        error = 'No se han podido cargar los usuarios. Inténtalo de nuevo.';
    }

    res.status(error ? 500 : 200).render('users', {
        title: 'Film App - Usuarios',
        user: req.user,
        users,
        error
    });
};

/**
 * GET /users/:id/edit (solo admin)
 * Formulario de edición con los datos actuales del usuario (SQL).
 * Al guardar, public/js/adminUsers.js lo envía con fetch a PUT /api/user/:id.
 */
const getEditUser = async (req, res) => {
    const id = Number(req.params.id);
    let editUser = null;
    let error = null;

    // Si el id no es un número entero positivo, el usuario no puede existir
    if (Number.isInteger(id) && id > 0) {
        try {
            editUser = await userModel.findById(id);
        } catch (err) {
            console.error('Error en GET /users/:id/edit:', err);
            error = 'No se ha podido cargar el usuario. Inténtalo de nuevo.';
        }
    }

    let status = 200;
    if (error) status = 500;
    else if (!editUser) status = 404;

    res.status(status).render('editUser', {
        title: 'Film App - Editar usuario',
        user: req.user,
        editUser,
        error
    });
};

module.exports = {
    getHome,
    getLogin,
    getSignup,
    getDashboard,
    getSearch,
    getDetail,
    getMovies,
    getEditMovie,
    getProfile,
    getUsers,
    getEditUser
};
