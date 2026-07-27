# SGSA AQUAA — Frontend v4.2

Reconstrucción completa del portal de solicitudes de almacén.

## Objetivos del rediseño

- Reducir espacios verticales excesivos.
- Mantener el contenido institucional y las instrucciones operativas.
- Conservar el logo oficial de AQUAA como favicon.
- Facilitar la captura en escritorio, tableta y celular.
- Mantener la comunicación con Google Apps Script mediante un JSON estable.

## Estructura

- `index.html`: estructura semántica del formulario.
- `css/styles.css`: diseño compacto y adaptable.
- `js/catalogos.js`: catálogo actual de materiales.
- `js/app.js`: interacción del formulario y comunicación con Apps Script.
- `img/`: logotipos institucionales.

## Contrato de datos enviado al backend

```json
{
  "nombre": "",
  "correo": "",
  "area": "",
  "sucursal": "",
  "observaciones": "",
  "productos": [
    {
      "codigo": "",
      "categoria": "",
      "material": "",
      "cantidad": 1,
      "unidad": ""
    }
  ]
}
```

## Publicación

Reemplazar en el repositorio los archivos y carpetas de esta versión. GitHub Pages publicará únicamente el frontend. El backend se revisará por separado.


## Cambios incorporados en v4.2

- Nuevo archivo `js/catalogos-generales.js`.
- Áreas, sucursales y unidades se cargan dinámicamente.
- El campo Unidad cambió de texto libre a lista de selección.
- Se corrigió la URL vigente de Google Apps Script.
- Se corrigieron errores de sintaxis detectados en `js/app.js`.
