const { storeImagenes, manejarErrores } = require('./_comun');

exports.handler = manejarErrores(async (event) => {
  const clave = event.queryStringParameters && event.queryStringParameters.clave;
  if (!clave) {
    return { statusCode: 400, body: 'Falta la clave de la imagen' };
  }

  const imagenes = storeImagenes(event);
  const resultado = await imagenes.getWithMetadata(clave, { type: 'arrayBuffer' });

  if (!resultado) {
    return { statusCode: 404, body: 'Imagen no encontrada' };
  }

  const tipo = (resultado.metadata && resultado.metadata.tipo) || 'application/octet-stream';

  return {
    statusCode: 200,
    headers: {
      'Content-Type': tipo,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: Buffer.from(resultado.data).toString('base64'),
    isBase64Encoded: true,
  };
});
