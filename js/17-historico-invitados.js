/* ============================================================
   ATP PLATINUM — 17-historico-invitados.js
   Editar invitados de jornadas históricas + render histórico general
   ── Refactor: extraído de script.js (líneas [(5593, 5963)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// RENDER HISTÓRICO GENERAL
// ==========================================

// ══════════════════════════════════════════════════════════
// EDITAR INVITADOS DE JORNADA HISTÓRICA
// Permite marcar/desmarcar asistentes como invitados lúdicos
// con ajuste retroactivo de puntos en la cantera.
// ══════════════════════════════════════════════════════════
function editarInvitadosHistorial(idRecibido) {
    const jornada = (db.historicoJornadas || []).find(j =>
        String(j.id || j.timestamp) === String(idRecibido)
    );
    if (!jornada) return alert("❌ Jornada no encontrada.");
    if (!jornada.asistentes || jornada.asistentes.length === 0)
        return alert("ℹ️ Esta jornada no tiene asistentes registrados.");

    const modalId = `modal-invitados-${idRecibido}`;
    let modalEl = document.getElementById(modalId);
    if (modalEl) modalEl.remove();

    const checkboxes = jornada.asistentes.map(a =>
        `<label style="display:flex;align-items:center;gap:10px;padding:8px 6px;
                       border-bottom:1px solid #f0f0f0;cursor:pointer;">
            <input type="checkbox" value="${a.id}" ${a.esInvitado ? 'checked' : ''}
                style="width:18px;height:18px;accent-color:#f59e0b;flex-shrink:0;">
            <div>
                <div style="font-size:0.88rem;font-weight:700;color:#1f2937;">${a.nombre}</div>
                <div style="font-size:0.65rem;color:#9ca3af;">
                    ${a.esInvitado ? '👨‍👧 Actualmente invitado — sin puntos de ranking' : 'Jugador activo de ranking'}
                </div>
            </div>
        </label>`
    ).join('');

    modalEl = document.createElement('div');
    modalEl.id = modalId;
    modalEl.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;
        display:flex;align-items:center;justify-content:center;padding:20px;`;
    modalEl.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;max-width:480px;width:100%;
                    max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h3 style="margin:0;color:#001e3c;font-size:1rem;">👨‍👧 Invitados — ${jornada.fecha || ''}</h3>
                <button onclick="document.getElementById('${modalId}').remove()"
                    style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#888;">✕</button>
            </div>
            <p style="font-size:0.72rem;color:#6b7280;margin:0 0 16px 0;line-height:1.5;">
                Marca los jugadores que participaron como <strong>invitados lúdicos</strong>.<br>
                Los marcados <strong>no acumulan puntos</strong> de ranking en esta jornada.<br>
                <span style="color:#ef4444;font-weight:700;">⚠️ Los cambios ajustan los puntos retroactivamente.</span>
            </p>

            <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px;margin-bottom:20px;">
                <div style="font-size:0.7rem;font-weight:900;color:#92400e;letter-spacing:2px;margin-bottom:10px;">
                    ASISTENTES (${jornada.asistentes.length})
                </div>
                <div id="checks-invitados-${idRecibido}">${checkboxes}</div>
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="document.getElementById('${modalId}').remove()"
                    style="flex:1;padding:12px;background:#f3f4f6;border:none;border-radius:8px;
                           cursor:pointer;font-weight:700;color:#374151;">
                    Cancelar
                </button>
                <button onclick="guardarInvitadosHistorial('${idRecibido}', '${modalId}')"
                    style="flex:2;padding:12px;background:#f59e0b;color:#1f2937;border:none;
                           border-radius:8px;cursor:pointer;font-weight:900;letter-spacing:1px;">
                    ✅ GUARDAR CAMBIOS
                </button>
            </div>
        </div>`;
    document.body.appendChild(modalEl);
}

function guardarInvitadosHistorial(idRecibido, modalId) {
    const jornada = (db.historicoJornadas || []).find(j =>
        String(j.id || j.timestamp) === String(idRecibido)
    );
    if (!jornada || !jornada.asistentes) return;

    const nuevosInvitados = new Set(
        [...document.querySelectorAll(`#checks-invitados-${idRecibido} input:checked`)]
        .map(el => String(el.value))
    );

    // FIX INVITADO-HISTORIAL: calcular los puntos reales de cada partido
    // en lugar del ajuste fijo +/-1 anterior que era incorrecto para ganadores,
    // empates y australiana (que valen 3, 2 o 1 segun el resultado real).
    // Tambien se ajustan los puntos de MVP de jornada si el jugador cuyo
    // status cambia era MVP de esa jornada.
    const partidos = Array.isArray(jornada.partidos) ? jornada.partidos : Object.values(jornada.partidos || []);
    const mvpJ = (jornada.mvpIdsJugadores    || []).map(String);
    const mvpE = (jornada.mvpIdsEntrenadores || []).map(String);

    let cambios = 0;
    jornada.asistentes.forEach(a => {
        const eraInvitado = !!a.esInvitado;
        const ahoraInvitado = nuevosInvitados.has(String(a.id));
        if (eraInvitado === ahoraInvitado) return; // sin cambio

        const j = (db.jugadores || []).find(x => String(x.id) === String(a.id));
        if (!j) return;

        const idStr = String(a.id);

        // Calcular puntos reales de todos los partidos donde participo
        let ptosPartidos = 0;
        partidos.forEach(p => {
            if (!(p.ids || []).map(String).includes(idStr)) return;
            ptosPartidos += _calcularPtosJugadorEnPartido(p, idStr);
        });

        // ✅ BUG 3 FIX: en jornadas admin (esAdmin:true) los MVPs de cada partido
        // individual ya se aplicaron via aplicarMvps() en njArchivarJornada().
        // _calcularPtosJugadorEnPartido() NO incluye puntos MVP de partido — son
        // puntos extra que aplicarMvps() añadió directamente a puntosTotales.
        // Para revertirlos/restituirlos correctamente al cambiar status de invitado,
        // sumamos los MVPs de partido manualmente aquí también.
        //
        // Para jornadas live (sin esAdmin), solo existe el MVP de jornada global.
        // Para jornadas admin, existen MVP de jornada + MVP de cada partido.
        // Calculamos ambos por separado para no duplicar.
        const esJornadaAdmin = !!jornada.esAdmin;

        let ptosMvp = 0;
        const esMvpJ = mvpJ.includes(idStr);
        const esMvpE = mvpE.includes(idStr);
        // MVP de jornada global
        if (esMvpJ) ptosMvp = 3;
        else if (esMvpE) ptosMvp = 2;

        // MVP de partidos individuales (solo en jornadas admin)
        if (esJornadaAdmin) {
            partidos.forEach(p => {
                if (!(p.ids || []).map(String).includes(idStr)) return;
                const pMvpJ = (p.mvpIdsJugadores    || []).map(String);
                const pMvpE = (p.mvpIdsEntrenadores || []).map(String);
                if (pMvpJ.includes(idStr)) ptosMvp += 3;
                else if (pMvpE.includes(idStr)) ptosMvp += 2;
            });
        }

        const ptosTotal = ptosPartidos + ptosMvp;

        if (!eraInvitado && ahoraInvitado) {
            // Ranking -> Invitado: descontar todos los puntos reales que gano
            j.puntosTotales = Math.max(0, (j.puntosTotales || 0) - ptosTotal);
            j.esInvitado = true;
        } else {
            // Invitado -> Ranking: restituir los puntos reales que habria ganado
            j.puntosTotales = (j.puntosTotales || 0) + ptosTotal;
            j.esInvitado = false;
        }

        a.esInvitado = ahoraInvitado; // actualizar en el registro historico
        cambios++;
    });

    saveDB();
    document.getElementById(modalId)?.remove();
    if (typeof renderHistoricoGeneral === 'function') renderHistoricoGeneral();
    if (typeof renderCantera === 'function') renderCantera();
    if (typeof renderRanking === 'function') renderRanking();

    if (cambios > 0) {
        alert(`Cambios guardados (${cambios}). Puntos recalculados exactamente a partir de los resultados reales de la jornada.`);
    } else {
        alert("Sin cambios.");
    }
}

function renderHistoricoGeneral() {
    const contenedor = document.getElementById('lista-archivo-historico');
    if (!contenedor) return;

    if (!db.historicoJornadas || db.historicoJornadas.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align:center; padding: 60px 20px; opacity:0.5;">
                <div style="font-size: 4rem; margin-bottom:10px;">📂</div>
                <p style="font-size:1rem; font-weight:bold;">No hay jornadas archivadas todavía.</p>
                <small>Los datos se guardan aquí automáticamente al cerrar la jornada.</small>
            </div>`;
        return;
    }

    // ✅ FIX HISTORIAL: ordenar por fecha real descendente.
    // Antes usaba a.id (timestamp de creación) — correcto para jornadas live,
    // pero las jornadas admin tienen fecha pasada (ej: "2026-04-17") y un id
    // generado en el momento de archivar, por lo que aparecían desordenadas.
    // Ahora parseamos jornada.fecha como fecha real para el sort.
    function parseFechaJornada(j) {
        if (j.fecha) {
            // Soportar: "2026-04-17" (ISO), "17/4/2026", "24/4/2026" (toLocaleDateString)
            const iso = j.fecha.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2])-1, parseInt(iso[3])).getTime();
            const loc = j.fecha.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (loc) return new Date(parseInt(loc[3]), parseInt(loc[2])-1, parseInt(loc[1])).getTime();
        }
        return j.id || j.timestamp || 0;
    }

    const historicoOrdenado = [...db.historicoJornadas].sort((a, b) =>
        parseFechaJornada(b) - parseFechaJornada(a)
    );

    contenedor.innerHTML = historicoOrdenado.map(jornada => {
        const idFila = jornada.id || jornada.timestamp;
        const totalJugadores = jornada.asistentes
            ? jornada.asistentes.length
            : Number(jornada.jugadores || 0);
        // ✅ FIX BUG HISTORIAL: Firebase convierte arrays a objetos {0:..,1:..} al deserializar.
        // normalizarPartidos() convierte cualquier objeto o array a Array limpio.
        const _normPartidos = p => Array.isArray(p) ? p : (p && typeof p === 'object' ? Object.values(p) : []);
        const totalPartidos = _normPartidos(jornada.partidos).length;
        // ✅ FIX FORMATO FECHA: normalizar a DD/MM/YYYY sea cual sea el formato guardado.
        // Las jornadas admin guardan "2026-04-17" (ISO), las live "24/4/2026" (toLocaleDateString).
        function formatearFechaHistorial(f) {
            if (!f) return '—';
            const iso = f.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (iso) return `${parseInt(iso[3])}/${parseInt(iso[2])}/${iso[1]}`;
            return f; // ya en DD/MM/YYYY o similar
        }
        const fechaDisplay = formatearFechaHistorial(jornada.fecha) ||
            new Date(idFila).toLocaleDateString('es-ES');

        let htmlPartidosDetalle = "";
        const _partidosArr = _normPartidos(jornada.partidos);
        if (_partidosArr.length > 0) {
            htmlPartidosDetalle = _partidosArr.map(p => {
                const modo = resolverModoPartido(p);
                const esGamificado = modo.esGamificado;
                const esTrio       = modo.esTrio;
                const esAsimetrico = modo.esAsimetrico;
                const esVenganza = p.esVenganza || (p.nombres && p.nombres.includes("🔥"));

                let nMostrar = p.nombres || "Partido";
                let mMostrar = p.marcador || p.resultado || "Fin";

                // Formateo para Gamificados
                if (esGamificado && p.puntosGamificados && p.ids) {
                    nMostrar = p.ids.map(id => {
                        const jug = db.jugadores.find(x => String(x.id) === String(id));
                        const pts = p.puntosGamificados[id] || 0;
                        return `${jug ? escapeHtml(jug.nombre) : '??'} (${pts})`;
                    }).join(' | ');
                    if (!String(mMostrar).includes("🎮")) mMostrar = "🎮 " + mMostrar;
                }

                // ✅ Australiana: mostrar acumulados individuales + solo
                if (p.tipo === 'equipos3' && p.puntosAustraliana && p.ids) {
                    const soloDataH = p.juegosSoloAustraliana || {};
                    const haySoloH = Object.values(soloDataH).some(v => Number(v) > 0);
                    nMostrar = p.ids.map(id => {
                        const jug = db.jugadores.find(x => String(x.id) === String(id));
                        const pts = p.puntosAustraliana[String(id)] || 0;
                        const solo = soloDataH[id] || 0;
                        const soloTag = haySoloH ? ` (solo:${solo})` : '';
                        return `${jug ? escapeHtml(jug.nombre) : '??'} (${pts}${soloTag})`;
                    }).join(' · ');
                    mMostrar = '🔄';
                }

                const colorBorde = esGamificado ? '#00d4ff'
                    : (p.tipo === 'equipos3' ? '#a78bfa'
                    : (esVenganza  ? '#ff9f43'
                    : (esAsimetrico ? '#ff6b35'
                    : (esTrio      ? '#C5A059'
                    : '#001e3c'))));

                // Añadir icono de modo si no está ya en el nombre
                if (p.tipo === 'equipos3' && !nMostrar.includes('🔄')) {
                    nMostrar = `🔄 ${nMostrar}`;
                } else if (esTrio && !esGamificado && !nMostrar.includes('🔱')) {
                    nMostrar = `🔱 ${nMostrar}`;
                } else if (esAsimetrico && !nMostrar.includes('⚡')) {
                    nMostrar = `⚡ ${nMostrar}`;
                }

                return `
                    <div style="font-size: 0.8rem; padding: 10px; background: white; border-radius: 6px; border-left: 4px solid ${colorBorde}; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="flex:1;">${esVenganza ? '🔥 ' : ''}${esGamificado ? '🎮 ' : ''}${nMostrar}</span>
                        <span style="font-family:monospace; font-size:1rem; font-weight:900; color:#001e3c; margin-left:10px;">
                            ${mMostrar}
                        </span>
                    </div>`;
            }).join('');
        }

        return `
        <div class="card-historial-item" style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #eee; margin-bottom: 12px;">
            
            <div onclick="toggleDetalleHistorial(${idFila})" 
                 style="padding: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: #fdfdfd;">
                <div>
                    <div style="font-weight: 800; color: #001e3c; font-size: 1.05rem;">📅 ${fechaDisplay}</div>
                    <div style="font-size: 0.75rem; font-weight: bold; text-transform:uppercase;">
                        ${(() => {
                            const _gn2 = id => { const jj = db.jugadores.find(x => String(x.id) === String(id)); return jj ? escapeHtml(jj.nombre) : escapeHtml(String(id)); };
                            const mJ = Array.isArray(jornada.mvpIdsJugadores)    && jornada.mvpIdsJugadores.length    ? `<span style="color:#10ac84;">🗳️ ${jornada.mvpIdsJugadores.map(_gn2).join(', ')}</span>` : '';
                            const mE = Array.isArray(jornada.mvpIdsEntrenadores) && jornada.mvpIdsEntrenadores.length ? `<span style="color:#C5A059;">👨‍🏫 ${jornada.mvpIdsEntrenadores.map(_gn2).join(', ')}</span>` : '';
                            if (mJ || mE) return [mJ, mE].filter(Boolean).join(' · ');
                            const leg = Array.isArray(jornada.mvpIds) && jornada.mvpIds.length
                                ? jornada.mvpIds.map(_gn2).join(', ')
                                : (jornada.mvp || null);
                            if (leg && leg !== '---') return `<span style="color:#ff9f43;">🏆 MVP: ${leg}</span>`;
                            // Sin MVP — aviso visual destacado
                            return `<span style="color:#ef4444; font-size:0.65rem;">⚠️ Sin MVP asignado</span>`;
                        })()}
                    </div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: #666; font-weight:bold;">
                    <div>🎾 ${totalPartidos} Partidos</div>
                    <div>👥 ${totalJugadores} Jugadores</div>
                </div>
            </div>

            <div id="detalle-${idFila}" style="display: none; padding: 16px; border-top: 1px solid #eee; background: #fafafa;">
                <h4 style="font-size: 0.65rem; color: #888; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; letter-spacing:1px;">
                    📝 CRÓNICA DE RESULTADOS
                </h4>
                
                <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 15px;">
                    ${htmlPartidosDetalle}
                </div>

                ${(() => {
                    if (!jornada.asistentes || jornada.asistentes.length === 0) return '';
                    const items = jornada.asistentes.map(a => {
                        const esInv = !!a.esInvitado;
                        return `<span style="display:inline-flex;align-items:center;gap:4px;
                            background:${esInv ? '#fef3c7' : '#f3f4f6'};
                            border:1px solid ${esInv ? '#fcd34d' : '#e5e7eb'};
                            color:${esInv ? '#92400e' : '#374151'};
                            border-radius:20px;padding:3px 10px;font-size:0.7rem;font-weight:700;">
                            ${a.nombre}${esInv ? ' 👨‍👧' : ''}
                        </span>`;
                    }).join('');
                    return `
                    <div style="margin-top:12px;padding:10px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                        <div style="font-size:0.6rem;font-weight:900;color:#6b7280;letter-spacing:1.5px;margin-bottom:8px;text-transform:uppercase;">
                            👥 Asistentes (${jornada.asistentes.length})
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:5px;">${items}</div>
                    </div>`;
                })()}

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; padding-top:10px; border-top:1px dashed #ccc;">
                    <button onclick="borrarJornadaHistorial(${idFila})"
                            style="background:none; border:none; color:#d9534f; font-size:0.7rem; cursor:pointer; font-weight:bold;">
                        🗑️ Eliminar Registro
                    </button>
                    <div style="display:flex;gap:6px;">
                        <button onclick="editarInvitadosHistorial(${idFila})"
                                style="background:none; border:1px solid #f59e0b; color:#f59e0b; font-size:0.7rem; cursor:pointer; font-weight:bold; border-radius:6px; padding:4px 10px;">
                            👨‍👧 Invitados
                        </button>
                        <button onclick="editarMVPHistorial(${idFila})"
                                style="background:none; border:1px solid #C5A059; color:#C5A059; font-size:0.7rem; cursor:pointer; font-weight:bold; border-radius:6px; padding:4px 10px;">
                            👑 MVP
                        </button>
                    </div>
                    <span style="font-size:0.6rem; color:#999;">ID: ${idFila}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}


