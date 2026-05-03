/* ============================================================
   ATP PLATINUM — inscripciones/05-toast.js
   Sistema de toast
   ── Refactor: extraído de inscripciones.html (líneas 653-658)
   ============================================================ */

function mostrarToast(msg, tipo) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = `toast show ${tipo||''}`;
    if (_tt) clearTimeout(_tt);
    _tt = setTimeout(() => t.classList.remove('show'), 2800);
}
