const { storeDatos, storeImagenes, verificarToken, tokenDesdeHeaders, json, manejarErrores, mutarDatos, ErrorPeticion, borrarImagenSiExiste } = require('./_comun');

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
  let mensaje = '';
  // Rutas de imagenes que dejan de usarse con esta operacion (variante o categoria
  // borrada, o foto quitada) y que hay que limpiar del storage despues de guardar.
  let imagenesABorrar = [];

  try {
    const { datos } = await mutarDatos(store, CLAVE, (datosActuales) => {
      imagenesABorrar = [];

      if (accion === 'crear_categoria') {
        const nombre = (body.nombre || '').trim();
        if (!nombre) {
          throw new ErrorPeticion(400, 'El nombre de la categoria no puede estar vacio.');
        }
        const nuevoId = datosActuales.reduce((max, cat) => Math.max(max, parseInt(cat.id, 10) || 0), 0) + 1;
        datosActuales.push({
          id: nuevoId,
          nombre,
          portada: '',
          modelos: [{ precio: 0, precioDivisas: 0, imagen: '' }],
        });
        mensaje = 'Categoria creada correctamente.';
        return;
      }

      if (accion === 'eliminar_categoria') {
        const indiceCat = datosActuales.findIndex((cat) => parseInt(cat.id, 10) === categoriaId);
        if (indiceCat === -1) {
          throw new ErrorPeticion(404, 'No se encontro la categoria.');
        }
        const [categoriaEliminada] = datosActuales.splice(indiceCat, 1);
        imagenesABorrar = (categoriaEliminada.modelos || []).map((m) => m.imagen).filter(Boolean);
        mensaje = 'Categoria eliminada correctamente.';
        return;
      }

      const categoria = datosActuales.find((cat) => parseInt(cat.id, 10) === categoriaId);
      if (!categoria) {
        throw new ErrorPeticion(404, 'No se encontro la categoria.');
      }

      if (accion === 'renombrar_categoria') {
        const nombre = (body.nombre || '').trim();
        if (!nombre) {
          throw new ErrorPeticion(400, 'El nombre de la categoria no puede estar vacio.');
        }
        categoria.nombre = nombre;
        mensaje = 'Nombre actualizado correctamente.';
      } else if (accion === 'agregar_modelo') {
        if (!Array.isArray(categoria.modelos)) categoria.modelos = [];
        categoria.modelos.push({ precio: 0, precioDivisas: 0, imagen: '' });
        mensaje = 'Variante agregada correctamente.';
      } else if (accion === 'eliminar_modelo') {
        const modelo = categoria.modelos && categoria.modelos[indiceModelo];
        if (!modelo) {
          throw new ErrorPeticion(404, 'No se encontro la variante indicada.');
        }
        if (modelo.imagen) imagenesABorrar.push(modelo.imagen);
        categoria.modelos.splice(indiceModelo, 1);
        mensaje = 'Variante eliminada correctamente.';
      } else {
        const modelo = categoria.modelos && categoria.modelos[indiceModelo];
        if (!modelo) {
          throw new ErrorPeticion(404, 'No se encontro la variante indicada.');
        }
        if (accion === 'precio') {
          const nuevoPrecio = parseFloat(body.precio);
          modelo.precio = Number.isFinite(nuevoPrecio) ? nuevoPrecio : 0;
          const nuevoPrecioDivisas = parseFloat(body.precioDivisas);
          modelo.precioDivisas = Number.isFinite(nuevoPrecioDivisas) ? nuevoPrecioDivisas : 0;
          mensaje = 'Precios actualizados correctamente.';
        } else if (accion === 'quitar') {
          if (modelo.imagen) imagenesABorrar.push(modelo.imagen);
          modelo.imagen = '';
          mensaje = 'Foto eliminada correctamente.';
        }
      }
    });

    if (imagenesABorrar.length) {
      const imagenes = storeImagenes(event);
      await Promise.all(imagenesABorrar.map((ruta) => borrarImagenSiExiste(imagenes, ruta)));
    }

    return json(200, { mensaje, datos });
  } catch (error) {
    if (error instanceof ErrorPeticion) {
      return json(error.statusCode, { error: error.message });
    }
    throw error;
  }
});
