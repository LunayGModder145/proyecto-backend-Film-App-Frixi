# TAREAS — Movie App

## Backlog

### 1. Configuración inicial
~~Crear el repo en GitHub y añadir a los 4 integrantes como colaboradores~~
~~Acordar la estrategia de ramas y proteger main (merge solo mediante PR)~~
~~Añadir .gitignore y .env.example~~
~~Elegir la API externa (OMDB o TMDB) y conseguir la API key~~
~~Inicializar el proyecto Node + Express con la estructura de carpetas acordada~~
~~Configurar el framework de tests con un primer test que pase~~
~~Diseñar el modelo SQL: usuarios (con rol) y favoritos (usuario + id de película + origen)~~
~~Crear las tablas SQL y la conexión~~
~~Crear la conexión a MongoDB y el modelo de película~~
~~Configurar el motor de plantillas (Pug o EJS) y el layout base mobile-first~~
~~Configurar Swagger~~

### 2. Autenticación
~~POST /api/signup: registro con contraseña cifrada, abrir sesión y redirigir a /dashboard~~
~~POST /api/login con JWT y redirección según rol~~
~~Middleware que comprueba la sesión (si no hay, redirige a /)~~
~~Middleware que comprueba el rol (usuario / admin)~~
~~POST /api/logout~~
~~Control de acceso por rol: el admin solo puede entrar en /movies y el usuario no puede entrar en la gestión de películas~~
~~Vista de registro GET /signup~~
~~Vista de login (GET / y/o /login)~~
~~Login con proveedor externo mediante OAuth (Google, GitHub…)~~

### 3. Búsqueda de películas
~~Unificar el formato de película para que no importe de qué fuente viene~~
~~Servicio de búsqueda: primero la API externa, luego MongoDB y, si no hay nada, "No hay resultados"~~
~~GET /api/movie/:title~~
~~Vista buscador /search con tarjetas y el botón "Añadir a Favoritos"~~
~~Vista detalle /search/:title (añade sinopsis, actores y rating)~~

### 4. Favoritos
~~POST /api/favorites: guardar solo la relación, no los datos de la película~~
~~GET /api/favorites: recuperar los datos desde su fuente original~~
~~DELETE /api/favorites~~
~~Vista "Mis películas" con el botón "Quitar"~~

### 5. Administrador — películas
~~POST /api/movie con validación~~
~~PUT /api/movie con validación~~
~~DELETE /api/movie, que también borra los favoritos asociados en SQL~~
~~Vista de gestión: listado, crear, editar (formulario ya rellenado) y eliminar (con confirmación)~~

### 6. Vistas generales
~~Dashboard /dashboard con dos botones con icono y la opción de salir~~
~~Menú hamburguesa con efecto persiana, distinto según el rol~~

### 7. Usuarios y perfil
~~GET /api/user~~
~~PUT /api/user~~
~~Vista /profile con formulario de edición~~
~~DELETE /api/user (admin)~~
~~Vista /users (admin) con CRUD de usuarios~~

### 8. Calidad y entrega
~~Documentación con JSDoc en las funciones importantes~~
~~Completar la documentación de Swagger~~
~~Tests e2e de los flujos principales~~
~~README final: instalación, variables de entorno y cómo arrancar y lanzar los tests~~
