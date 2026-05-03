/* ============================================================
   ATP PLATINUM — partials-loader.js
   Carga los parciales HTML antes de que arranquen los scripts
   modulares. Es CRÍTICO que se ejecute antes de los js/01-*.js
   en el HTML.

   Cómo funciona:
   1. Busca todos los <div data-partial="..."> en el DOM.
   2. Hace fetch() en paralelo de cada uno.
   3. Sustituye el div por el HTML del fichero.
   4. Cuando todos están listos, dispara el evento
      'atp:partials-loaded' y llama window.atpArrancarApp() si existe.

   El index.html debe definir window.atpArrancarApp = function() { ... }
   ANTES de cargar este script. La función arrancará la carga del resto
   de scripts modulares.

   ⚠ IMPORTANTE: si abres el HTML con file:// (sin servidor) los fetch
   fallarán por CORS. Usa siempre un servidor (incluso `python3 -m http.server`).
   ============================================================ */

(function () {
    'use strict';

    function init() {
        const targets = Array.from(document.querySelectorAll('[data-partial]'));
        if (targets.length === 0) {
            // No hay parciales — arranca la app directamente
            arrancar();
            return;
        }

        const promesas = targets.map(function (div) {
            const url = div.getAttribute('data-partial');
            return fetch(url, { cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status + ' al cargar ' + url);
                    return r.text();
                })
                .then(function (html) {
                    // Crear un contenedor temporal y mover sus hijos
                    const tmp = document.createElement('div');
                    tmp.innerHTML = html;
                    const frag = document.createDocumentFragment();
                    while (tmp.firstChild) frag.appendChild(tmp.firstChild);
                    div.parentNode.replaceChild(frag, div);
                })
                .catch(function (err) {
                    console.error('[partials-loader]', err);
                    div.innerHTML = '<div style="color:#f55;padding:8px;border:1px solid #f55;">' +
                                    '⚠ Error cargando ' + url + ': ' + err.message + '</div>';
                });
        });

        Promise.all(promesas).then(function () {
            console.log('[partials-loader] ✓ ' + targets.length + ' parciales cargados');
            arrancar();
        });
    }

    function arrancar() {
        // Dispara evento custom por si algo lo escucha
        try {
            document.dispatchEvent(new CustomEvent('atp:partials-loaded'));
        } catch (e) {}
        // Llama a la función de arranque expuesta por el HTML
        if (typeof window.atpArrancarApp === 'function') {
            window.atpArrancarApp();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
