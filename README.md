# SGSA AQUAA v1.0

Aplicación web para registrar solicitudes de materiales e insumos.

## Archivos para GitHub Pages

Sube a la raíz del repositorio:

- `index.html`
- `css/`
- `js/`
- `img/`
- `README.md`

La carpeta `backend/` contiene el código de Google Apps Script y no es necesaria para que GitHub Pages publique la interfaz.

## Google Sheets

Crea dos hojas con estos nombres exactos:

### Solicitudes

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Folio | Fecha | Nombre | Área | Correo | Sucursal | Observaciones | Estatus |

### Detalle

| A | B | C | D | E |
|---|---|---|---|---|
| Folio | Categoría | Material | Cantidad | Unidad |

## Google Apps Script

1. Copia el contenido de `backend/GoogleAppsScript.gs`.
2. Pégalo en el proyecto vinculado a Google Sheets.
3. Guarda.
4. Ve a **Implementar → Administrar implementaciones**.
5. Edita la implementación y selecciona **Nueva versión**.
6. Ejecutar como: **Yo**.
7. Acceso: **Cualquier usuario**.
8. Implementa.

La URL configurada actualmente en `js/app.js` es:

`https://script.google.com/macros/s/AKfycbzV21JNPxd3ojDf28YdEe67vVExuUho6jBRX7vS-CpiC1wrVCmsyvONTdlZWLt7X6Z_/exec`

## Publicación en GitHub

1. Abre el repositorio.
2. Selecciona **Add file → Upload files**.
3. Arrastra el contenido de esta carpeta.
4. Haz clic en **Commit changes**.
5. Espera a que GitHub Pages publique los cambios.
