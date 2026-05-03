/* ============================================================
   ATP PLATINUM — inscripciones/04-tabs-helpers.js
   Cambio de tabs y helpers HTML escape
   ── Refactor: extraído de inscripciones.html (líneas 630-652)
   ============================================================ */

// TABS
// ══════════════════════════════════════════════════════════════════════════

function cambiarTab(id) {
    const isInscripcion = id === 'inscripcion';
    document.getElementById('tab-inscripcion').style.display = isInscripcion ? '' : 'none';
    document.getElementById('tab-pistas').style.display      = isInscripcion ? 'none' : '';
    document.querySelectorAll('.tab-btn').forEach((b,i) => {
        b.classList.toggle('active', i === (isInscripcion ? 0 : 1));
    });
    if (!isInscripcion) renderPistas();
}

// ══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════════════════════════

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escapar(n) { return n.replace(/'/g,"\\'").replace(/"/g,'&quot;'); }

let _tt = null;
