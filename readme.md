# ATP — Corrección de estructura del deploy

## TL;DR — Hay 1 archivo en el sitio equivocado

Tu deploy está casi correcto pero **`31-hub-navegacion.js` está en la
RAÍZ del proyecto cuando debería estar en `js/`**. La app carga
`js/31-hub-navegacion.js` (la versión vieja sin parchear), y el
archivo parcheado en la raíz no se carga nunca.

Por eso el bug de navegación que ya arreglé sigue presente en
producción.

## Cómo corregirlo (3 pasos, ~30 segundos)

### Paso 1 — En tu carpeta local de deploy

```
TU_CARPETA_LOCAL/
├── 31-hub-navegacion.js   ← ESTE ARCHIVO
├── index.html
├── js/
│   ├── 31-hub-navegacion.js   ← TIENES QUE SUSTITUIR ESTE
│   └── ...
└── ...
```

**Mueve** el archivo `31-hub-navegacion.js` (de la raíz) **dentro
de `js/`**, sobreescribiendo el viejo. Después de mover, en la
raíz no debe quedar ningún archivo `31-hub-navegacion.js`.

### Paso 2 — Limpiar README sueltos (opcional pero recomendado)

Si tienes estos archivos en tu carpeta de deploy, **bórralos**:

- `TU_CARPETA_LOCAL/README.md` (mi documentación, no aporta a la app)
- `TU_CARPETA_LOCAL/js/README.md` (igual)

NO borres `README-refactor.md` que viene del refactor original
(ese sí es tuyo).

### Paso 3 — Re-deploy a Netlify

Drag-and-drop la carpeta entera. Tras el deploy:

```js
// En F12 Console del sitio público
fetch('js/31-hub-navegacion.js?v='+Date.now())
  .then(r => r.text())
  .then(t => console.log('Tiene fix navegación:', t.includes('navegarA')))
```

Debe imprimir `Tiene fix navegación: true`.

## Auditoría completa (resultado final tras la corrección)

| Fix | Aplicado |
|-----|----------|
| Navegación (navegarA, _SECCIONES_REQUIEREN_JORNADA) | ✓ |
| Race jornada (flag _jornadaIniciadaSesion) | ✓ |
| Venganza (orden correcto) | ✓ |
| TB admin (jA=jB con TB desempata) | ✓ |
| Banner "⏳ Sincronizando" cuando jornada=undefined | ✓ |

Sin errores JS. 4/4 fixes operativos.

## Archivo entregado

En esta carpeta hay UN archivo: `31-hub-navegacion.js`. Es el que
tienes que mover/sobreescribir dentro de `js/` en tu deploy.

(También está limpio: comprueba el md5 esperado: `2ee2c78dd39d471678c1847b76ea87ec`.)
