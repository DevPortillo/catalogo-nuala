const { storeDatos, json, manejarErrores } = require('./_comun');
const datosIniciales = require('./datos_iniciales.json');

const CLAVE = 'datos_catalogo';

exports.handler = manejarErrores(async (event) => {
  const store = storeDatos(event);
  let datos = await store.get(CLAVE, { type: 'json' });

  if (!datos) {
    // Primera vez: sembramos con el JSON original que venia en el paquete.
    // onlyIfNew evita que dos primeras visitas simultaneas se pisen entre si.
    const escritura = await store.setJSON(CLAVE, datosIniciales, { onlyIfNew: true });
    datos = escritura && escritura.modified === false
      ? (await store.get(CLAVE, { type: 'json' })) || datosIniciales
      : datosIniciales;
  }

  return json(200, datos);
});
