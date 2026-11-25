/**
 * Login con Google (OAuth 2.0, flujo "authorization code") sin librerías extra:
 * 1. getGoogleAuthUrl: URL de Google a la que se manda al usuario (GET /api/auth/google).
 * 2. Google vuelve a GOOGLE_CALLBACK_URL con un `code`.
 * 3. exchangeCodeForTokens: cambia ese `code` por un access_token.
 * 4. getGoogleUserProfile: con el access_token pide el perfil (id, email, nombre).
 *
 * Variables de entorno: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_CALLBACK_URL.
 *
 * @module config/oauth
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * URL de la pantalla de Google para elegir cuenta y dar permiso.
 * Pide los permisos `openid email profile`.
 *
 * @returns {string}
 */
const getGoogleAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

/**
 * Cambia el `code` que devuelve Google en el callback por los tokens.
 *
 * @param {string} code Código de autorización de la query del callback.
 * @returns {Promise<{access_token: string, id_token?: string, expires_in: number, token_type: string}>}
 * @throws {Error} Si Google rechaza el código (caducado, ya usado, credenciales mal...).
 */
const exchangeCodeForTokens = async (code) => {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Error al obtener token de Google: ${errorData}`);
  }

  return response.json();
};

/**
 * Pide a Google el perfil del usuario.
 *
 * @param {string} accessToken El `access_token` de exchangeCodeForTokens.
 * @returns {Promise<{id: string, email: string, name?: string, picture?: string}>}
 * @throws {Error} Si el token no es válido.
 */
const getGoogleUserProfile = async (accessToken) => {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Error al obtener perfil de Google: ${errorData}`);
  }

  return response.json();
};

module.exports = {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserProfile,
};