/**
 * Variables de entorno para los tests (Jest lo ejecuta antes de cada archivo de test,
 * ver `setupFiles` en jest.config.js).
 *
 * Los tests no pasan por app.js, así que nadie carga el .env. Aquí se pone un secreto
 * fijo solo para tests: no firma tokens reales, así que no pasa nada por que sea público.
 * Tiene que estar antes de que se cargue config/session.js, que lee la variable una sola vez.
 */
process.env.JWT_SECRET = "test_secret_solo_para_jest";

// dotenv (app.js y config/*) avisa por consola cada vez que carga el .env: en los tests es solo ruido
process.env.DOTENV_CONFIG_QUIET = "true";
