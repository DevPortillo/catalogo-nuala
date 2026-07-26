const { storeDatos, verificarToken, tokenDesdeHeaders, json, manejarErrores } = require('./_comun');

const CLAVE = 'datos_catalogo';

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

  if (!['precio', 'quitar'].includes(accion)) {
    return json(400, { error: 'Accion no valida' });
  }

  const store = storeDatos(event);
  const datos = (await store.get(CLAVE, { type: 'json' })) || [];

  let mensaje = '';
  for (const categoria of datos) {
    if (parseInt(categoria.id, 10) !== categoriaId) continue;
    const modelo = categoria.modelos && categoria.modelos[indiceModelo];
    if (!modelo) continue;

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
