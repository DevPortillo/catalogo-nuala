// Parser minimo de multipart/form-data, suficiente para formularios simples
// con campos de texto y un archivo. No depende de librerias externas.

function obtenerBoundary(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) return null;
  return match[1] || match[2];
}

function parseMultipart(event) {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  const boundary = obtenerBoundary(contentType);
  if (!boundary) throw new Error('No se encontro el boundary de multipart');

  const bodyBuffer = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body, 'binary');

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const partes = [];
  let inicio = bodyBuffer.indexOf(boundaryBuffer);

  while (inicio !== -1) {
    const siguiente = bodyBuffer.indexOf(boundaryBuffer, inicio + boundaryBuffer.length);
    if (siguiente === -1) break;

    let trozo = bodyBuffer.slice(inicio + boundaryBuffer.length, siguiente);
    // Quitar el CRLF inicial y el CRLF final antes del proximo boundary
    if (trozo.slice(0, 2).toString() === '\r\n') trozo = trozo.slice(2);
    if (trozo.slice(-2).toString() === '\r\n') trozo = trozo.slice(0, -2);

    if (trozo.length > 0) {
      const separador = trozo.indexOf('\r\n\r\n');
      if (separador !== -1) {
        const encabezados = trozo.slice(0, separador).toString('utf8');
        const contenido = trozo.slice(separador + 4);

        const nombreMatch = /name="([^"]+)"/i.exec(encabezados);
        const archivoMatch = /filename="([^"]*)"/i.exec(encabezados);
        const tipoMatch = /Content-Type:\s*([^\r\n]+)/i.exec(encabezados);

        partes.push({
          nombre: nombreMatch ? nombreMatch[1] : null,
          nombreArchivo: archivoMatch ? archivoMatch[1] : null,
          tipo: tipoMatch ? tipoMatch[1].trim() : null,
          datos: contenido,
        });
      }
    }

    inicio = siguiente;
  }

  return partes;
}

module.exports = { parseMultipart };
