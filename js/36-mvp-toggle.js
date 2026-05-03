/* ============================================================
   ATP PLATINUM — 36-mvp-toggle.js
   Toggle MVP (anti-duplicados) y consolidación diaria
   ── Refactor: extraído de script.js (líneas [(11751, 11858)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// GESTIÓN CORRECTA DE MVPs (ANTI-DUPLICADOS)
// ==========================================

/**
 * Selecciona o deselecciona un MVP del día.
 * SOLO guarda el ID. NO suma puntos ni stats.mvps todavía.
 *
 * ✅ FIX BUG MVP DOBLE APLICACIÓN: ya no es necesario el flag binario
 * _mvpPuntosYaAplicadosHoy. consolidarMVPsDelDia ahora es idempotente
 * (lleva un registro persistido por jugador en db.mvpPuntosAplicados),
 * así que no importa si el admin mezcla este sistema con
 * confirmarMVPJugadores/asignarMVPEntrenadores. Cada cambio se reconcilia
 * correctamente al cerrar la jornada.
 */
function toggleMVP(id, tipo = 'jugador') {
    id = String(id);

    if (tipo === 'jugador') {
        if (!Array.isArray(window.mvpIdsJugadores)) window.mvpIdsJugadores = [];

        if (window.mvpIdsJugadores.includes(id)) {
            window.mvpIdsJugadores = window.mvpIdsJugadores.filter(x => x !== id);
        } else {
            window.mvpIdsJugadores.push(id);
        }
    } else { // entrenador
        if (!Array.isArray(window.mvpIdsEntrenadores)) window.mvpIdsEntrenadores = [];

        if (window.mvpIdsEntrenadores.includes(id)) {
            window.mvpIdsEntrenadores = window.mvpIdsEntrenadores.filter(x => x !== id);
        } else {
            window.mvpIdsEntrenadores.push(id);
        }
    }

    // ✅ MEJORA: consolidar inmediatamente al toggle, así los puntos se reflejan
    // en tiempo real en el ranking. Antes había que esperar al cierre de jornada.
    // consolidarMVPsDelDia es idempotente: detecta automáticamente qué hay que
    // sumar y qué hay que revertir.
    if (typeof consolidarMVPsDelDia === 'function') consolidarMVPsDelDia();

    saveDB();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof renderRanking === 'function') renderRanking();
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    console.log(`MVP ${tipo} toggled: ${id}`);
}

/**
 * Consolidar MVPs al cerrar la jornada.
 *
 * ✅ FIX BUG MVP DOBLE APLICACIÓN:
 *   Antes había un flag binario `_mvpPuntosYaAplicadosHoy` que distinguía
 *   sistema diferido (toggleMVP) de live (confirmarMVPJugadores). Si el admin
 *   MEZCLABA ambos sistemas en la misma jornada (caso real frecuente: confirma
 *   votación y luego añade un MVP olvidado con toggleMVP), el flag se reseteaba
 *   y consolidarMVPsDelDia aplicaba puntos OTRA VEZ a los que ya los tenían.
 *   Resultado: jugadores con 6pts en lugar de 3.
 *
 *   Ahora llevamos en `db.mvpPuntosAplicados = { jugadorId: 'J'|'E'|'JE' }`
 *   un registro POR JUGADOR de qué puntos MVP ya están aplicados. Solo
 *   aplicamos los que falten, y revertimos los que sobran (si el admin
 *   deselecciona). Idempotente sin importar el orden de las acciones.
 */
function consolidarMVPsDelDia() {
    const mvpJugadores    = new Set((window.mvpIdsJugadores    || []).map(String));
    const mvpEntrenadores = new Set((window.mvpIdsEntrenadores || []).map(String));

    // Registro persistido de puntos MVP ya aplicados POR JUGADOR
    // 'J' = aplicado +3 (jugador), 'E' = aplicado +2 (entrenador), 'JE' = ambos
    if (!db.mvpPuntosAplicados || typeof db.mvpPuntosAplicados !== 'object') {
        db.mvpPuntosAplicados = {};
    }
    const aplicado = db.mvpPuntosAplicados;

    let cambios = 0;

    // === 1. JUGADORES MVP (+3pts) ===
    // Para cada jugador candidato, ver si ya tiene aplicado el +3.
    mvpJugadores.forEach(id => {
        const jug = db.jugadores.find(j => String(j.id) === id);
        if (!jug || jug.esInvitado) return;
        const tag = aplicado[id] || '';
        if (!tag.includes('J')) {
            // Aplicar +3pts y registrar
            jug.stats = jug.stats || {};
            jug.stats.mvps = (jug.stats.mvps || 0) + 1;
            jug.puntosTotales = (jug.puntosTotales || 0) + 3;
            aplicado[id] = tag + 'J';
            cambios++;
        }
    });
    // Si algún jugador ESTABA marcado como J pero ya no está en mvpJugadores → revertir
    Object.keys(aplicado).forEach(id => {
        if (aplicado[id].includes('J') && !mvpJugadores.has(id)) {
            const jug = db.jugadores.find(j => String(j.id) === id);
            if (jug && !jug.esInvitado) {
                jug.stats = jug.stats || {};
                jug.stats.mvps = Math.max(0, (jug.stats.mvps || 0) - 1);
                jug.puntosTotales = Math.max(0, (jug.puntosTotales || 0) - 3);
            }
            aplicado[id] = aplicado[id].replace('J', '');
            cambios++;
        }
    });

    // === 2. ENTRENADORES MVP (+2pts, contador separado stats.mvpsEntrenador) ===
    mvpEntrenadores.forEach(id => {
        const jug = db.jugadores.find(j => String(j.id) === id);
        if (!jug || jug.esInvitado) return;
        const tag = aplicado[id] || '';
        if (!tag.includes('E')) {
            jug.puntosTotales = (jug.puntosTotales || 0) + 2;
            // ✅ FIX RANKING ICONO MVP-E: contador separado
            jug.stats = jug.stats || {};
            jug.stats.mvpsEntrenador = (jug.stats.mvpsEntrenador || 0) + 1;
            aplicado[id] = tag + 'E';
            cambios++;
        }
    });
    // Si algún jugador ESTABA marcado como E pero ya no está en mvpEntrenadores → revertir
    Object.keys(aplicado).forEach(id => {
        if (aplicado[id].includes('E') && !mvpEntrenadores.has(id)) {
            const jug = db.jugadores.find(j => String(j.id) === id);
            if (jug && !jug.esInvitado) {
                jug.puntosTotales = Math.max(0, (jug.puntosTotales || 0) - 2);
                jug.stats = jug.stats || {};
                jug.stats.mvpsEntrenador = Math.max(0, (jug.stats.mvpsEntrenador || 0) - 1);
            }
            aplicado[id] = aplicado[id].replace('E', '');
            cambios++;
        }
    });

    // Limpiar entradas vacías del registro
    Object.keys(aplicado).forEach(id => {
        if (!aplicado[id]) delete aplicado[id];
    });

    // Mantener compat con flag legacy (otros sitios pueden seguir leyéndolo)
    window._mvpPuntosYaAplicadosHoy = (mvpJugadores.size + mvpEntrenadores.size) > 0;

    console.log(`consolidarMVPsDelDia: ${cambios} cambios aplicados (idempotente).`);
    saveDB();
}


