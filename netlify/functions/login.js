const bcrypt = require('bcryptjs');
const { ADMIN_PASS_HASH, TOKEN_TTL_MS, firmarToken, json, manejarErrores } = require('./_comun');

exports.handler = manejarErrores(async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Metodo no permitido' });
  }

  let clave;
  try {
    ({ clave } = JSON.parse(event.body || '{}'));
  } catch {
    return json(400, { error: 'Solicitud invalida' });
  }

  if (!clave) {
    return json(400, { error: 'Falta la clave' });
  }

  // bcryptjs no reconoce el prefijo $2y$ (variante de PHP) aunque el hash es compatible con $2b$
  const hashCompatible = ADMIN_PASS_HASH.replace('$2y$', '$2b$');
  const ok = bcrypt.compareSync(clave, hashCompatible);

  if (!ok) {
    return json(401, { error: 'Clave incorrecta.' });
  }

  const token = firmarToken({ exp: Date.now() + TOKEN_TTL_MS });
  return json(200, { token });
});
