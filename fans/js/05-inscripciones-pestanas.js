/* ============================================================
   ATP PLATINUM — fans/05-inscripciones-pestanas.js
   Botón inscripción + cambio de pestañas + parse fecha
   ── Refactor: extraído de fans.js (líneas 564-608)
   ============================================================ */

function actualizarBotonInscripcion() {
    const btn = document.getElementById('btn-inscripcion-fans');
    if (!btn) return;

    const estaAbierta = db.convocatoriaAbierta === true;
    const urlInscripcion = "https://los-partidillos-de-los-viernes.netlify.app/inscripciones/inscripciones.html";

    if (estaAbierta) {
        btn.href = urlInscripcion;
        btn.setAttribute('rel', 'noopener noreferrer');
        btn.classList.remove('disabled');
        btn.innerHTML = "🟢 APUNTARME A LA PRÓXIMA JORNADA";
    } else {
        btn.href = "#";
        btn.classList.add('disabled');
        btn.innerHTML = "🔒 INSCRIPCIÓN CERRADA";
    }
}

// 7. CONTROL DE PESTAÑAS
function cambiarPestaña(pestañaId) {
    document.getElementById('vista-directo').style.display = pestañaId === 'directo' ? 'flex' : 'none';
    document.getElementById('vista-historial').style.display = pestañaId === 'historial' ? 'flex' : 'none';

    // ✅ FIX BUG MEDIO 3: antes se usaban índices [0] y [1] — frágil si se añade
    // una pestaña nueva al HTML. Ahora se busca por atributo onclick para ser robusto.
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btnActivo = document.querySelector(`.tab-btn[onclick*="${pestañaId}"]`);
    if (btnActivo) btnActivo.classList.add('active');
}

// ── Helper: parsear fecha de jornada a timestamp para ordenar ──────────────
// Soporta "2026-04-24" (ISO) y "24/4/2026" / "24/04/2026" (ES)
function _parseFechaJornada(rawFecha) {
    if (!rawFecha) return 0;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawFecha)) {
        return new Date(rawFecha).getTime();
    }
    const m = rawFecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`).getTime();
    const t = new Date(rawFecha).getTime();
    return isNaN(t) ? 0 : t;
}

// 8. RENDER DEL HISTORIAL COMPACTO (Acordeón Platinum)
