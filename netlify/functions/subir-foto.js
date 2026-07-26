const crypto = require('crypto');
const { storeDatos, storeImagenes, verificarToken, tokenDesdeHeaders, json, manejarErrores } = require('./_comun');
const { parseMultipart } = require('./_multipart');

const CLAVE = 'datos_catalogo';
const EXTENSIONES_PERMITIDAS = ['jpg', 'jpeg', 'png', 'webp'];
const TAMANO_MAXIMO = 6 * 1024 * 1024; // 6MB, igual que el limite original

exports.handler = manejarErrores(async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Metodo no permitido' });
  }

  const token = tokenDesdeHeaders(event);
  if (!verificarToken(token)) {
    return json(401, { error: 'Sesion invalida o expirada.' });
  }

  let partes;
  try {
    partes = parseMultipart(event);
  } catch {
    return json(400, { error: 'No se pudo leer el formulario.' });
  }

  const campo = (nombre) => partes.find((p) => p.nombre === nombre && !p.nombreArchivo);
  const archivo = partes.find((p) => p.nombre === 'imagen' && p.nombreArchivo);

  const categoriaId = parseInt(campo('categoria_id')?.datos?.toString('utf8'), 10);
  const indiceModelo = parseInt(campo('indice_modelo')?.datos?.toString('utf8'), 10);

  if (!archivo || !archivo.nombreArchivo) {
    return json(400, { error: 'No se recibio ninguna imagen.' });
  }

  const extension = (archivo.nombreArchivo.split('.').pop() || '').toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
    return json(400, { error: 'La imagen debe ser JPG, PNG o WEBP.' });
  }
  if (archivo.datos.length > TAMANO_MAXIMO) {
    return json(400, { error: 'La imagen debe pesar menos de 6MB.' });
  }

  const clave = `cat${categoriaId}_${crypto.randomBytes(6).toString('hex')}.${extension}`;
  const tipoMime = archivo.tipo || `image/${extension === 'jpg' ? 'jpeg' : extension}`;

  const imagenes = storeImagenes(event);
  await imagenes.set(clave, archivo.datos, { metadata: { tipo: tipoMime } });

  const datosStore = storeDatos(event);
  const datos = (await datosStore.get(CLAVE, { type: 'json' })) || [];

  let mensaje = 'No se encontro el modelo indicado.';
  const rutaPublica = `/.netlify/functions/imagen?clave=${encodeURIComponent(clave)}`;

  for (const categoria of datos) {
    if (parseInt(categoria.id, 10) !== categoriaId) continue;
    const modelo = categoria.modelos && categoria.modelos[indiceModelo];
    if (modelo) {
      modelo.imagen = rutaPublica;
      mensaje = 'Foto actualizada correctamente.';
    }
  }

  await datosStore.setJSON(CLAVE, datos);

  return json(200, { mensaje, datos });
});
