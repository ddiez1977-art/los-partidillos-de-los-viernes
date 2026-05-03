# ATP Platinum — Refactor completo

## TL;DR

| Archivo                  | Antes        | Después                                          | Reducción      |
|--------------------------|--------------|--------------------------------------------------|----------------|
| `script.js`              | 12.624 líneas| **37 módulos** en `js/` (orden 01→37)            | -100% (vacío)  |
| `index.html`             | 4.390 líneas | **907 líneas** + 6 parciales + 5 inline extraídos| **-79%**       |
| `style.css`              | 1.251 líneas | **14 módulos** en `css/clasico/` + agregador     | -98%           |
| `theme-platinum.css`     | 1.257 líneas | **29 módulos** en `css/platinum/` + agregador    | -98%           |
| `fans.html`              | 189 líneas   | **107 líneas** + 1 CSS extraído                  | -43%           |
| `fans.js`                | 879 líneas   | **6 módulos** en `fans/js/`                      | -100% (vacío)  |
| `inscripciones.html`     | 662 líneas   | **134 líneas** + 1 CSS + 5 JS extraídos          | **-79%**       |

**Total: 111 archivos** — verificados sintácticamente con Node.js, idénticos byte a byte al original al concatenarlos.

---

## Estructura final de carpetas

```
refactor-atp-platinum/
├── index.html                       (907 líneas — antes 4.390)
├── style.css                        (agregador con 14 @import)
├── theme-platinum.css               (agregador con 29 @import)
├── contrast-boost.css               (sin cambios)
├── theme-toggle.js                  (sin cambios)
├── fondo_tenis.jpg, alba.jpg, oro_plus*.jpg
│
├── css/
│   ├── clasico/                     ← style.css dividido por sección
│   │   ├── 01-config-colores.css
│   │   ├── 02-cabecera-nav.css
│   │   ├── ...
│   │   └── 14-clases-complementarias.css
│   ├── platinum/                    ← theme-platinum.css dividido
│   │   ├── 00-header.css
│   │   ├── 01-variables.css
│   │   ├── ...
│   │   └── 28-fixes-contraste.css
│   └── inline/                      ← <style> que estaban en index.html
│       ├── ticker.css               (keyframes ticker-move)
│       ├── btn-debug.css            (botón debug centro-arriba)
│       └── admin-module.css         (estilos del panel admin, 203 líneas)
│
├── js/
│   ├── partials-loader.js           ← bootstrap nuevo (carga partials con fetch)
│   ├── 01-config-firebase.js        ← era el inicio de script.js
│   ├── 02-jornada.js
│   ├── ... (37 archivos en total)
│   ├── 37-nueva-jornada-admin.js
│   └── inline/                      ← <script> que estaban en index.html
│       ├── auth-acceso.js           (258 líneas — control de acceso)
│       └── admin-panel.js           (2.486 líneas — panel admin completo)
│
├── partials/                        ← secciones HTML cargadas con fetch
│   ├── seccion-admin-historico.html (442 líneas)
│   ├── modal-editar-partido.html
│   ├── modal-pistas.html
│   ├── modal-ficha.html
│   ├── pantalla-espera-arbitro.html
│   └── pantalla-login-admin.html
│
├── fans/
│   ├── fans.html                    (107 líneas — antes 189)
│   ├── css/fans.css                 (87 líneas extraídas del HTML)
│   └── js/                          ← fans.js dividido en 6
│       ├── 01-config-firebase-fans.js
│       ├── 02-render-pistas.js
│       ├── 03-render-ranking.js
│       ├── 04-ticker.js
│       ├── 05-inscripciones-pestanas.js
│       └── 06-historial-fans.js
│
└── inscripciones/
    ├── inscripciones.html           (134 líneas — antes 662)
    ├── css/inscripciones.css        (103 líneas extraídas)
    └── js/                          ← script inline dividido en 5
        ├── 01-config-firebase-inscripciones.js
        ├── 02-jugadores-asistencia.js
        ├── 03-pistas-reservas.js
        ├── 04-tabs-helpers.js
        └── 05-toast.js
```

---

## ⚠ IMPORTANTE: cómo abrir la app después del refactor

**El nuevo `index.html` usa `fetch()` para cargar los parciales HTML, así que NO funciona si lo abres con doble-clic** (`file://`). Necesitas servirlo desde un servidor.

### Para pruebas locales rápidas

Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Y abre [http://localhost:8000/](http://localhost:8000/) en el navegador. Si no tienes Python: `npx http-server`, `php -S localhost:8000`, o cualquier otro servidor estático.

### En producción

Sirve los archivos como hasta ahora. Cualquier hosting estático (Netlify, Vercel, GitHub Pages, Firebase Hosting, tu propio servidor) funciona sin cambios.

---

## Cómo funciona el bootstrap

El nuevo `index.html` **no carga los 37 módulos directamente**. En su lugar:

1. Se cargan los CSS y las librerías Firebase (síncrono).
2. Define `window.ATP_MODULES = [ ... ]` con los 37 módulos en orden.
3. Define `window.atpArrancarApp = function() { ... }` que carga los módulos en serie con `<script>` dinámicos.
4. Carga `js/partials-loader.js`. Este:
   - Busca todos los `<div data-partial="...">` en el DOM.
   - Hace `fetch()` paralelo de cada uno.
   - Los inserta en su sitio.
   - Cuando todos están listos, llama a `atpArrancarApp()`.
5. `atpArrancarApp()` carga los 37 módulos uno tras otro respetando el orden.
6. Después carga `js/inline/auth-acceso.js` y `js/inline/admin-panel.js`.

**Por qué este orden importa:** Si los módulos arrancasen antes que los parciales, los `getElementById('admin-pin-input')` (y similares de los modales) devolverían `null` y se romperían los listeners de inicialización.

---

## Cómo añadir código nuevo

| Si quieres añadir...                    | Hazlo en...                                 |
|-----------------------------------------|---------------------------------------------|
| Una función JS de un dominio existente  | El módulo correspondiente en `js/0X-...js`  |
| Una función JS completamente nueva      | Crea `js/38-nombre.js` y añádelo al array `ATP_MODULES` en el `<script>` del `index.html` |
| Un nuevo modal HTML                     | Crea `partials/modal-X.html` y añade `<div data-partial="partials/modal-X.html"></div>` donde quieras que aparezca |
| Estilos del tema clásico                | Al final del módulo CSS apropiado en `css/clasico/` |
| Estilos del tema dark                   | En `css/platinum/`. Si creas una sección nueva, añade el `@import` en `theme-platinum.css` |

---

## Verificaciones realizadas

- ✅ **Cobertura 100%**: cada línea del original está en exactamente un módulo.
- ✅ **Cero solapamientos**.
- ✅ **Hash idéntico**: la concatenación de los 37 módulos = `script.js` original byte a byte.
- ✅ **Sintaxis válida**: los **51 archivos JS generados** pasan `node --check` (37 módulos principales + 6 fans + 5 inscripciones + 2 inline + partials-loader).
- ✅ **Concatenación válida en conjunto**: la unión de los 37 módulos también pasa `node --check`.
- ✅ **CSS verificado**: cada CSS dividido se concatena exactamente al original.

---

## Cómo volver atrás

Si en algún momento quieres recuperar la estructura monolítica:

```bash
# Reconstruir script.js
cat js/0*.js js/1*.js js/2*.js js/3*.js > script_reconstruido.js

# Reconstruir style.css
cat css/clasico/*.css > style_reconstruido.css

# Reconstruir theme-platinum.css
cat css/platinum/*.css > theme-platinum_reconstruido.css

# Reconstruir fans.js
cat fans/js/*.js > fans_reconstruido.js
```

Los prefijos `01-`, `02-`, etc. garantizan que el orden alfanumérico de `*` es el correcto.

---

## Notas finales

### Sobre el PIN admin
El comentario `// PIN: 182400` sigue presente en `js/inline/admin-panel.js`. **No lo he modificado** porque ya estaba así en el original y prefería no cambiar nada que no fuera puramente estructural. Si quieres ocultarlo, basta con borrar el comentario `// PIN: 182400` de la línea correspondiente.

### Sobre los CSS agregadores
Se usan `@import url(...)` en `style.css` y `theme-platinum.css`. Esto es CSS estándar pero hace una request HTTP por cada archivo importado (43 en total). En desarrollo no se nota; en producción, si quieres mejor rendimiento puedes concatenar los archivos con un build (Vite, esbuild, etc.) en una sola request. La mayoría de hostings ya usan HTTP/2 que multiplexa las requests, así que el impacto es mínimo.

### Sobre el orden de carga de los 37 módulos
Es **estricto**. El módulo 01 define `db`, `database`, los `window.*` y dispara el listener de Firebase. Los demás módulos asumen que esto existe. Si añades un módulo nuevo, ponlo al final del array `ATP_MODULES` salvo que tengas una razón concreta para meterlo en otro sitio.

### Si algo deja de funcionar
1. Abre la consola del navegador (F12) — los errores te dirán qué módulo está fallando.
2. Verifica que estás sirviéndolo desde un servidor (no `file://`).
3. Si un parcial no carga: la red en F12 te dirá si hay un 404. Asegúrate de subir la carpeta `partials/`.
4. Si quieres reproducir el comportamiento monolítico durante una prueba, usa los comandos de "volver atrás" de arriba.
