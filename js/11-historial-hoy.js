/* ============================================================
   ATP PLATINUM — 11-historial-hoy.js
   Historial del día actual (render + limpieza)
   ── Refactor: extraído de script.js (líneas [(4148, 4333)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function renderHistorialHoy() {
    const container = document.getElementById('lista-partidos-jugados');
    if (!container) return;

    const lista = window.partidosFinalizadosHoy || [];

    // --- ENCABEZADO ---
    let htmlContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid rgba(0,0,0,0.1);">
            <h3 style="margin: 0; color: #001e3c; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.4rem;">🏁</span> Partidos Finalizados
            </h3>
            <div style="display:flex; align-items:center; gap:8px;">
                ${lista.length > 0 ? `<button onclick="compartirWhatsApp()"
                    style="background:#25D366; color:white; border:none; border-radius:16px;
                           padding:4px 12px; font-size:0.72rem; font-weight:700; cursor:pointer;
                           touch-action:manipulation;">
                    📱 Compartir
                </button>` : ''}
                <span style="background: #ff9f43; color: white; padding: 3px 10px; border-radius: 20px; font-weight: bold; font-size: 0.8rem;">
                    Hoy: ${lista.length}
                </span>
            </div>
        </div>
    `;

    if (lista.length === 0) {
        container.innerHTML = htmlContent + '<p style="text-align:center; opacity:0.6; padding:30px 20px; background: rgba(0,0,0,0.02); border-radius: 12px; font-style: italic;">Aún no hay resultados registrados.</p>';
        return;
    }

    const tarjetasHTML = [...lista].reverse().map((p) => {
        const modo = resolverModoPartido(p);
        const esGamificado = modo.esGamificado;
        const esTrio       = modo.esTrio;
        const esAsimetrico = modo.esAsimetrico;
        const esVenganza = p.esVenganza || (p.nombres && p.nombres.includes("🔥"));

        let nombresAMostrar = p.nombres || "Partido Finalizado";
        let marcadorAMostrar = p.marcador || "0-0";

        // ✅ FIX: El bloque gamificado solo se aplica si hay puntosGamificados
        // con al menos una clave. Sin esta comprobación, finalizarGamificado()
        // (que no genera puntosGamificados por jugador) produciría un map vacío
        // y nombresAMostrar quedaría como string vacío.
        const tienePuntosIndividuales = esGamificado
            && p.puntosGamificados
            && p.ids
            && Object.keys(p.puntosGamificados).length > 0;

        if (tienePuntosIndividuales) {
            nombresAMostrar = p.ids.map(id => {
                const j = db.jugadores.find(x => String(x.id) === String(id));
                const nombreSeguro = j ? j.nombre : "???";
                const pts = p.puntosGamificados[id] || 0;
                return `${escapeHtml(nombreSeguro)} <span style="color:#00d4ff; font-weight:900;">(${pts})</span>`;
            }).join(' <span style="color:#ccc; margin:0 5px;">|</span> ');
            if (!String(marcadorAMostrar).includes("🎮")) marcadorAMostrar = "🎮 " + marcadorAMostrar;
        } else if (esGamificado) {
            // ✅ FIX: Gamificado sin puntos individuales (viene de finalizarGamificado())
            // — mantener p.nombres tal cual y asegurar prefijo 🎮 en marcador.
            if (!String(marcadorAMostrar).includes("🎮")) marcadorAMostrar = "🎮 " + marcadorAMostrar;
        }

        let borderColor = '#001e3c';
        let badgeBg = '#f8f9fa';

        if (esGamificado) {
            borderColor = '#00d4ff';
        } else if (esVenganza) {
            borderColor = '#ff9f43';
            badgeBg = '#fff5eb';
        } else if (esTrio) {
            borderColor = '#C5A059';
        } else if (esAsimetrico) {
            borderColor = '#ff6b35';
            badgeBg = '#fff7f4';
        } else if (p.tipo === 'equipos3') {
            borderColor = '#a78bfa';
            badgeBg = '#f5f3ff';
        }

        // ✅ Australiana: construir marcador legible desde puntosAustraliana
        if (p.tipo === 'equipos3' && p.puntosAustraliana && p.ids) {
            const gN = id => db.jugadores.find(x => String(x.id) === String(id))?.nombre || '???';
            const soloData = p.juegosSoloAustraliana || {};
            const haySolo = Object.values(soloData).some(v => Number(v) > 0);
            nombresAMostrar = p.ids.map(id => {
                const pts = p.puntosAustraliana[String(id)] || 0;
                const solo = soloData[id] || 0;
                const soloStr = haySolo ? ` <span style="color:#ff6b35;font-size:0.7em;">(solo:${solo})</span>` : '';
                return `${escapeHtml(gN(id))} <span style="color:#a78bfa; font-weight:900;">(${pts})</span>${soloStr}`;
            }).join(' <span style="color:#ccc; margin:0 5px;">·</span> ');
            marcadorAMostrar = '🔄';
        }

        return `
            <div class="card-historial" style="
                background: white; margin-bottom: 12px; padding: 14px 18px; 
                border-radius: 12px; border-left: 6px solid ${borderColor};
                box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex;
                justify-content: space-between; align-items: center;">
                
                <div style="flex: 1;">
                    <div style="font-size: 0.7rem; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 4px;">
                        Pista ${p.pista || '?'} <span style="margin: 0 5px;">•</span> ${p.fin || ''}
                        ${esVenganza    ? '<span style="color:#ff9f43; margin-left:8px;">🔥 REVANCHA</span>' : ''}
                        ${esTrio        ? '<span style="color:#C5A059; margin-left:8px;">🔱 TRÍO</span>' : ''}
                        ${esAsimetrico  ? `<span style="color:#ff6b35; margin-left:8px;">⚡ ${modo.etiqueta}</span>` : ''}
                        ${p.tipo === 'equipos3' ? '<span style="color:#a78bfa; margin-left:8px;">🔄 AUSTRALIANA</span>' : ''}
                    </div>
                    <div style="font-weight: 800; font-size: ${(esTrio || esAsimetrico || p.tipo === 'equipos3') ? '0.85rem' : '1rem'}; color: #001e3c; line-height: 1.3;">
                        ${nombresAMostrar}
                    </div>
                </div>
                
                <div style="margin-left: 15px;">
                    <div style="
                        background: ${badgeBg};
                        color: #001e3c;
                        padding: 6px 12px; border-radius: 8px; font-family: 'Courier New', monospace;
                        font-weight: 900; font-size: 1.3rem; border: 1px solid ${borderColor}44;">
                        ${marcadorAMostrar}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = htmlContent + tarjetasHTML;
}

// Función auxiliar para el mensaje
// generarMensajeWhatsApp: eliminada — función huérfana cuya lógica
// está integrada en cerrarJornada() con datos más completos.




function limpiarHistorialHoy() {
    // 1. DOBLE SEGURIDAD: Evita borrados accidentales en mitad de un torneo
    const mensaje = "⚠️ ¿Seguro que quieres borrar todos los resultados de hoy?\n\nEsta acción vaciará la lista de partidos finalizados y reseteará el MVP.\nNO afectará al ranking acumulado ni al archivo histórico.";

    if (confirm(mensaje)) {
        // 2. LIMPIEZA DE PARTIDOS (Global y BBDD)
        window.partidosFinalizadosHoy = [];
        if (db) db.partidosRecientes = [];

        // ✅ FIX: Resetear MVP completo para que no queden datos huérfanos
        // en Firebase tras borrar los registros de la jornada.
        // Sin esto, el listener de Firebase restaura los arrays MVP desde la nube
        // en el siguiente evento .on('value'), sobreescribiendo cualquier limpieza local.
        window.mvpIdHoy             = null;
        window.mvpIdsHoy            = [];
        window.mvpIdsJugadores      = [];
        window.mvpIdsEntrenadores   = [];
        window.votosJugadoresMVP    = {};
        window.golpesGanadoresHoy   = {};
        if (db) {
            db.mvpIdHoy             = null;
            db.mvpIdsHoy            = [];
            db.mvpIdsJugadores      = [];
            db.mvpIdsEntrenadores   = [];
            db.votosJugadoresMVP    = {};
            db.golpesGanadoresHoy   = {};
        }

        // 3. PERSISTENCIA INMEDIATA
        saveDB();

        // 4. ACTUALIZACIÓN EN CASCADA DE INTERFACES
        if (typeof window._jugadorGolpesSeleccionado !== 'undefined') window._jugadorGolpesSeleccionado = null;
        if (typeof renderHistorialHoy === 'function')    renderHistorialHoy();
        if (typeof renderResultadosHoy === 'function')   renderResultadosHoy();
        if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
        if (typeof renderSeccionMVP === 'function')      renderSeccionMVP();
        if (typeof renderRanking === 'function')         renderRanking();
        if (typeof actualizarTablonHub === 'function')   actualizarTablonHub();
        if (typeof sincronizarTV === 'function')         sincronizarTV();

        // 5. LOG DE SEGURIDAD
        console.log("🧹 Historial y MVP de hoy limpiados por el administrador.");
        alert("✅ Historial y MVP reseteados correctamente.");
    }
}

