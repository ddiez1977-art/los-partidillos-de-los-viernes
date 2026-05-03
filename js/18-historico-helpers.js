/* ============================================================
   ATP PLATINUM — 18-historico-helpers.js
   Helpers puros de cálculo y reversión de puntos en histórico
   ── Refactor: extraído de script.js (líneas [(5964, 6220)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// TOGGLE DETALLE (expandir/colapsar)
// ==========================================
function toggleDetalleHistorial(timestamp) {
    const detalle = document.getElementById(`detalle-${timestamp}`);
    if (!detalle) return;

    const isHidden = detalle.style.display === 'none' || !detalle.style.display;
    detalle.style.display = isHidden ? 'block' : 'none';

    if (isHidden) {
        detalle.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// ============================================================
// HELPERS DE PUNTOS (puros) Y REVERSIÓN
// ============================================================

function _calcularPtosJugadorEnPartido(p, idStr) {
    if (!p || !p.ids) return 0;
    idStr = String(idStr);
    const esGam = !!(p.gamified || p.tipo === 'gamificado');
    const esAus = !!(p.tipo === 'equipos3');

    if (esGam) {
        const todos = (p.ids || []).map(i => (p.puntosGamificados && p.puntosGamificados[i]) || 0);
        const maxG = Math.max(0, ...todos);
        const pts  = (p.puntosGamificados && p.puntosGamificados[idStr]) || 0;
        const numM = todos.filter(v => v === maxG).length;
        if (maxG === 0) return 1;
        if (numM > 1 && pts === maxG) return 2;
        if (pts === maxG) return 3;
        if (pts === 0) return 0;
        const r = Math.max(1, Math.round((pts / maxG) * 3));
        return r >= 3 ? 2 : r;
    }

    if (esAus) {
        const pts = p.puntosAustraliana || {};
        const maxP = Math.max(0, ...Object.values(pts).map(Number));
        const total = Object.values(pts).reduce((s,v)=>s+(Number(v)||0),0);
        if (total===0||maxP===0) return 0;
        const mis = Number(pts[idStr]||0);
        const esMx = mis === maxP;
        const numMx = Object.values(pts).filter(v=>Number(v)===maxP).length;
        const esEmp = numMx > 1;
        const solo = p.juegosSoloAustraliana || {};
        const deSolo = Number(solo[idStr]||0);
        const dePareja = Math.max(0, mis-deSolo);
        const haySolo = Object.values(solo).some(v=>Number(v)>0);
        const ganSolo = haySolo && esMx && !esEmp && deSolo > dePareja;
        if (esEmp && esMx) return 2;
        if (esMx) return 3 + (ganSolo?1:0);
        return 1;
    }

    const jA = parseInt(p.juegosA)||0, jB = parseInt(p.juegosB)||0;

    // ✅ FIX TIE-BREAK: si el partido fue solo a TB (jA=0,jB=0 pero p.tiebreak activo),
    // usar el ganador del TB en lugar de devolver 0 para todos.
    if (jA===0 && jB===0) {
        if (p.tiebreak && (p.tbPuntosA > 0 || p.tbPuntosB > 0)) {
            const tbA = Number(p.tbPuntosA||0);
            const tbB = Number(p.tbPuntosB||0);
            // BUG 7 FIX: usar calcularEstadoTiebreak() en lugar de lógica inline duplicada.
            // finalizarPartido() ya usa calcularEstadoTiebreak — era inconsistente tener
            // otra implementación aquí. Ahora ambas rutas usan la misma función centralmente.
            let ganadorTB = null;
            if (typeof calcularEstadoTiebreak === 'function') {
                const estadoTB = calcularEstadoTiebreak(tbA, tbB);
                ganadorTB = estadoTB.ganador;
            } else {
                // Fallback si calcularEstadoTiebreak no está disponible
                if (tbA >= 7 && tbA - tbB >= 2) ganadorTB = 'A';
                else if (tbB >= 7 && tbB - tbA >= 2) ganadorTB = 'B';
                else if (tbA >= 6 && tbB >= 6 && tbA - tbB >= 2) ganadorTB = 'A';
                else if (tbA >= 6 && tbB >= 6 && tbB - tbA >= 2) ganadorTB = 'B';
            }
            // Sin ganador TB aún (partido en curso o marcador parcial)
            if (!ganadorTB) {
                // Si hay diferencia clara, asignar provisionalmente
                if (tbA > tbB) ganadorTB = 'A';
                else if (tbB > tbA) ganadorTB = 'B';
                // Si hay empate en TB sin ganador → todos +2
                else return 2;
            }
            const mitadTB = p.tamanoEquipoA!=null ? Number(p.tamanoEquipoA) : Math.floor((p.ids||[]).length/2);
            const idxTB   = (p.ids||[]).map(String).indexOf(idStr);
            const esATB   = idxTB < mitadTB;
            const ganoTB  = (ganadorTB === 'A') === esATB;
            // David vs Goliat en TB
            const tamATB = mitadTB, tamBTB = (p.ids||[]).length - mitadTB;
            let ptsTB = ganoTB ? 3 : 1;
            if (tamATB !== tamBTB && ganoTB) {
                const esPeqTB = esATB ? tamATB < tamBTB : tamBTB < tamATB;
                if (esPeqTB) ptsTB += 1;
            }
            return ptsTB;
        }
        return 0;
    }
    const mitad = p.tamanoEquipoA!=null ? Number(p.tamanoEquipoA) : Math.floor((p.ids||[]).length/2);
    const idx   = (p.ids||[]).map(String).indexOf(idStr);
    const esA   = idx < mitad;
    const ganaA = jA > jB;
    const esEmp = jA===jB && (jA>0||jB>0);
    // ✅ FIX BUG: en empate (4-4), ganaA=false y para el equipo B esA=false →
    // gano = (false===false) = true → asignaba +3 en vez de +2.
    // El empate debe anular gano y dar +2 a todos.
    const gano  = !esEmp && (esA===ganaA);
    let pts2 = esEmp ? 2 : (gano ? 3 : 1);
    const tamA=mitad, tamB=(p.ids||[]).length-mitad;
    if (tamA!==tamB && gano && !esEmp) {
        const esPeq = esA ? tamA<tamB : tamB<tamA;
        if (esPeq) pts2 += 1;
    }
    return pts2;
}

function aplicarPuntosPartido(pa, idsA, idsB, idsG, verbose) {
    if (!pa) return;
    const ids = pa.ids || [...(idsA||[]),...(idsB||[]),...(idsG||[])];
    ids.forEach(id => {
        const j = (db.jugadores||[]).find(x=>String(x.id)===String(id));
        if (!j || j.esInvitado) return;
        const pts = _calcularPtosJugadorEnPartido(pa, String(id));
        if (pts>0) j.puntosTotales = (j.puntosTotales||0) + pts;
        if (verbose) console.log(`[aplicarPuntosPartido] ${j.nombre}: +${pts}`);
    });
}

function aplicarMvps(ids, pts) {
    (ids||[]).forEach(id => {
        const j = (db.jugadores||[]).find(x=>String(x.id)===String(id));
        if (!j || j.esInvitado) return;
        j.puntosTotales = (j.puntosTotales||0) + pts;
        if (pts===3) { if (!j.stats) j.stats={}; j.stats.mvps=(j.stats.mvps||0)+1; }
    });
}

function revertirPuntosPartido(p, asistentesJornada) {
    if (!p || !p.ids) return;
    const asis = asistentesJornada || [];
    const esInv = id => {
        const a = asis.find(x=>String(x.id)===String(id));
        if (a) return !!a.esInvitado;
        const j = (db.jugadores||[]).find(x=>String(x.id)===String(id));
        return j ? !!j.esInvitado : false;
    };
    p.ids.forEach(id => {
        if (esInv(id)) return;
        const j = (db.jugadores||[]).find(x=>String(x.id)===String(id));
        if (!j) return;

        // Revertir puntos de ranking
        const pts = _calcularPtosJugadorEnPartido(p, String(id));
        if (pts>0) j.puntosTotales = Math.max(0,(j.puntosTotales||0)-pts);

        // ✅ FIX: Revertir también stats de victorias/derrotas/totales al borrar una
        // jornada histórica. Sin esto, borrar y re-añadir jornadas infla los contadores
        // indefinidamente → ganados puede superar totales → efectividad > 100%.
        // Solo aplica a jornadas LIVE (esAdmin=false), porque las manuales (NJ)
        // nunca escribieron stats.ganados/totales (solo puntosTotales vía aplicarPuntosPartido).
        if (!p.esAdmin && j.stats) {
            const tipo = (p.tipo || 'individual').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
            const idsArray = (p.ids || []).map(String);
            const idStr = String(id);

            // Descontar del contador de modo correcto
            if      (tipo === 'dobles')    j.stats.dobles      = Math.max(0, (j.stats.dobles      || 0) - 1);
            else if (tipo === 'trios')     j.stats.trios       = Math.max(0, (j.stats.trios       || 0) - 1);
            else if (tipo === 'asimetrico')j.stats.asimetrico  = Math.max(0, (j.stats.asimetrico  || 0) - 1);
            else if (tipo === 'equipos3')  j.stats.australiana = Math.max(0, (j.stats.australiana || 0) - 1);
            else if (tipo === 'gamificado' || p.gamified) j.stats.gamificados = Math.max(0, (j.stats.gamificados || 0) - 1);
            else                           j.stats.simples     = Math.max(0, (j.stats.simples     || 0) - 1);

            // Descontar totales (para modos no-invitado, igual que actualizarEstadisticasJugadores)
            j.stats.totales = Math.max(0, (j.stats.totales || 0) - 1);

            // Descontar ganados / perdidos según el modo
            if (tipo === 'equipos3') {
                // Australiana: comparar por puntosAustraliana
                const pts2 = p.puntosAustraliana || {};
                const allPts = Object.values(pts2).map(Number);
                const maxPts = Math.max(0, ...allPts);
                const numMax = allPts.filter(v => v === maxPts).length;
                const esEmpate = numMax > 1 && maxPts > 0;
                const misPts = Number(pts2[idStr] || 0);
                const esMaximo = misPts === maxPts && maxPts > 0;
                if (!esEmpate) {
                    if (esMaximo)  j.stats.ganados  = Math.max(0, (j.stats.ganados  || 0) - 1);
                    else           j.stats.perdidos = Math.max(0, (j.stats.perdidos || 0) - 1);
                }
                // Revertir juegos favor/contra
                const totalAus = allPts.reduce((s,v) => s+v, 0);
                j.stats.juegosFavor  = Math.max(0, (j.stats.juegosFavor  || 0) - misPts);
                j.stats.juegosContra = Math.max(0, (j.stats.juegosContra || 0) - (totalAus - misPts));

            } else if (tipo === 'gamificado' || p.gamified) {
                // Gamificado: solo revertir si había ganador claro
                if (p.puntosGamificados && Object.keys(p.puntosGamificados).length > 0) {
                    const _all = Object.values(p.puntosGamificados).map(Number);
                    const _max = Math.max(0, ..._all);
                    const _mis = Number(p.puntosGamificados[idStr] || 0);
                    const _numMax = _all.filter(v => v === _max).length;
                    if (_max > 0 && _numMax === 1) {
                        if (_mis === _max) j.stats.ganados  = Math.max(0, (j.stats.ganados  || 0) - 1);
                        else               j.stats.perdidos = Math.max(0, (j.stats.perdidos || 0) - 1);
                    }
                }

            } else if (tipo !== 'gamificado') {
                // Modos competitivos (individual, dobles, trios, asimetrico)
                const _mitad = p.tamanoEquipoA != null ? Number(p.tamanoEquipoA) : Math.floor(idsArray.length / 2);
                const esEquipoA = idsArray.indexOf(idStr) < _mitad;
                const jA = parseInt(p.juegosA || 0);
                const jB = parseInt(p.juegosB || 0);
                const misJuegos = esEquipoA ? jA : jB;
                const susJuegos = esEquipoA ? jB : jA;

                j.stats.juegosFavor  = Math.max(0, (j.stats.juegosFavor  || 0) - misJuegos);
                j.stats.juegosContra = Math.max(0, (j.stats.juegosContra || 0) - susJuegos);

                if (misJuegos > susJuegos)      j.stats.ganados  = Math.max(0, (j.stats.ganados  || 0) - 1);
                else if (misJuegos < susJuegos) j.stats.perdidos = Math.max(0, (j.stats.perdidos || 0) - 1);
            }
        }
    });
}

function revertirMvpsDual(jornada) {
    if (!jornada) return;
    const asis = jornada.asistentes || [];
    const esInv = id => {
        const a = asis.find(x=>String(x.id)===String(id));
        if (a) return !!a.esInvitado;
        const j = (db.jugadores||[]).find(x=>String(x.id)===String(id));
        return j ? !!j.esInvitado : false;
    };
    const mvpJ = Array.isArray(jornada.mvpIdsJugadores)    ? jornada.mvpIdsJugadores.map(String)    : [];
    const mvpE = Array.isArray(jornada.mvpIdsEntrenadores) ? jornada.mvpIdsEntrenadores.map(String) : [];
    mvpJ.forEach(id => {
        if (esInv(id)) return;
        const j = (db.jugadores||[]).find(x=>String(x.id)===String(id));
        if (!j) return;
        if (!mvpE.includes(id)) j.puntosTotales = Math.max(0,(j.puntosTotales||0)-3);
        if (j.stats) j.stats.mvps = Math.max(0,(j.stats.mvps||0)-1);
    });
    mvpE.forEach(id => {
        if (esInv(id)) return;
        const j = (db.jugadores||[]).find(x=>String(x.id)===String(id));
        if (!j) return;
        if (!mvpJ.includes(id)) j.puntosTotales = Math.max(0,(j.puntosTotales||0)-2);
    });
}

