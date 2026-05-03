/* ============================================================
   ATP PLATINUM — 08-score-australiana-toast.js
   Australiana, sumar/restar juegos, anular sin guardar, toast global
   ── Refactor: extraído de script.js (líneas [(3133, 3348)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// AUSTRALIANA — ROTAR RONDA
// Registra el resultado de la ronda actual en el acumulado individual
// y avanza a la siguiente configuración de pareja/solo.
// Rondas para ids=[A,B,C]:
//   0: pareja=[A,B]  solo=C
//   1: pareja=[A,C]  solo=B
//   2: pareja=[B,C]  solo=A
// ==========================================
function rotarAustraliana(idPartido) {
    const p = window.partidosAbiertos.find(x => String(x.id) === String(idPartido));
    if (!p || p.tipo !== 'equipos3') return;

    const [idA, idB, idC] = p.ids.map(String);
    const ronda = p.rondaActual ?? 0;

    // Configuración de cada ronda
    const rondas = [
        { pareja: [idA, idB], solo: idC },
        { pareja: [idA, idC], solo: idB },
        { pareja: [idB, idC], solo: idA }
    ];

    const cfg = rondas[ronda % 3];
    const jPar = parseInt(p.juegosA) || 0; // juegos ganados por la pareja en esta ronda
    const jSol = parseInt(p.juegosB) || 0; // juegos ganados por el solo en esta ronda

    // ✅ FIX BUG ALTO 2: Evitar rotar con 0-0 sin confirmación.
    // Sin esto el admin puede "quemar" una ronda por error sin acumular nada.
    if (jPar === 0 && jSol === 0) {
        if (!confirm('⚠️ El marcador de esta ronda es 0-0.\n\n¿Rotar igualmente sin acumular puntos?')) return;
    }

    // Acumular en puntosAustraliana
    if (!p.puntosAustraliana) p.puntosAustraliana = { [idA]: 0, [idB]: 0, [idC]: 0 };
    // ✅ Acumular juegos ganados siendo el solo (para bonus David vs Goliat y stats)
    if (!p.juegosSoloAustraliana) p.juegosSoloAustraliana = { [idA]: 0, [idB]: 0, [idC]: 0 };

    // SCRIPT-F FIX: normalizar a String() en las claves de puntosAustraliana
    // para evitar entradas duplicadas {"123": 4, 123: 2} cuando id es número de Firebase
    cfg.pareja.forEach(id => {
        const idS = String(id);
        p.puntosAustraliana[idS] = (p.puntosAustraliana[idS] || 0) + jPar;
    });
    const soloIdS = String(cfg.solo);
    p.puntosAustraliana[soloIdS] = (p.puntosAustraliana[soloIdS] || 0) + jSol;
    // Acumular solo cuando el jugador estaba jugando como solo
    p.juegosSoloAustraliana[soloIdS] = (p.juegosSoloAustraliana[soloIdS] || 0) + jSol;

    // Avanzar ronda y resetear marcador de ronda
    p.rondaActual = ronda + 1;
    p.juegosA = 0;
    p.juegosB = 0;

    // Actualizar marcador display: acumulados totales
    const totA = p.puntosAustraliana[idA] || 0;
    const totB = p.puntosAustraliana[idB] || 0;
    const totC = p.puntosAustraliana[idC] || 0;
    const nombreA = db.jugadores.find(j => String(j.id) === idA)?.nombre || 'J1';
    const nombreB = db.jugadores.find(j => String(j.id) === idB)?.nombre || 'J2';
    const nombreC = db.jugadores.find(j => String(j.id) === idC)?.nombre || 'J3';
    p.marcador = `${nombreA}:${totA} · ${nombreB}:${totB} · ${nombreC}:${totC}`;

    saveDB();
    if (typeof renderPistas === 'function') renderPistas();
    if (typeof renderControlPistas === 'function') renderControlPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof sincronizarTV === 'function') sincronizarTV();

    console.log(`🔄 Australiana Pista ${p.pista}: Ronda ${ronda + 1} completada. Nueva ronda: ${p.rondaActual % 3}`);
}

// ✅ NUEVO: sumarJuego por ID
function sumarJuegoPorId(id, equipo) {
    const index = window.partidosAbiertos.findIndex(p => String(p.id) === String(id));
    if (index === -1) return;
    sumarJuego(index, equipo); // Llama a tu función original intacta
}

// ✅ NUEVO: restarJuego por ID
function restarJuegoPorId(id, equipo) {
    const index = window.partidosAbiertos.findIndex(p => String(p.id) === String(id));
    if (index === -1) return;
    restarJuego(index, equipo); // Llama a tu función original intacta
}

// ✅ NUEVO: cambiarPuntoGamificado por ID
function cambiarPuntoGamificadoPorId(idPartido, idJugador, cantidad) {
    const index = window.partidosAbiertos.findIndex(p => String(p.id) === String(idPartido));
    if (index === -1) return;
    cambiarPuntoGamificado(index, idJugador, cantidad);
    // ✅ FIX BUG 3: refrescar la vista de control tras cambiar puntos
    if (typeof renderControlPistas === 'function') renderControlPistas();
}



function anularPartidoSinGuardar(index) {
    // 1. OBTENCIÓN SEGURA DEL PARTIDO
    const partido = window.partidosAbiertos[index];
    if (!partido) return;

    // 2. CONFIRMACIÓN (Adaptada para nombres largos de Tríos)
    const mensaje = `⚠️ ¿ANULAR ESTE PARTIDO?\n\n` +
                    `Pista: ${partido.pista}\n` +
                    `Jugadores: ${partido.nombres}\n\n` +
                    `Se borrará sin guardar historial y los jugadores quedarán LIBRES.`;

    if (!confirm(mensaje)) return;

    // 3. REVERTIR PUNTOS GAMIFICADOS si los había (evita puntos fantasma en ranking)
    // En modo gamificado, el admin puede haber subido puntos individuales durante el partido.
    // Al anular sin finalizar, esos puntos nunca se aplicaron a puntosTotales (solo
    // se aplican en finalizarPartido). No hay nada que revertir. ✅ Verificado: los
    // puntosGamificados solo se suman a puntosTotales dentro de finalizarPartido(), nunca antes.

    // 4. LIBERAR JUGADORES Y GESTIÓN DE VENGANZA
    const listaIdsAnular = (partido.ids || []).map(String);
    (window.jugadoresHoy || []).forEach(j => {
        if (listaIdsAnular.includes(String(j.id))) {
            j.estado = 'disponible';
            // ✅ FIX: Al anular un partido de venganza, todos siguen con perdioUltimo=true
            // (el partido nunca se completó, la deuda sigue vigente).
            // No reseteamos perdioUltimo aquí — se mantiene como estaba.
        }
    });

    // 5. ELIMINAR DE ACTIVOS
    window.partidosAbiertos.splice(index, 1);

    // 6. PERSISTENCIA Y SINCRONIZACIÓN TOTAL (Sin pérdida de datos)
    saveDB();
    
    // Refresco en cadena para que la TV y el HUB se actualicen al milisegundo
    if (typeof renderPistas === 'function') renderPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof renderControlPistas === 'function') renderControlPistas();
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();
    if (typeof sincronizarTV === 'function') sincronizarTV();

    console.log(`🗑️ Pista ${partido.pista} anulada. Jugadores liberados y sistema sincronizado.`);
}

function sumarJuego(index, equipo) {
    const p = window.partidosAbiertos[index];
    // 🛡️ Blindaje: No sumamos puntos si el partido no existe o es Modo Gamificado
    if (!p || p.gamified) return;

    if (equipo === 'A') p.juegosA = (p.juegosA || 0) + 1;
    else p.juegosB = (p.juegosB || 0) + 1;

    // ✅ Australiana: el marcador permanente es el acumulado de rondas (se actualiza en rotarAustraliana).
    // Solo actualizamos marcador para modos estándar para no sobreescribir el acumulado.
    if (p.tipo !== 'equipos3') {
        p.marcador = (p.juegosA || 0) + " - " + (p.juegosB || 0);
    }

    saveDB();
    renderPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof sincronizarTV === 'function') sincronizarTV();
}

function restarJuego(index, equipo) {
    const p = window.partidosAbiertos[index];
    if (!p || p.gamified) return;

    if (equipo === 'A' && p.juegosA > 0) p.juegosA--;
    else if (equipo === 'B' && p.juegosB > 0) p.juegosB--;

    // ✅ Australiana: misma protección del marcador acumulado
    if (p.tipo !== 'equipos3') {
        p.marcador = (p.juegosA || 0) + " - " + (p.juegosB || 0);
    }

    saveDB();
    renderPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof sincronizarTV === 'function') sincronizarTV();
}

// ============================================================
// TOAST GLOBAL (usado por tie-break y otros módulos)
// ============================================================
function mostrarToastGlobal(msg, duracionMs) {
    duracionMs = duracionMs || 2500;
    let toast = document.getElementById('atp-toast-global');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'atp-toast-global';
        Object.assign(toast.style, {
            position: 'fixed', bottom: '80px', left: '50%',
            transform: 'translateX(-50%) translateY(20px)',
            background: '#001e3c', color: '#ccff00',
            border: '2px solid #ccff00', borderRadius: '12px',
            padding: '10px 22px', fontSize: '0.9rem', fontWeight: '900',
            zIndex: '999998', opacity: '0', transition: 'all 0.3s ease',
            pointerEvents: 'none', whiteSpace: 'nowrap',
            fontFamily: "'Segoe UI', sans-serif", letterSpacing: '0.5px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        });
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, duracionMs);
}

