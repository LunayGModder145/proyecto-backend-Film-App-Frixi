/**
 * Punto de entrada del servidor Express: vistas Pug, archivos estáticos,
 * Swagger (/api-docs), rutas públicas, rutas protegidas (isAuthenticated
 * y checkRole) y conexión a MongoDB al arrancar.
 *
 * @module app
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();
require('./config/sqlDB');
const connectDB = require('./config/mongoDB');

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const viewsRoutes = require("./routes/views.routes");
const movieRoutes = require("./routes/movie.routes");
const favoritesRoutes = require("./routes/favorites.routes");
const userRoutes = require("./routes/user.routes");
const authRoutes = require('./routes/auth.routes');
const authController = require('./controllers/auth.controller');
const isAuthenticated = require('./middlewares/auth.middleware');
const checkRole = require('./middlewares/role.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

// Rutas de las vistas (Pug). Cada vista privada lleva su isAuthenticated en views.routes.js
app.use('/', viewsRoutes);

// Rutas públicas de la API: login, registro, logout y Google OAuth.
// Van ANTES que las privadas: las privadas se montan en /api con isAuthenticated
// delante, y cualquier ruta /api registrada después pasaría también por él.
// (El logout es público para que funcione aunque el token haya caducado.)
app.post('/api/login', authController.login);
app.post('/api/signup', authController.signup);
app.post('/api/logout', authController.logout);
app.use('/api/auth', authRoutes);

// Rutas privadas de la API: sin sesión responden 401.
// isAuthenticated siempre antes de checkRole, que necesita req.user.
app.use('/api/favorites', isAuthenticated, checkRole(['user']), favoritesRoutes);
app.use('/api', isAuthenticated, movieRoutes, userRoutes);

// Se arranca solo si se ejecuta este archivo (npm start / npm run dev).
// Si lo importa otro archivo (los tests e2e), solo se exporta la app:
// los tests conectan sus propias bases de datos en memoria y no abren ningún puerto.
if (require.main === module) {
    // Solo arrancamos el servidor si MongoDB conecta
    connectDB()
        .then(() => {
            app.listen(PORT, () => {
                console.log(`Servidor corriendo en http://localhost:${PORT}`);
            });
        })
        .catch(() => {
            console.error('No se pudo conectar a MongoDB. El servidor no se ha iniciado.');
            process.exit(1);
        });
}

module.exports = app;

