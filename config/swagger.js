/**
 * Especificación OpenAPI de la API, generada con swagger-jsdoc a partir de
 * los comentarios `@swagger` de routes/*.js. app.js la sirve en /api-docs.
 *
 * @module config/swagger
 */

const swaggerJsdoc = require("swagger-jsdoc");

/**
 * Configuración de Swagger (OpenAPI 3).
 *
 * Aquí va lo común a toda la API: autenticación, etiquetas, esquemas
 * compartidos (User, Error...) y respuestas de error repetidas (401, 403, 500).
 * Cada endpoint se documenta con anotaciones @swagger en su archivo de routes/.
 *
 * Por defecto todas las rutas exigen sesión (`security` global); las rutas
 * públicas lo anulan con `security: []`.
 */
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Film App API",
            version: "1.0.0",
            description:
                "API para gestión de películas y usuarios.\n\n" +
                "**Autenticación:** al iniciar sesión se guarda un JWT en la cookie httpOnly `token`, " +
                "que el navegador envía solo en cada petición. Si has iniciado sesión en la app " +
                "(misma pestaña/navegador), las rutas privadas funcionan directamente desde aquí. " +
                "También se puede usar el botón **Authorize** con el `token` que devuelve " +
                "`POST /api/login` (petición JSON) como `Bearer`."
        },
        // URL relativa: funciona con cualquier puerto (PORT) y en cualquier despliegue
        servers: [
            {
                url: "/",
                description: "Servidor actual"
            }
        ],
        tags: [
            { name: "Auth", description: "Login, registro, logout y Google OAuth (rutas públicas)" },
            { name: "Movies", description: "Búsqueda (OMDB + MongoDB) y gestión de películas (admin)" },
            { name: "Favorites", description: "Películas favoritas del usuario (solo rol `user`)" },
            { name: "User", description: "Perfil propio y gestión de usuarios (admin)" }
        ],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "token",
                    description: "JWT en la cookie httpOnly `token` (la crean login, signup y Google)"
                },
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "El mismo JWT en la cabecera `Authorization: Bearer <token>` (Postman, Swagger)"
                }
            },
            schemas: {
                User: {
                    type: "object",
                    description: "Datos públicos de un usuario (nunca incluye la contraseña)",
                    properties: {
                        id: { type: "integer", example: 1 },
                        name: { type: "string", example: "Lucía Pérez" },
                        email: { type: "string", format: "email", example: "lucia@filmapp.test" },
                        role: { type: "string", enum: ["user", "admin"], example: "user" },
                        created_at: { type: "string", format: "date-time", example: "2026-11-20T10:00:00.000Z" }
                    }
                },
                Message: {
                    type: "object",
                    properties: {
                        message: { type: "string", example: "Operación realizada" }
                    }
                },
                Error: {
                    type: "object",
                    properties: {
                        message: { type: "string", example: "Descripción del error" }
                    }
                },
                ValidationError: {
                    type: "object",
                    properties: {
                        message: { type: "string", example: "Datos no válidos" },
                        errors: {
                            type: "array",
                            items: { type: "string" },
                            example: ["El nombre es obligatorio", "El email no es válido"]
                        }
                    }
                }
            },
            responses: {
                Unauthorized: {
                    description: "No autenticado: no hay token, o es inválido o ha caducado",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/Error" },
                            example: { message: "No autenticado" }
                        }
                    }
                },
                Forbidden: {
                    description: "El rol del usuario no tiene permiso para esta ruta",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/Error" },
                            example: { message: "No tienes permisos" }
                        }
                    }
                },
                ServerError: {
                    description: "Error inesperado en el servidor",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/Error" }
                        }
                    }
                }
            }
        }
    },
    apis: ["./routes/*.js"]
};

const specs = swaggerJsdoc(options);

module.exports = specs;
