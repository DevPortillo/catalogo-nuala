# Catalogo con panel de administracion (Netlify Functions + Blobs)

## Que cambio respecto al paquete original en PHP

| Antes (PHP) | Ahora |
|---|---|
| `catalogo.html` | `index.html` (raiz del sitio) |
| `admin_catalogo.php` | `admin/index.html` + funciones en `netlify/functions/` |
| `datos.php` | `netlify/functions/get-datos.js` |
| Guardado en `datos_catalogo.json` y carpeta `uploads_catalogo/` | Guardado en **Netlify Blobs** (almacenamiento propio de Netlify, no hay que configurar nada externo) |

El login, la subida de fotos, el cambio de precios y el "quitar foto" funcionan igual que antes, pero
la logica que antes corria en PHP ahora corre en funciones de JavaScript (Netlify Functions), porque
Netlify no ejecuta PHP.

**La clave de acceso al panel es la misma que ya tenias** (el hash bcrypt no se toco).

## Como publicarlo (IMPORTANTE)

Para que las funciones (`netlify/functions/*.js`) funcionen, Netlify necesita instalar las
dependencias (`@netlify/blobs`, `bcryptjs`) durante el build. Esto **no pasa si arrastras la carpeta
directamente** a la web de Netlify (ese metodo solo sirve para sitios 100% estaticos).

Elegi una de estas dos formas:

### Opcion A - Conectar un repositorio de Git (recomendado)
1. Subi esta carpeta completa a un repositorio (GitHub, GitLab o Bitbucket).
2. En Netlify: "Add new site" -> "Import an existing project" -> elegi el repo.
3. Dejá el build command vacio y el publish directory como `.` (ya viene configurado en `netlify.toml`).
4. Netlify va a instalar las dependencias solo y las funciones van a quedar activas.

### Opcion B - Netlify CLI (sin usar Git)
1. Instala la CLI: `npm install -g netlify-cli`
2. Desde esta carpeta: `netlify deploy --prod`
3. La CLI instala dependencias y sube tanto el sitio como las funciones.

## Links una vez publicado
- Catalogo publico: `https://tudominio.netlify.app/`
- Panel de admin: `https://tudominio.netlify.app/admin/`

## Notas
- Las fotos ahora se guardan en Netlify Blobs, no en la carpeta `uploads_catalogo/` (esa carpeta quedo
  en el paquete solo por si la queres usar para otra cosa, ya no la usa el sistema).
- `datos_catalogo.json` en la raiz ya no se usa en vivo (los datos reales viven en Blobs), quedo como
  respaldo de los datos originales con los que arranca el catalogo la primera vez.
- La sesion del admin dura 8 horas y se guarda en el navegador (sessionStorage); se cierra sola al
  cerrar la pestaña o con "Cerrar sesion".
