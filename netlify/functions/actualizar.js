const { storeDatos, verificarToken, tokenDesdeHeaders, json, manejarErrores } = require('./_comun');

const CLAVE = 'datos_catalogo';
const ACCIONES_VALIDAS = [
  'precio',
  'quitar',
  'renombrar_categoria',
  'crear_categoria',
  'eliminar_categoria',
  'agregar_modelo',
  'eliminar_modelo',
];

exports.handler = manejarErrores(async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Metodo no permitido' });
  }

  const token = tokenDesdeHeaders(event);
  if (!verificarToken(token)) {
    return json(401, { error: 'Sesion invalida o expirada.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Solicitud invalida' });
  }

  const { accion, categoria_id, indice_modelo } = body;
  const categoriaId = parseInt(categoria_id, 10);
  const indiceModelo = parseInt(indice_modelo, 10);

  if (!ACCIONES_VALIDAS.includes(accion)) {
    return json(400, { error: 'Accion no valida' });
  }

  const store = storeDatos(event);
  const datos = (await store.get(CLAVE, { type: 'json' })) || [];

  let mensaje = '';

  // Acciones que operan sobre el listado completo de categorias (crear / eliminar)
  if (accion === 'crear_categoria') {
    const nombre = (body.nombre || '').trim();
    if (!nombre) {
      return json(400, { error: 'El nombre de la categoria no puede estar vacio.' });
    }
    const nuevoId = datos.reduce((max, cat) => Math.max(max, parseInt(cat.id, 10) || 0), 0) + 1;
    datos.push({
      id: nuevoId,
      nombre,
      portada: '',
      modelos: [{ precio: 0, imagen: '' }],
    });
    mensaje = 'Categoria creada correctamente.';
    await store.setJSON(CLAVE, datos);
    return json(200, { mensaje, datos });
  }

  if (accion === 'eliminar_categoria') {
    const indiceCat = datos.findIndex((cat) => parseInt(cat.id, 10) === categoriaId);
    if (indiceCat === -1) {
      return json(404, { error: 'No se encontro la categoria.' });
    }
    datos.splice(indiceCat, 1);
    mensaje = 'Categoria eliminada correctamente.';
    await store.setJSON(CLAVE, datos);
    return json(200, { mensaje, datos });
  }

  // Resto de acciones: operan sobre una categoria (y a veces un modelo) puntual
  const categoria = datos.find((cat) => parseInt(cat.id, 10) === categoriaId);
  if (!categoria) {
    return json(404, { error: 'No se encontro la categoria.' });
  }

  if (accion === 'renombrar_categoria') {
    const nombre = (body.nombre || '').trim();
    if (!nombre) {
      return json(400, { error: 'El nombre de la categoria no puede estar vacio.' });
    }
    categoria.nombre = nombre;
    mensaje = 'Nombre actualizado correctamente.';
  } else if (accion === 'agregar_modelo') {
    if (!Array.isArray(categoria.modelos)) categoria.modelos = [];
    categoria.modelos.push({ precio: 0, imagen: '' });
    mensaje = 'Variante agregada correctamente.';
  } else if (accion === 'eliminar_modelo') {
    const modelo = categoria.modelos && categoria.modelos[indiceModelo];
    if (!modelo) {
      return json(404, { error: 'No se encontro la variante indicada.' });
    }
    categoria.modelos.splice(indiceModelo, 1);
    mensaje = 'Variante eliminada correctamente.';
  } else {
    const modelo = categoria.modelos && categoria.modelos[indiceModelo];
    if (!modelo) {
      return json(404, { error: 'No se encontro la variante indicada.' });
    }
    if (accion === 'precio') {
      const nuevoPrecio = parseFloat(body.precio);
      modelo.precio = Number.isFinite(nuevoPrecio) ? nuevoPrecio : 0;
      mensaje = 'Precio actualizado correctamente.';
    } else if (accion === 'quitar') {
      modelo.imagen = '';
      mensaje = 'Foto eliminada correctamente.';
    }
  }

  await store.setJSON(CLAVE, datos);

  return json(200, { mensaje, datos });
});
