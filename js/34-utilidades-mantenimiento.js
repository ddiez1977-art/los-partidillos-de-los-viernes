/* ============================================================
   ATP PLATINUM — 34-utilidades-mantenimiento.js
   Verificar venganza, limpieza/seguridad jornada, debug, tablón HUB
   ── Refactor: extraído de script.js (líneas [(11056, 11308)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function verificarVenganza(partidoFinalizado) {
    if (!partidoFinalizado.esVenganza) return;

    // ✅ FIX: Si hay empate, nadie se venga — salir sin hacer nada
    if (partidoFinalizado.juegosA === partidoFinalizado.juegosB) return;

    const ganeA = partidoFinalizado.juegosA > partidoFinalizado.juegosB;
    const _mitadV = partidoFinalizado.tamanoEquipoA != null
        ? Number(partidoFinalizado.tamanoEquipoA)
        : Math.floor(partidoFinalizado.ids.length / 2);
    const idsGanadores = ganeA
        ? partidoFinalizado.ids.slice(0, _mitadV)
        : partidoFinalizado.ids.slice(_mitadV);

    let mensajesVenganza = [];
    
    idsGanadores.forEach(idG => {
        // Buscamos al jugador en la lista de HOY para resetear su hambre de venganza
        const jHoy = window.jugadoresHoy.find(j => j.id.toString() === idG.toString());
        
        if (jHoy && jHoy.perdioUltimo) {
            mensajesVenganza.push(`🔥 ¡VENGANZA! ${jHoy.nombre} ha recuperado el honor.`);
            // IMPORTANTE: Ya se vengó, reseteamos el flag para el próximo cálculo Elite
            jHoy.perdioUltimo = false; 
        }
    });

    if (mensajesVenganza.length > 0) {
        if (!window.logVenganzasTV) window.logVenganzasTV = [];
        window.logVenganzasTV.push(...mensajesVenganza);
        if (typeof actualizarMarquesinaTV === 'function') {
            actualizarMarquesinaTV(mensajesVenganza[0]);
        }
    }
}

function limpiezaSeguridadJornada(silencioso = false) {
    console.log("🔍 Iniciando chequeo de seguridad de la pista...");
    let corregidos = 0;

    if (!window.jugadoresHoy || window.jugadoresHoy.length === 0) return;

    // 1. ELIMINAR DUPLICADOS DE IDs
    const vistos = new Set();
    const listaLimpia = [];
    window.jugadoresHoy.forEach(j => {
        const idStr = String(j.id);
        if (!vistos.has(idStr)) {
            vistos.add(idStr);
            listaLimpia.push(j);
        } else {
            corregidos++;
            console.warn(`⚠️ ID Duplicado eliminado: ${j.nombre} (${idStr})`);
        }
    });
    window.jugadoresHoy = listaLimpia;

    // 2. VERIFICAR COHERENCIA DE ESTADOS (Agnóstico a modo Trío/Dobles)
    const idsEnPista = (window.partidosAbiertos || []).flatMap(p => p.ids.map(id => String(id)));

    window.jugadoresHoy.forEach(j => {
        const idStr = String(j.id);
        const estaEnPistaReal = idsEnPista.includes(idStr);

        if (j.estado === 'jugando' && !estaEnPistaReal) {
            j.estado = 'disponible';
            corregidos++;
            console.log(`🔧 Corrección: ${j.nombre} estaba 'jugando' sin partido. Reset.`);
        }

        if (estaEnPistaReal && j.estado !== 'jugando') {
            j.estado = 'jugando';
            corregidos++;
            console.log(`🔧 Corrección: ${j.nombre} en pista -> estado 'jugando'.`);
        }

        // --- 🔱 LIMPIEZA DE NAN (Incluyendo nuevos campos de Trío) ---
        if (isNaN(j.puntosTotales)) j.puntosTotales = 0;
        if (isNaN(j.descansosSeguidos)) j.descansosSeguidos = 0;
        if (!j.stats) j.stats = {};
        if (isNaN(j.stats.trios))       j.stats.trios       = 0;
        if (isNaN(j.stats.asimetrico))  j.stats.asimetrico  = 0;
        if (isNaN(j.stats.australiana)) j.stats.australiana = 0;
    });

    // 3. PERSISTENCIA
    if (corregidos > 0) {
        if (!silencioso) {
            saveDB();
            if (typeof renderPresentes === 'function') renderPresentes();
            if (typeof renderPistas === 'function') renderPistas();
            if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
            if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
            if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
        }
        console.log(`✅ Integridad: Se aplicaron ${corregidos} correcciones.`);
    } else {
        console.log("💎 Sistema íntegro.");
    }
}   // ← cierre de limpiezaSeguridadJornada

function menuDebugSistema() {
    const totalPistas = document.getElementById('plan-pistas-totales')?.value || '2';
    
    const info = `📊 ESTADO DEL SISTEMA:
------------------------------
👥 Jugadores en Cantera: ${db.jugadores.length}
🎾 Jugadores Presentes: ${window.jugadoresHoy.length}
📍 Partidos en Pista: ${window.partidosAbiertos.length}
🏟️ Pistas Totales: ${totalPistas}
------------------------------
¿Deseas ejecutar la LIMPIEZA DE SEGURIDAD profunda? 
(Corrige estados 'jugando' huérfanos y limpia duplicados)`;
    
    if (confirm(info)) {
        limpiezaSeguridadJornada();
        
        // Bonus: Preguntar si quiere backup tras limpiar
        setTimeout(() => {
            if (confirm("✨ Sistema saneado. ¿Quieres descargar una copia de seguridad (JSON) de la cantera ahora?")) {
                exportarHistorialJSON(); // Asegúrate de tener esta función o la creamos ahora
            }
        }, 500);
    }
}

// ✅ FIX: actualizarTablonHub() usaba 'tablon-contenido', el mismo ID que
// actualizarTablonAnuncios(). Cada llamada desde lanzarPartidoManual(),
// cargarSugerenciaEnPista() o cerrarJornada() sobreescribía las curiosidades
// con el widget estático de pistas/MVP, rompiendo el ciclo de noticias del HUB.
// El fix requiere dos pasos:
// 1. Aquí usamos el nuevo ID 'tablon-hub-status'.
// 2. En el HTML, renombrar el div correspondiente de 'tablon-contenido'
//    a 'tablon-hub-status' (solo el widget de estado, no el de curiosidades).


function actualizarTablonHub() {
    const tablon = document.getElementById('tablon-hub-status');
    if (!tablon) return;

    const pistasLibres = (parseInt(document.getElementById('plan-pistas-totales')?.value) || 2) - (window.partidosAbiertos || []).length;

    const mvpJ = Array.isArray(window.mvpIdsJugadores) ? window.mvpIdsJugadores : [];
    const mvpE = Array.isArray(window.mvpIdsEntrenadores) ? window.mvpIdsEntrenadores : [];
    const gN = id => db.jugadores.find(j => String(j.id) === String(id))?.nombre || '?';

    const hayMvpHoy = mvpJ.length > 0 || mvpE.length > 0;
    let mvpHtml = '';
    if (mvpJ.length > 0) {
        mvpHtml += `<div style="font-size:0.75rem;color:#10ac84;font-weight:700;margin-top:6px;">🗳️ Jugadores: ${mvpJ.map(gN).join(', ')} <span style="opacity:0.7">(+3pts)</span></div>`;
    }
    if (mvpE.length > 0) {
        mvpHtml += `<div style="font-size:0.75rem;color:#C5A059;font-weight:700;margin-top:4px;">👨‍🏫 Entrenadores: ${mvpE.map(gN).join(', ')} <span style="opacity:0.7">(+2pts)</span></div>`;
    }
    if (!hayMvpHoy) {
        // ✅ FIX: leer la última jornada del histórico para mostrar ambos MVPs reales,
        // en lugar de db.ultimoMVP que solo guardaba el último clic de entrenadores.
        const ultimaJornada = Array.isArray(db.historicoJornadas) && db.historicoJornadas.length
            ? db.historicoJornadas[db.historicoJornadas.length - 1]
            : null;

        if (ultimaJornada) {
            const ujJ = Array.isArray(ultimaJornada.mvpIdsJugadores) ? ultimaJornada.mvpIdsJugadores : [];
            const ujE = Array.isArray(ultimaJornada.mvpIdsEntrenadores) ? ultimaJornada.mvpIdsEntrenadores : [];
            const hayDual = ujJ.length > 0 || ujE.length > 0;

            if (hayDual) {
                if (ujJ.length > 0)
                    mvpHtml += `<div style="font-size:0.75rem;color:#10ac84;font-weight:700;margin-top:6px;">🗳️ Jugadores: ${ujJ.map(gN).join(', ')}</div>`;
                if (ujE.length > 0)
                    mvpHtml += `<div style="font-size:0.75rem;color:#C5A059;font-weight:700;margin-top:4px;">👨‍🏫 Entrenadores: ${ujE.map(gN).join(', ')}</div>`;
            } else if (ultimaJornada.mvp) {
                // Fallback para jornadas antiguas sin sistema dual
                mvpHtml = `<div style="font-size:0.75rem;color:#aaa;margin-top:6px;">👑 ${ultimaJornada.mvp}</div>`;
            }
            mvpHtml += `<div style="font-size:0.65rem;color:#555;margin-top:4px;font-style:italic;">Última jornada: ${ultimaJornada.fecha || ''}</div>`;
        } else if (db.ultimoMVP) {
            // Fallback final: campo legacy
            mvpHtml = `<div style="font-size:0.75rem;color:#aaa;margin-top:6px;">${db.ultimoMVP}</div>`;
        } else {
            mvpHtml = `<div style="font-size:0.75rem;color:#555;margin-top:6px;font-style:italic;">Sin seleccionar aún</div>`;
        }
    }

    tablon.innerHTML = `
        <div style="background:rgba(255,255,255,0.05);padding:15px;border-radius:10px;border-left:4px solid #ccff00;">
            <p style="margin:0;font-size:0.8rem;color:#888;">ESTADO DE PISTAS</p>
            <h3 style="margin:5px 0;color:white;">${pistasLibres > 0 ? `🟢 ${pistasLibres} Pistas Disponibles` : '🔴 Club Completo'}</h3>
        </div>
        <div style="background:rgba(255,255,255,0.05);padding:15px;border-radius:10px;border-left:4px solid var(--atp-gold);margin-top:10px;cursor:pointer;" onclick="accederSistema('sec-mvp')">
            <p style="margin:0;font-size:0.8rem;color:#888;">👑 MVP DE JORNADA</p>
            <h3 style="margin:5px 0;color:var(--atp-gold);">${hayMvpHoy ? '✅ SELECCIONADO' : '⏳ PENDIENTE'}</h3>
            ${mvpHtml}
            <div style="font-size:0.65rem;color:#555;margin-top:8px;text-transform:uppercase;letter-spacing:1px;">Pulsa para gestionar →</div>
        </div>
    `;
}

function actualizarContadorConvocatoriaHub() {
    const elCount = document.getElementById('count-confirmados-hub');
    const elStatus = document.getElementById('status-portal-hub');
    const elAviso = document.getElementById('aviso-quorum-hub');
    
    if (!elCount || !elStatus || !elAviso) return;

    // 2. Conteo de confirmados — separar ranking e invitados
    const confirmadosIds = db.convocatoriaActiva || [];
    const confirmados = confirmadosIds.length;
    const confirmadosRanking   = confirmadosIds.filter(id => {
        const j = (db.jugadores || []).find(x => String(x.id) === String(id));
        return j && !j.esInvitado;
    }).length;
    const confirmadosInvitados = confirmados - confirmadosRanking;

    const textoInv = confirmadosInvitados > 0
        ? ` <span style="font-size:0.8em;color:#f59e0b;">(+${confirmadosInvitados} inv.)</span>`
        : '';
    elCount.innerHTML = `${confirmadosRanking} Jugadores${textoInv}`;

    // 3. Estado del Portal
    const portalAbierto = db.convocatoriaAbierta === true;
    elStatus.innerText = portalAbierto ? "🌐 PORTAL ABIERTO" : "🔒 PORTAL CERRADO";
    elStatus.style.background = portalAbierto ? "rgba(40, 167, 69, 0.2)" : "rgba(220, 53, 69, 0.2)";
    elStatus.style.color = portalAbierto ? "#28a745" : "#dc3545";
    elStatus.style.borderColor = portalAbierto ? "#28a745" : "#dc3545";

    // 4. Análisis de Quórum (solo jugadores de ranking, no invitados)
    let aviso = "";
    elAviso.style.color = "#ccff00";
    const nQ = confirmadosRanking;

    if (confirmados === 0) {
        aviso = "Esperando confirmaciones...";
    } else if (nQ % 6 === 0 && nQ > 0) {
        aviso = `🔱 Ideal para ${nQ / 6} ${nQ / 6 === 1 ? 'pista' : 'pistas'} de tríos (3vs3).`;
    } else if (nQ % 4 === 0 && nQ > 0) {
        aviso = `✅ Ideal para ${nQ / 4} ${nQ / 4 === 1 ? 'pista' : 'pistas'} de dobles.`;
    } else if (nQ % 2 === 0 && nQ > 0) {
        aviso = `🤺 Ideal para ${nQ / 2} ${nQ / 2 === 1 ? 'pista' : 'pistas'} de individual.`;
    } else {
        const faltanParaDobles = 4 - (nQ % 4);
        const faltanParaTrios  = 6 - (nQ % 6);
        const sugerencia = faltanParaDobles <= faltanParaTrios
            ? `Faltan ${faltanParaDobles} para cuadrar dobles`
            : `Faltan ${faltanParaTrios} para cuadrar tríos`;
        aviso = `⚠️ ${nQ} de ranking — ${sugerencia}.`;
        elAviso.style.color = "#ffcc00";
    }

    elAviso.innerText = aviso;
}


