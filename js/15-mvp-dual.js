/* ============================================================
   ATP PLATINUM — 15-mvp-dual.js
   MVP dual (jugadores votos verbales + entrenadores selección directa)
   ── Refactor: extraído de script.js (líneas [(5273, 5429)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// MVP DUAL: JUGADORES (votos verbales) + ENTRENADORES (selección directa)
// ==========================================

function _recalcularMvpIdsHoy() {
    const j = Array.isArray(window.mvpIdsJugadores)    ? window.mvpIdsJugadores    : [];
    const e = Array.isArray(window.mvpIdsEntrenadores) ? window.mvpIdsEntrenadores : [];
    window.mvpIdsHoy = [...new Set([...j, ...e].map(String))];
    window.mvpIdHoy  = window.mvpIdsHoy.length ? window.mvpIdsHoy[window.mvpIdsHoy.length - 1] : null;
    db.mvpIdsHoy = [...window.mvpIdsHoy];
    db.mvpIdHoy  = window.mvpIdHoy;
}

function asignarMVPEntrenadores(id) {
    const idStr = id.toString();
    const j = db.jugadores.find(x => x.id.toString() === idStr);
    if (!j) return alert("\u274c Jugador no encontrado en la base de datos.");
    if (!Array.isArray(window.mvpIdsEntrenadores)) window.mvpIdsEntrenadores = [];

    // ✅ FIX BUG MVP DOBLE APLICACIÓN: registrar puntos aplicados POR JUGADOR
    // en db.mvpPuntosAplicados para que consolidarMVPsDelDia (al cerrar jornada)
    // sepa que ya están aplicados y no los duplique.
    if (!db.mvpPuntosAplicados || typeof db.mvpPuntosAplicados !== 'object') {
        db.mvpPuntosAplicados = {};
    }

    const yaEsMVP = window.mvpIdsEntrenadores.includes(idStr);
    j.stats = j.stats || {};
    if (yaEsMVP) {
        // Revertir: -2pts (solo si no es tambien MVP de jugadores)
        window.mvpIdsEntrenadores = window.mvpIdsEntrenadores.filter(x => x !== idStr);
        if (!(window.mvpIdsJugadores || []).includes(idStr)) {
            j.puntosTotales = Math.max(0, (j.puntosTotales || 0) - 2);
        }
        // ✅ FIX RANKING ICONO MVP-E: contador separado para entrenadores.
        // El display del ranking lo usará para mostrar 👨‍🏫 al lado del nombre.
        j.stats.mvpsEntrenador = Math.max(0, (j.stats.mvpsEntrenador || 0) - 1);
        // Limpiar registro: el +2 ya no está aplicado
        if (db.mvpPuntosAplicados[idStr]) {
            db.mvpPuntosAplicados[idStr] = db.mvpPuntosAplicados[idStr].replace('E', '');
            if (!db.mvpPuntosAplicados[idStr]) delete db.mvpPuntosAplicados[idStr];
        }
    } else {
        // Asignar: +2pts (solo si no es tambien MVP de jugadores, evitar doble suma)
        window.mvpIdsEntrenadores.push(idStr);
        if (!(window.mvpIdsJugadores || []).includes(idStr)) {
            // Invitados no acumulan puntos MVP
            if (!j.esInvitado) j.puntosTotales = (j.puntosTotales || 0) + 2;
        }
        // ✅ FIX RANKING ICONO MVP-E: incrementar contador (incluso si es invitado
        // no, porque invitados no deberían acumular ningún tipo de MVP)
        if (!j.esInvitado) {
            j.stats.mvpsEntrenador = (j.stats.mvpsEntrenador || 0) + 1;
        }
        // Registrar: el +2 está aplicado
        if (!j.esInvitado) {
            const tag = db.mvpPuntosAplicados[idStr] || '';
            if (!tag.includes('E')) db.mvpPuntosAplicados[idStr] = tag + 'E';
        }
    }
    db.mvpIdsEntrenadores = [...window.mvpIdsEntrenadores];
    window._mvpPuntosYaAplicadosHoy = true;
    _recalcularMvpIdsHoy();
    saveDB();
    if (typeof sincronizarTV === 'function') sincronizarTV();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof renderRanking === 'function') renderRanking();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
}

// Cambiar voto de jugador para MVP

function cambiarVotoJugador(id, delta) {
    // BUG 4 FIX: la funcion anterior ignoraba delta — era un no-op.
    const idStr = id.toString();
    if (!window.votosJugadoresMVP) window.votosJugadoresMVP = {};
    const actual = Number(window.votosJugadoresMVP[idStr] || 0);
    const nuevo = Math.max(0, actual + delta);
    if (nuevo === 0) {
        delete window.votosJugadoresMVP[idStr];
    } else {
        window.votosJugadoresMVP[idStr] = nuevo;
    }
    db.votosJugadoresMVP = { ...window.votosJugadoresMVP };
    saveDB();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
}

// ── VOTACIÓN EN PISTA ───────────────────────────────────────────────────────
// Cada jugador dice verbalmente su MVP. El admin selecciona en el desplegable.
// Los votos se acumulan en window.votosJugadoresMVP (candidatoId → total votos)
// y en db.votosDe (votanteId → candidatoId elegido) para poder revertir si cambia.

function registrarVotoPista(votanteId, candidatoId) {
    if (!window.votosJugadoresMVP) window.votosJugadoresMVP = {};
    if (!db.votosDe) db.votosDe = {};

    const votoAnterior = db.votosDe[votanteId] || '';

    // Revertir voto anterior si existía
    if (votoAnterior && votoAnterior !== candidatoId) {
        window.votosJugadoresMVP[votoAnterior] = Math.max(0, (window.votosJugadoresMVP[votoAnterior] || 0) - 1);
        if (window.votosJugadoresMVP[votoAnterior] === 0) delete window.votosJugadoresMVP[votoAnterior];
    }

    // Registrar nuevo voto
    if (candidatoId && candidatoId !== votoAnterior) {
        window.votosJugadoresMVP[candidatoId] = (window.votosJugadoresMVP[candidatoId] || 0) + 1;
        db.votosDe[votanteId] = candidatoId;
    } else if (!candidatoId) {
        // Borrar voto (selección "— sin votar —")
        delete db.votosDe[votanteId];
    }

    // Sincronizar y refrescar
    db.votosJugadoresMVP = { ...window.votosJugadoresMVP };
    saveDB();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
}

function confirmarMVPJugadores() {
    const votos = window.votosJugadoresMVP || {};
    const maxVotos = Math.max(0, ...Object.values(votos).map(Number));
    if (maxVotos === 0) return alert("⚠️ No hay votos registrados todavía.");

    const ganadores = Object.entries(votos)
        .filter(([, v]) => Number(v) === maxVotos).map(([id]) => id.toString());

    // ✅ FIX BUG MVP DOBLE APLICACIÓN: registro persistido por jugador
    if (!db.mvpPuntosAplicados || typeof db.mvpPuntosAplicados !== 'object') {
        db.mvpPuntosAplicados = {};
    }

    // Revertir anteriores que ya no ganan (+3pts → -3pts)
    const anteriores = Array.isArray(window.mvpIdsJugadores) ? window.mvpIdsJugadores : [];
    anteriores.forEach(idStr => {
        if (!ganadores.includes(idStr)) {
            const jj = db.jugadores.find(x => x.id.toString() === idStr);
            if (!jj) return;
            if (!(window.mvpIdsEntrenadores || []).includes(idStr))
                jj.puntosTotales = Math.max(0, (jj.puntosTotales || 0) - 3);
            jj.stats = jj.stats || {};
            jj.stats.mvps = Math.max(0, (jj.stats.mvps || 0) - 1);
            // Limpiar registro: el +3 ya no está aplicado
            if (db.mvpPuntosAplicados[idStr]) {
                db.mvpPuntosAplicados[idStr] = db.mvpPuntosAplicados[idStr].replace('J', '');
                if (!db.mvpPuntosAplicados[idStr]) delete db.mvpPuntosAplicados[idStr];
            }
        }
    });
    // Aplicar nuevos ganadores +3pts
    ganadores.forEach(idStr => {
        if (!anteriores.includes(idStr)) {
            const jj = db.jugadores.find(x => x.id.toString() === idStr);
            if (!jj) return;
            if (!(window.mvpIdsEntrenadores || []).includes(idStr))
                jj.puntosTotales = (jj.puntosTotales || 0) + 3;
            jj.stats = jj.stats || {};
            jj.stats.mvps = (jj.stats.mvps || 0) + 1;
            // Registrar: el +3 está aplicado
            if (!jj.esInvitado) {
                const tag = db.mvpPuntosAplicados[idStr] || '';
                if (!tag.includes('J')) db.mvpPuntosAplicados[idStr] = tag + 'J';
            }
        }
    });
    window.mvpIdsJugadores = ganadores;
    db.mvpIdsJugadores = [...ganadores];
    _recalcularMvpIdsHoy();
    window._mvpPuntosYaAplicadosHoy = true;

    const nombres = ganadores.map(id => db.jugadores.find(x => x.id.toString() === id)?.nombre || '???').join(', ');
    saveDB();
    if (typeof sincronizarTV === 'function') sincronizarTV();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof renderRanking === 'function') renderRanking();
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    alert(`🗳️ MVP${ganadores.length > 1 ? 's' : ''} JUGADORES (+3pts): ${nombres} (${maxVotos} voto${maxVotos > 1 ? 's' : ''})`);
}

// Alias legacy → rama entrenadores
function asignarMVP(id) { asignarMVPEntrenadores(id); }






