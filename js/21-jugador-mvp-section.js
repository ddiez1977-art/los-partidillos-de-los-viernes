/* ============================================================
   ATP PLATINUM — 21-jugador-mvp-section.js
   Eliminar jugador, sección MVP, render votos, badges de pistas
   ── Refactor: extraído de script.js (líneas [(6928, 7261)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// ELIMINAR JUGADOR (mejorada y segura)
// ==========================================
function eliminarJugador(id) {
    // 1. Doble confirmación para evitar accidentes catastróficos
    if (!confirm("⚠️ ATENCIÓN: ¿Estás seguro de borrar este jugador?\n\nSe eliminarán sus puntos, estadísticas y nivel. Esta acción es permanente.")) {
        return;
    }

    // 2. Normalizar el ID a String para asegurar que el .filter funcione siempre
    const idStr = String(id);

    // 3. Verificación de seguridad: ¿Está el jugador en un partido activo?
    const enPartidoActivo = (window.partidosAbiertos || []).some(p =>
        (p.ids || []).map(String).includes(idStr)
    );

    if (enPartidoActivo) {
        alert("❌ No puedes eliminar a un jugador que está en un partido en curso.\nFinaliza el partido antes de borrarlo.");
        return;
    }

    // 4. LIMPIEZA TOTAL EN CADENA
    
    // A. Eliminar de la base de datos principal (Cantera)
    db.jugadores = db.jugadores.filter(j => String(j.id) !== idStr);

    // B. Eliminar de la lista de asistencia de hoy
    if (window.jugadoresHoy) {
        window.jugadoresHoy = window.jugadoresHoy.filter(j => String(j.id) !== idStr);
    }

    // C. Limpiar posibles menciones en MVPs o racha de hoy
    if (String(window.mvpIdHoy) === idStr) window.mvpIdHoy = null;
    if (Array.isArray(window.mvpIdsHoy)) {
        window.mvpIdsHoy = window.mvpIdsHoy.filter(x => x !== idStr);
        if (!window.mvpIdsHoy.length) window.mvpIdHoy = null;
    }
    // ✅ Limpiar campos MVP dual
    if (Array.isArray(window.mvpIdsJugadores))
        window.mvpIdsJugadores = window.mvpIdsJugadores.filter(x => x !== idStr);
    if (Array.isArray(window.mvpIdsEntrenadores))
        window.mvpIdsEntrenadores = window.mvpIdsEntrenadores.filter(x => x !== idStr);
    if (window.votosJugadoresMVP && window.votosJugadoresMVP[idStr])
        delete window.votosJugadoresMVP[idStr];
    // ✅ FIX NUEVO: Limpiar golpes huérfanos
    if (window.golpesGanadoresHoy && window.golpesGanadoresHoy[idStr]) {
        delete window.golpesGanadoresHoy[idStr];
    }

    // 5. PERSISTENCIA Y SINCRONIZACIÓN
    saveDB();
    if (typeof sincronizarTV === 'function') sincronizarTV();

    // 6. ACTUALIZACIÓN DE TODA LA INTERFAZ
    renderCantera();
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof renderRanking === 'function') renderRanking();
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
    
    // Vital para que los selectores de los paneles de "Nuevo Partido" se limpien
    if (typeof actualizarInterfazManual === 'function') actualizarInterfazManual(); 

    console.log(`🗑️ Jugador con ID ${idStr} eliminado y referencias limpiadas.`);
}

// 8. SECCIÓN MVP (nueva pestaña independiente)
function renderSeccionMVP() {
    const contenedor = document.getElementById('mvp-section-container');
    if (!contenedor) return;

    const jugadoresHoy = window.jugadoresHoy || [];
    if (jugadoresHoy.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align:center; padding:80px 20px; color:#888; background:#0f1e2e; border-radius:16px;">
                <h2 style="color:#C5A059; margin-bottom:10px;">👑 MVP de la Jornada</h2>
                <p>No hay jugadores presentes hoy.</p>
            </div>`;
        return;
    }

    const mvpJugadores    = Array.isArray(window.mvpIdsJugadores)    ? window.mvpIdsJugadores    : [];
    const mvpEntrenadores = Array.isArray(window.mvpIdsEntrenadores) ? window.mvpIdsEntrenadores : [];
    const votos           = window.votosJugadoresMVP || {};

    // ── Calcular marcador de votos actual ─────────────────────────
    const maxVotos = Math.max(0, ...Object.values(votos).map(Number));
    const candidatos = Object.entries(votos)
        .filter(([, v]) => Number(v) > 0)
        .sort(([, a], [, b]) => Number(b) - Number(a));
    const lideres = candidatos.filter(([, v]) => Number(v) === maxVotos && maxVotos > 0);

    // Opciones del desplegable: todos los jugadores hoy menos los invitados
    const elegibles = jugadoresHoy.filter(j => !j.esInvitado);

    let html = `
        <div style="background:#0f1e2e; border-radius:16px; padding:25px;">
            <h2 style="color:#C5A059; text-align:center; margin:0 0 25px 0; font-size:1.5rem; letter-spacing:1px;">
                👑 SELECCIÓN MVP DE LA JORNADA
            </h2>

            <!-- ══ VOTACIÓN EN PISTA ══ -->
            <div style="background:rgba(16,172,132,0.07); border:1px solid rgba(16,172,132,0.3);
                        border-radius:14px; padding:18px; margin-bottom:28px;">

                <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                    <span style="font-size:1.5rem;">🗳️</span>
                    <div>
                        <h3 style="margin:0; color:#10ac84; font-size:1.1rem;">VOTACIÓN EN PISTA</h3>
                        <small style="color:#6ee7b7;">Cada jugador dice su MVP — el admin anota aquí en tiempo real</small>
                    </div>
                </div>

                ${elegibles.length < 2 ? `<p style="color:#888;font-size:0.85rem;margin:10px 0 0;">Hacen falta al menos 2 jugadores no invitados para votar.</p>` : `

                <!-- Filas de votante → candidato -->
                <div style="margin-top:14px; display:flex; flex-direction:column; gap:8px;">
                    ${elegibles.map(votante => {
                        const votoActual = (() => {
                            // El votoActual de un votante = el ID al que apuntó (guardado en votosJugadoresMVP
                            // como "votosDe_<votanteId>") — lo buscamos en db si existe, o inferimos del total
                            return (db.votosDe && db.votosDe[String(votante.id)]) || '';
                        })();
                        const candidatosSinMismo = elegibles.filter(c => c.id !== votante.id);
                        return `
                        <div style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.2);
                                    border-radius:10px; padding:10px 12px;">
                            <div style="flex:1; font-weight:700; color:#f0f4f8; font-size:0.88rem;
                                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${escapeHtml(votante.nombre)}
                            </div>
                            <span style="color:#555; font-size:0.75rem; flex-shrink:0;">vota a →</span>
                            <select onchange="registrarVotoPista('${String(votante.id)}', this.value)"
                                style="flex:1.2; background:rgba(0,0,0,0.4); border:1px solid rgba(16,172,132,0.4);
                                       border-radius:8px; padding:8px 10px; color:#f0f4f8; font-size:0.85rem;
                                       cursor:pointer; -webkit-appearance:none; min-width:0;">
                                <option value="">— sin votar —</option>
                                ${candidatosSinMismo.map(c => {
                                    const seleccionado = votoActual === String(c.id) ? 'selected' : '';
                                    return `<option value="${String(c.id)}" ${seleccionado}>${escapeHtml(c.nombre)}</option>`;
                                }).join('')}
                            </select>
                        </div>`;
                    }).join('')}
                </div>

                <!-- Marcador de votos -->
                ${candidatos.length > 0 ? `
                <div style="margin-top:16px; padding:14px; background:rgba(0,0,0,0.3);
                            border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
                    <div style="font-size:0.62rem; font-weight:900; color:#6ee7b7;
                                letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">
                        📊 Marcador de votos
                    </div>
                    ${candidatos.map(([id, v]) => {
                        const jug = jugadoresHoy.find(x => String(x.id) === id);
                        if (!jug) return '';
                        const esLider = Number(v) === maxVotos;
                        const pct = maxVotos > 0 ? Math.round((Number(v)/maxVotos)*100) : 0;
                        return `
                        <div style="margin-bottom:8px;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px;">
                                <span style="font-size:${esLider ? '1rem' : '0.8rem'};">${esLider ? '🥇' : '·'}</span>
                                <span style="flex:1; font-weight:${esLider ? '900' : '600'};
                                             color:${esLider ? '#ccff00' : '#94a3b8'};
                                             font-size:${esLider ? '0.9rem' : '0.82rem'};">
                                    ${escapeHtml(jug.nombre)}
                                </span>
                                <span style="font-weight:900; font-size:${esLider ? '1rem' : '0.85rem'};
                                             color:${esLider ? '#ccff00' : '#94a3b8'};">
                                    ${v} voto${Number(v) !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div style="height:4px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
                                <div style="height:100%; width:${pct}%;
                                            background:${esLider ? 'linear-gradient(90deg,#ccff00,#10ac84)' : '#334155'};
                                            border-radius:4px; transition:width 0.3s;"></div>
                            </div>
                        </div>`;
                    }).join('')}

                    ${lideres.length > 0 ? `
                    <div style="margin-top:12px; padding:10px 12px; background:rgba(204,255,0,0.08);
                                border:1px solid rgba(204,255,0,0.3); border-radius:8px; text-align:center;">
                        <span style="font-size:0.72rem; font-weight:900; color:#ccff00; letter-spacing:1px;">
                            🏆 ${lideres.length > 1 ? 'EMPATE — ' : ''}MVP:
                            ${lideres.map(([id]) => {
                                const jug = jugadoresHoy.find(x => String(x.id) === id);
                                return jug ? escapeHtml(jug.nombre) : id;
                            }).join(' & ')}
                        </span><br>
                        <span style="font-size:0.65rem; color:#94a3b8;">
                            ${lideres.length > 1 ? 'Ambos reciben +3 pts' : '+3 pts'} al confirmar
                        </span>
                    </div>` : ''}
                </div>` : `
                <div style="margin-top:14px; text-align:center; color:#4a5568;
                            font-size:0.82rem; padding:12px; font-style:italic;">
                    Ningún voto registrado aún. Usa los desplegables de arriba.
                </div>`}

                <!-- Botón confirmar votos -->
                ${candidatos.length > 0 ? `
                <button onclick="confirmarMVPJugadores()"
                    style="width:100%; margin-top:14px; padding:14px; font-size:0.95rem;
                           font-weight:900; border:none; border-radius:12px; cursor:pointer;
                           background:linear-gradient(135deg,#10ac84,#00d4ff); color:#001e3c;
                           letter-spacing:0.5px; box-shadow:0 4px 15px rgba(16,172,132,0.35);
                           touch-action:manipulation;">
                    ✅ CONFIRMAR MVP JUGADORES
                    ${lideres.length > 1 ? `(${lideres.length} ganadores)` : ''}
                </button>` : ''}
                `}
            </div>

            <!-- ══ MVP JUGADORES — tarjetas toggle (método directo) ══ -->
            <div style="margin-bottom:30px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:15px;
                            padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span style="font-size:2rem;">🗳️</span>
                    <div>
                        <h3 style="margin:0; color:#10ac84; font-size:1.2rem;">MVP Jugadores</h3>
                        <small style="color:#66cc88;">+3 puntos • Selección directa (alternativa a la votación)</small>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:12px;">`;

    jugadoresHoy.forEach(j => {
        const idStr = String(j.id);
        const seleccionado = mvpJugadores.includes(idStr);
        const votosRecibidos = Number(votos[idStr] || 0);

        html += `
            <div onclick="toggleMVP('${idStr}', 'jugador')"
                 style="background:${seleccionado ? 'rgba(16,172,132,0.18)' : 'rgba(255,255,255,0.06)'};
                        border:2px solid ${seleccionado ? '#10ac84' : 'rgba(255,255,255,0.12)'};
                        border-radius:14px; padding:16px; text-align:center; cursor:pointer;
                        transition:all 0.25s ease; position:relative; min-height:110px;">
                ${seleccionado ? `
                <div style="position:absolute; top:8px; right:8px; background:#10ac84; color:white;
                            font-size:0.7rem; padding:3px 8px; border-radius:20px; font-weight:900;">
                    ✓ MVP
                </div>` : ''}
                ${votosRecibidos > 0 ? `
                <div style="position:absolute; top:8px; left:8px; background:rgba(204,255,0,0.2);
                            color:#ccff00; font-size:0.65rem; padding:2px 7px;
                            border-radius:20px; font-weight:900; border:1px solid rgba(204,255,0,0.4);">
                    ${votosRecibidos}🗳️
                </div>` : ''}
                <div style="font-weight:700; font-size:1rem; color:white; margin:12px 0 4px;">
                    ${escapeHtml(j.nombre)}
                </div>
                <div style="font-size:0.8rem; color:#10ac84; font-weight:600;">+3 pts</div>
            </div>`;
    });

    html += `</div></div>`;

    // MVP ENTRENADORES
    html += `
            <div>
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:15px;
                            padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span style="font-size:2rem;">👨‍🏫</span>
                    <div>
                        <h3 style="margin:0; color:#C5A059; font-size:1.2rem;">MVP Entrenadores</h3>
                        <small style="color:#ffcc66;">+2 puntos • Selección del staff</small>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:12px;">`;

    jugadoresHoy.forEach(j => {
        const idStr = String(j.id);
        const seleccionado = mvpEntrenadores.includes(idStr);

        html += `
            <div onclick="toggleMVP('${idStr}', 'entrenador')"
                 style="background:${seleccionado ? 'rgba(197,160,89,0.18)' : 'rgba(255,255,255,0.06)'};
                        border:2px solid ${seleccionado ? '#C5A059' : 'rgba(255,255,255,0.12)'};
                        border-radius:14px; padding:16px; text-align:center; cursor:pointer;
                        transition:all 0.25s ease; position:relative; min-height:110px;">
                <div style="font-weight:700; font-size:1.05rem; color:white; margin:8px 0;">
                    ${escapeHtml(j.nombre)}
                </div>
                ${seleccionado ? `
                <div style="position:absolute; top:8px; right:8px; background:#C5A059; color:#001e3c;
                            font-size:0.7rem; padding:3px 8px; border-radius:20px; font-weight:900;">
                    ✓ ENTRENADOR MVP
                </div>` : ''}
                <div style="font-size:0.8rem; color:#C5A059; font-weight:600; margin-top:8px;">+2 pts</div>
            </div>`;
    });

    html += `</div></div>`;

    // Resumen final
    const totalMVP = mvpJugadores.length + mvpEntrenadores.length;
    html += `
        <div style="margin-top:30px; padding:18px; background:rgba(197,160,89,0.12);
                    border-radius:14px; text-align:center; border:1px solid rgba(197,160,89,0.4);">
            <strong style="color:#C5A059; font-size:1.1rem;">
                ${totalMVP} MVP${totalMVP !== 1 ? 's' : ''} seleccionado${totalMVP !== 1 ? 's' : ''}
            </strong><br>
            <small style="color:#aaa;">Recuerda que los puntos se consolidan al cerrar la jornada</small>
        </div>
    `;

    html += `</div>`;
    contenedor.innerHTML = html;
}

// 8b. GOLPES — ahora solo golpes en hitos-votos
// renderVotos: alias que refresca las dos secciones activas
function renderVotos() {
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    const secMVP = document.getElementById('sec-mvp');
    if (secMVP && secMVP.classList.contains('active')) {
        if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    }
}

// --- UTILIDADES ---

function actualizarBadgePistas() {
    const totalPistas = parseInt(document.getElementById('plan-pistas-totales')?.value) || 2;
    const badge = document.getElementById('pistas-libres-badge');
    if (!badge) return;
    // ✅ FIX BUG ASIGNACIÓN MANUAL: usar getPistasDisponiblesJornada (pistas
    // realmente activadas/reservadas para esta jornada) en lugar de
    // getPistasDelClub (todas las físicas del club). Antes podía decir
    // "Libres: 2 / 8" cuando el club tiene 8 pero la jornada solo usa 3.
    let nLibres, nTotales;
    if (typeof getPistasLibres === 'function' && typeof getPistasDisponiblesJornada === 'function') {
        nLibres  = getPistasLibres().length;
        nTotales = getPistasDisponiblesJornada().length;
    } else {
        const ocupadas = new Set((window.partidosAbiertos || []).map(p => String(p.pista)));
        nTotales = totalPistas;
        nLibres  = Math.max(0, totalPistas - ocupadas.size);
    }
    badge.innerText = `Pistas Libres: ${nLibres} / ${nTotales}`;
}

// --- RELOJ ---
