const { storeDatos, json, manejarErrores } = require('./_comun');
const datosIniciales = require('./datos_iniciales.json');

const CLAVE = 'datos_catalogo';

exports.handler = manejarErrores(async (event) => {
  const store = storeDatos(event);
  let datos = await store.get(CLAVE, { type: 'json' });

  if (!datos) {
    // Primera vez: sembramos con el JSON original que venia en el paquete
    datos = datosIniciales;
    await store.setJSON(CLAVE, datos);
  }

  return json(200, datos);
});
