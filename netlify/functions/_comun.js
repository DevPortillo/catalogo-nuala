const crypto = require('crypto');
const { getStore, connectLambda } = require('@netlify/blobs');

// Mismo hash que tenia admin_catalogo.php (bcrypt formato PHP $2y$)
const ADMIN_PASS_HASH = '$2y$10$KvU0R.UlL2gU/t84MK6VLO/60WeBocf3dqqJ2dbmMKNfv0Uen50iK';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 horas de sesion

// Las funciones clasicas de Netlify (exports.handler) corren en "modo compatible con Lambda".
// En ese modo, Netlify Blobs no se auto-configura solo: hay que conectar el contexto
// manualmente pasandole el evento de la request antes de pedir un store.
//
// Nota sobre "consistency": se uso 'strong' al principio, pero ese modo requiere que el
// entorno tenga configurada una propiedad interna llamada 'uncachedEdgeURL' que no esta
// disponible en este sitio, y eso hacia fallar TODAS las lecturas con el error
// "Netlify Blobs has failed to perform a read using strong consistency...".
// Con 'eventual' (el modo por defecto y el que usa casi todo el mundo) los datos quedan
// disponibles al instante para quien los escribe y se propagan al resto en <60s, que es
// mas que suficiente para un catalogo que se actualiza a mano.
function storeDatos(event) {
  connectLambda(event);
  return getStore({ name: 'catalogo-datos', consistency: 'eventual' });
}

function storeImagenes(event) {
  connectLambda(event);
  return getStore({ name: 'catalogo-imagenes', consistency: 'eventual' });
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

// Error "de negocio" (dato no encontrado, validacion, etc). Se distingue de un error
// tecnico para que mutarDatos lo deje pasar de una sola vez, sin reintentar.
class ErrorPeticion extends Error {
  constructor(statusCode, mensaje) {
    super(mensaje);
    this.statusCode = statusCode;
  }
}

// Lee, modifica y guarda el JSON del catalogo protegiendo contra condiciones de carrera.
// Netlify Blobs no bloquea nada por su cuenta: si dos peticiones leen el mismo estado y
// escriben una despues de la otra, la ultima pisa por completo lo que guardo la primera
// (por eso una foto o una variante podia desaparecer sola al subir dos fotos seguidas).
//
// La solucion es una escritura condicionada por ETag (concurrencia optimista): se lee el
// dato junto con su ETag, se aplica la modificacion en memoria y se intenta guardar solo
// si nadie cambio el ETag mientras tanto. Si alguien mas gano la carrera, se vuelve a leer
// el estado ya actualizado, se reaplica la modificacion sobre esa version fresca y se
// reintenta, con una pequena espera aleatoria para no chocar de nuevo.
async function mutarDatos(store, clave, mutador) {
  const intentosMaximos = 8;
  for (let intento = 0; intento < intentosMaximos; intento++) {
    const leido = await store.getWithMetadata(clave, { type: 'json' });
    const datos = (leido && leido.data) || [];
    const etag = leido ? leido.etag : null;

    const resultadoMutador = mutador(datos);

    const opcionesEscritura = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const escritura = await store.setJSON(clave, datos, opcionesEscritura);

    if (escritura && escritura.modified !== false) {
      return { datos, resultadoMutador };
    }

    const espera = 40 + Math.floor(Math.random() * 90) + intento * 60;
    await new Promise((resolve) => setTimeout(resolve, espera));
  }

  throw new ErrorPeticion(
    409,
    'No se pudo guardar el cambio porque hubo demasiadas ediciones al mismo tiempo. Intenta de nuevo.'
  );
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
  mutarDatos,
  ErrorPeticion,
};
