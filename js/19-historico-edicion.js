/* ============================================================
   ATP PLATINUM — 19-historico-edicion.js
   Borrar / editar MVP de jornada histórica
   ── Refactor: extraído de script.js (líneas [(6221, 6462)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// BORRAR JORNADA
// ==========================================
function borrarJornadaHistorial(idRecibido) {
    // 1. Verificación de seguridad para el usuario
    if (!confirm("⚠️ ¿ESTÁS SEGURO?\n\nVas a eliminar esta jornada definitivamente del historial.\nEsta acción NO se puede deshacer.")) {
        return;
    }

    // 2. Verificación de existencia de datos
    if (!db.historicoJornadas) return;

    // FIX-8G: buscar la jornada antes de filtrar para poder revertir puntos
    const jornada = db.historicoJornadas.find(j => {
        const idExistente = j.id || j.timestamp;
        return String(idExistente) === String(idRecibido);
    });

    if (!jornada) {
        console.warn("❌ No se encontró la jornada para eliminar.");
        alert("Error: No se pudo localizar la jornada en la base de datos.");
        return;
    }

    // FIX-8G: revertir puntos de todos los partidos y MVPs de jornada
    // (igual que eliminarJornadaHistorial en admin)
    (Array.isArray(jornada.partidos) ? jornada.partidos : Object.values(jornada.partidos || {})).forEach(p => {
        if (typeof revertirPuntosPartido === 'function') revertirPuntosPartido(p, jornada.asistentes || []);
    });
    if (typeof revertirMvpsDual === 'function') revertirMvpsDual(jornada);

    // 3. Filtrado
    const totalAntes = db.historicoJornadas.length;
    db.historicoJornadas = db.historicoJornadas.filter(j => {
        const idExistente = j.id || j.timestamp;
        return String(idExistente) !== String(idRecibido);
    });

    // 4. Feedback y Guardado
    if (db.historicoJornadas.length < totalAntes) {
        saveDB();
        if (typeof renderRanking === 'function') renderRanking();
        if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
        renderHistoricoGeneral();
        console.log(`✅ Jornada eliminada con reversión de puntos (ID: ${idRecibido})`);
    } else {
        console.warn("❌ No se encontró la jornada para eliminar.");
        alert("Error: No se pudo localizar la jornada en la base de datos.");
    }
}

// ==========================================
// EDITAR MVP DE JORNADA HISTÓRICA
// ==========================================
function editarMVPHistorial(idRecibido) {
    const jornada = (db.historicoJornadas || []).find(j =>
        String(j.id || j.timestamp) === String(idRecibido)
    );
    if (!jornada) return alert("❌ Jornada no encontrada.");

    const jugadores = db.jugadores || [];
    if (jugadores.length === 0) return alert("❌ No hay jugadores en la cantera.");

    const gN = id => jugadores.find(j => String(j.id) === String(id))?.nombre || String(id);

    // Estado actual
    const mvpJActual = Array.isArray(jornada.mvpIdsJugadores)    ? [...jornada.mvpIdsJugadores]    : [];
    const mvpEActual = Array.isArray(jornada.mvpIdsEntrenadores) ? [...jornada.mvpIdsEntrenadores] : [];

    // Construir modal inline
    const modalId = `modal-editar-mvp-${idRecibido}`;
    let modalEl = document.getElementById(modalId);
    if (modalEl) modalEl.remove(); // reset si ya existía

    const checkboxesJ = jugadores.map(j =>
        `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;cursor:pointer;">
            <input type="checkbox" value="${j.id}" ${mvpJActual.includes(String(j.id)) ? 'checked' : ''}
                style="width:16px;height:16px;accent-color:#10ac84;">
            <span style="font-size:0.88rem;font-weight:600;">${j.nombre}</span>
        </label>`
    ).join('');

    const checkboxesE = jugadores.map(j =>
        `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;cursor:pointer;">
            <input type="checkbox" value="${j.id}" ${mvpEActual.includes(String(j.id)) ? 'checked' : ''}
                style="width:16px;height:16px;accent-color:#C5A059;">
            <span style="font-size:0.88rem;font-weight:600;">${j.nombre}</span>
        </label>`
    ).join('');

    modalEl = document.createElement('div');
    modalEl.id = modalId;
    modalEl.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;
        display:flex;align-items:center;justify-content:center;padding:20px;`;
    const sinMVP = mvpJActual.length === 0 && mvpEActual.length === 0;
    modalEl.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${sinMVP ? '12px' : '20px'};">
                <h3 style="margin:0;color:#001e3c;font-size:1rem;">👑 Editar MVP — ${jornada.fecha || ''}</h3>
                <button onclick="document.getElementById('${modalId}').remove()"
                    style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#888;">✕</button>
            </div>

            ${sinMVP ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.3rem;">⚠️</span>
                <div>
                    <div style="font-size:0.75rem;font-weight:900;color:#991b1b;">Esta jornada no tiene MVP asignado</div>
                    <div style="font-size:0.68rem;color:#b91c1c;margin-top:2px;">Puedes asignarlo ahora o guardar igualmente sin MVP.</div>
                </div>
            </div>` : ''}

            <div style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:10px;padding:14px;margin-bottom:16px;">
                <div style="font-size:0.7rem;font-weight:900;color:#065f46;letter-spacing:2px;margin-bottom:10px;">🗳️ MVP JUGADORES (+3 pts)</div>
                <div id="checks-mvpJ-${idRecibido}">${checkboxesJ}</div>
            </div>

            <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px;margin-bottom:20px;">
                <div style="font-size:0.7rem;font-weight:900;color:#92400e;letter-spacing:2px;margin-bottom:10px;">👨‍🏫 MVP ENTRENADORES (+2 pts)</div>
                <div id="checks-mvpE-${idRecibido}">${checkboxesE}</div>
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="document.getElementById('${modalId}').remove()"
                    style="flex:1;padding:12px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-weight:700;color:#374151;">
                    Cancelar
                </button>
                <button onclick="guardarMVPHistorial('${idRecibido}', '${modalId}')"
                    style="flex:2;padding:12px;background:#C5A059;color:#001e3c;border:none;border-radius:8px;cursor:pointer;font-weight:900;letter-spacing:1px;">
                    ✅ GUARDAR
                </button>
            </div>
            <p style="text-align:center;font-size:0.65rem;color:#9ca3af;margin-top:10px;">
                Puedes guardar sin seleccionar ningún MVP — la jornada quedará registrada sin reconocimiento.
            </p>
        </div>`;
    document.body.appendChild(modalEl);
}

function guardarMVPHistorial(idRecibido, modalId) {
    // ✅ FIX BUG IDEMPOTENCIA: guard contra doble click rápido.
    // Si el admin pulsa "GUARDAR" dos veces antes de que se cierre el modal,
    // el segundo click leía las queries con el modal ya parcialmente cerrado
    // (dependiendo del timing del browser) y obtenía nuevosJ=[]/nuevosE=[],
    // entonces "revertía" los MVP recién aplicados. Bloqueamos por jornada 1.5s.
    if (!window._guardarMVPHistEnCurso) window._guardarMVPHistEnCurso = {};
    if (window._guardarMVPHistEnCurso[idRecibido]) {
        console.warn('Doble click ignorado: guardarMVPHistorial en curso');
        return;
    }
    window._guardarMVPHistEnCurso[idRecibido] = true;
    setTimeout(() => { window._guardarMVPHistEnCurso[idRecibido] = false; }, 1500);

    const jornada = (db.historicoJornadas || []).find(j =>
        String(j.id || j.timestamp) === String(idRecibido)
    );
    if (!jornada) return;

    const jugadores = db.jugadores || [];
    const gN = id => jugadores.find(j => String(j.id) === String(id))?.nombre || String(id);

    // Leer selección actual del modal
    const nuevosJ = [...document.querySelectorAll(`#checks-mvpJ-${idRecibido} input:checked`)].map(el => String(el.value));
    const nuevosE = [...document.querySelectorAll(`#checks-mvpE-${idRecibido} input:checked`)].map(el => String(el.value));

    const anterioresJ = Array.isArray(jornada.mvpIdsJugadores)    ? jornada.mvpIdsJugadores.map(String)    : [];
    const anterioresE = Array.isArray(jornada.mvpIdsEntrenadores) ? jornada.mvpIdsEntrenadores.map(String) : [];

    // ── Helper: status invitado en el contexto de esta jornada ───────────
    // Usamos el registro histórico de asistentes (fuente de verdad), con fallback
    // al estado actual de la ficha si el jugador no estaba en la jornada.
    const esInvJornada = (id) => {
        const a = (jornada.asistentes || []).find(x => String(x.id) === String(id));
        if (a) return !!a.esInvitado;
        const jj = jugadores.find(x => String(x.id) === String(id));
        return jj ? !!jj.esInvitado : false;
    };

    // ── Revertir puntos de los que se quitan ──────────────────────────────
    // ✅ FIX-MVP-HIST: no revertir a invitados (nunca acumularon esos puntos)
    // ✅ FIX-DOBLE-MVP: si era J+E a la vez, restar los puntos de ambos roles
    //    correctamente. La lógica anterior dejaba sin restar los 2pts de E cuando
    //    el jugador era simultáneamente J (por el guard `!anterioresE.includes(id)`
    //    en el forEach de J, y `!anterioresJ.includes(id)` en el de E).
    //    Ahora calculamos los puntos netos que recibió y los restamos una sola vez.
    const idsQuitadosJ = anterioresJ.filter(id => !nuevosJ.includes(id));
    const idsQuitadosE = anterioresE.filter(id => !nuevosE.includes(id));
    const idsQuitadosTodos = [...new Set([...idsQuitadosJ, ...idsQuitadosE])];
    idsQuitadosTodos.forEach(id => {
        if (esInvJornada(id)) return;
        const j = jugadores.find(x => String(x.id) === id);
        if (!j) return;
        // Calcular cuántos puntos recibió como MVP en esta jornada
        const eraJ = anterioresJ.includes(id);
        const eraE = anterioresE.includes(id);
        // eraJ gana prioridad: si era J (y no E también), +3. Si era E (y no J), +2.
        // Si era ambos: recibió +3 (misma lógica que aplicarMvps en live y admin).
        let ptsRecibidos = 0;
        if (eraJ) ptsRecibidos = 3;
        else if (eraE) ptsRecibidos = 2;
        j.puntosTotales = Math.max(0, (j.puntosTotales || 0) - ptsRecibidos);
        if (eraJ) { j.stats = j.stats || {}; j.stats.mvps = Math.max(0, (j.stats.mvps || 0) - 1); }
    });

    // ── Aplicar puntos de los nuevos que se añaden ────────────────────────
    // ✅ FIX-MVP-HIST: nunca asignar puntos a invitados de la jornada
    nuevosJ.forEach(id => {
        if (!anterioresJ.includes(id) && !esInvJornada(id)) {
            const j = jugadores.find(x => String(x.id) === id);
            if (j && !nuevosE.includes(id))
                j.puntosTotales = (j.puntosTotales || 0) + 3;
            if (j) { j.stats = j.stats || {}; j.stats.mvps = (j.stats.mvps || 0) + 1; }
        }
    });
    nuevosE.forEach(id => {
        if (!anterioresE.includes(id) && !esInvJornada(id)) {
            const j = jugadores.find(x => String(x.id) === id);
            if (j && !nuevosJ.includes(id))
                j.puntosTotales = (j.puntosTotales || 0) + 2;
        }
    });

    // ── Persistir en el registro histórico ───────────────────────────────
    jornada.mvpIdsJugadores    = [...nuevosJ];
    jornada.mvpIdsEntrenadores = [...nuevosE];
    const todos = [...new Set([...nuevosJ, ...nuevosE])];
    jornada.mvpIds = [...todos];
    jornada.mvp    = todos.map(gN).join(', ') || null;

    // ── Actualizar ultimoMVP si es la jornada más reciente ────────────────
    const ultimaId = String((db.historicoJornadas || []).reduce((max, j) =>
        (j.id || j.timestamp || 0) > (max.id || max.timestamp || 0) ? j : max,
        { id: 0 }
    ).id || 0);
    if (ultimaId === String(idRecibido)) {
        const partesUltimoMVP = [];
        if (nuevosJ.length) partesUltimoMVP.push(`🗳️ ${nuevosJ.map(gN).join(', ')}`);
        if (nuevosE.length) partesUltimoMVP.push(`👨‍🏫 ${nuevosE.map(gN).join(', ')}`);
        db.ultimoMVP = partesUltimoMVP.join(' · ') || null;
    }

    saveDB();
    if (typeof renderHistoricoGeneral === 'function') renderHistoricoGeneral();
    if (typeof renderRanking === 'function') renderRanking();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();

    document.getElementById(modalId)?.remove();
    alert(`✅ MVP actualizado.\n🗳️ Jugadores: ${nuevosJ.map(gN).join(', ') || 'ninguno'}\n👨‍🏫 Entrenadores: ${nuevosE.map(gN).join(', ') || 'ninguno'}`);
}


// --- CANTERA Y SKILLS ---

