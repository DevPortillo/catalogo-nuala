const crypto = require('crypto');
const { getStore, connectLambda } = require('@netlify/blobs');

// Mismo hash que tenia admin_catalogo.php (bcrypt formato PHP $2y$)
const ADMIN_PASS_HASH = '$2y$10$KvU0R.UlL2gU/t84MK6VLO/60WeBocf3dqqJ2dbmMKNfv0Uen50iK';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 horas de sesion

// Las funciones clasicas de Netlify (exports.handler) corren en "modo compatible con Lambda".
// En ese modo, Netlify Blobs no se auto-configura solo: hay que conectar el contexto
// manualmente pasandole el evento de la request antes de pedir un store.
function storeDatos(event) {
  connectLambda(event);
  return getStore({ name: 'catalogo-datos', consistency: 'strong' });
}

function storeImagenes(event) {
  connectLambda(event);
  return getStore({ name: 'catalogo-imagenes', consistency: 'strong' });
}

function firmarToken(payload) {
  const base = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = crypto.createHmac('sha256', ADMIN_PASS_HASH).update(base).digest('hex');
  return `${base}.${firma}`;
}

function verificarToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [base, firma] = token.split('.');
  const firmaEsperada = crypto.createHmac('sha256', ADMIN_PASS_HASH).update(base).digest('hex');
  if (firma !== firmaEsperada) return false;
  try {
    const payload = JSON.parse(Buffer.from(base, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function tokenDesdeHeaders(event) {
  const encabezado = event.headers.authorization || event.headers.Authorization || '';
  if (encabezado.startsWith('Bearer ')) return encabezado.slice(7);
  return null;
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  };
}

// Envuelve un handler para que, pase lo que pase adentro (error de Blobs, bug,
// lo que sea), la respuesta SIEMPRE sea JSON valido con codigo 500 y un mensaje
// legible. Sin esto, un error no controlado hace que Netlify devuelva una
// pagina de error que no es JSON, y el frontend explota al intentar leerla
// (eso es lo que produce el "No se pudo cargar el catalogo" sin mas detalle).
function manejarErrores(handler) {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error('Error no controlado en funcion:', error);
      return json(500, {
        error: 'Error del servidor: ' + (error && error.message ? error.message : 'desconocido'),
      });
    }
  };
}

module.exports = {
  ADMIN_PASS_HASH,
  TOKEN_TTL_MS,
  storeDatos,
  storeImagenes,
  firmarToken,
  verificarToken,
  tokenDesdeHeaders,
  json,
  manejarErrores,
};
