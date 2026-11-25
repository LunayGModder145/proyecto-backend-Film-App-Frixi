-- ==========================================================
-- Film App - Esquema SQL (PostgreSQL en Supabase)
--
-- Tablas:
--   users     -> usuarios de la app (rol user/admin, login por email o Google)
--   favorites -> relación usuario + película + fuente (omdb/mongo).
--                No guarda datos de la película, solo dónde encontrarla.
--
-- Para crear la BBDD desde cero: pegar este archivo en el
-- SQL Editor de Supabase y ejecutarlo.
-- ==========================================================


-- ========================================
-- Tipos con valores fijos (ENUM)
-- ========================================
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE movie_source AS ENUM ('omdb', 'mongo');


-- ========================================
-- Tabla users
-- ========================================
CREATE TABLE users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),          -- NULL si se registró con Google
    google_id     VARCHAR(255) UNIQUE,   -- NULL si se registró con email
    role          user_role    NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Un usuario debe tener al menos una forma de iniciar sesión
    CONSTRAINT chk_login_method
        CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

-- El email no se puede repetir, aunque cambien las mayúsculas
-- ("Ana@mail.com" y "ana@mail.com" cuentan como el mismo)
CREATE UNIQUE INDEX ux_users_email ON users (LOWER(email));


-- ========================================
-- Tabla favorites (tabla de relación)
-- ========================================
CREATE TABLE favorites (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER      NOT NULL,
    movie_id    VARCHAR(50)  NOT NULL,   -- imdbID (OMDB) o _id (MongoDB)
    source      movie_source NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_favorites_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,                 -- si borras un usuario, se borran sus favoritos

    CONSTRAINT uq_favorite
        UNIQUE (user_id, movie_id, source) -- no se puede guardar dos veces la misma película
);


-- ========================================
-- Row Level Security
-- Bloquea el acceso desde la API pública de Supabase (anon key).
-- El backend se conecta con DATABASE_URL como dueño de las tablas,
-- así que RLS no le afecta.
-- ========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;


-- ========================================
-- Usuarios de prueba (OPCIONAL)
-- Los ids deben coincidir con data/fakeUsers.js: 1 = user, 2 = admin.
-- Contraseña de los dos: 123456 (se guarda cifrada con bcrypt).
-- Quitar los "--" para ejecutarlo.
-- ========================================
-- INSERT INTO users (name, email, password_hash, role) VALUES
--   ('Lucía Pérez', 'lucia@filmapp.test', extensions.crypt('123456', extensions.gen_salt('bf')), 'user'),
--   ('Admin Demo',  'admin@filmapp.test', extensions.crypt('123456', extensions.gen_salt('bf')), 'admin');
