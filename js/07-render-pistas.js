/* ============================================================
   ATP PLATINUM — 07-render-pistas.js
   Render de pistas en directo (núcleo visual)
   ── Refactor: extraído de script.js (líneas [(2789, 3132)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function renderPistas() {
    const cont = document.getElementById('partidos-abiertos-container');
    if (!cont) return;

    const partidos = window.partidosAbiertos || [];

    if (partidos.length === 0) {
        cont.innerHTML = `
            <div style="text-align:center; opacity:0.6; padding:60px 20px; border: 2px dashed #ddd; border-radius: 15px; background: #f9f9f9;">
                <div style="font-size: 3rem; margin-bottom: 10px;">🎾</div>
                <p style="font-size: 1rem; color: #555; font-weight: 500;">No hay partidos activos en este momento.</p>
                <small style="color: #888;">Utiliza el planificador o el panel manual para asignar pistas.</small>
            </div>`;
        if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();
        return;
    }

    const limiteMins = parseInt(document.getElementById('plan-duracion')?.value) || 15;
    const limiteMs = limiteMins * 60 * 1000;

    let html = "";

    partidos.forEach((p, index) => {
        const modo = resolverModoPartido(p);
        const esTrio       = modo.esTrio;
        const esAsimetrico = modo.esAsimetrico;

        let estiloCard = 'background: white;';
        let colorBadge = '#001e3c';
        let extraLabel = modo.icono + ' ' + modo.etiqueta;

        if (p.gamified) {
            estiloCard = 'border-left: 8px solid #00d4ff; background: linear-gradient(to right, rgba(0,212,255,0.05), white);';
            colorBadge = '#00d4ff';
            extraLabel = '🎮 GAMIFICADO';
        } else if (p.esVenganza) {
            estiloCard = 'border-left: 8px solid #ff9f43; background: linear-gradient(to right, rgba(255,159,67,0.1), white); box-shadow: 0 6px 15px rgba(255,159,67,0.2);';
            colorBadge = '#ff9f43';
            extraLabel = "🔥 VENGANZA 🔥";
        } else if (esAsimetrico) {
            estiloCard = 'border-left: 8px solid #ff6b35; background: linear-gradient(to right, rgba(255,107,53,0.05), white);';
            colorBadge = '#ff6b35';
            extraLabel = `⚡ ${modo.etiqueta}`;
        } else if (esTrio) {
            estiloCard = 'border-left: 8px solid #C5A059; background: white;';
            colorBadge = '#C5A059';
            extraLabel = "🔱 MODO TRÍO";
        } else if (p.tipo === 'equipos3') {
            // ✅ Australiana
            estiloCard = 'border-left: 8px solid #a78bfa; background: linear-gradient(to right, rgba(167,139,250,0.05), white);';
            colorBadge = '#a78bfa';
            extraLabel = `🔄 AUSTRALIANA R${(p.rondaActual ?? 0) + 1}`;
        } else {
            estiloCard = 'border-left: 8px solid #001e3c; background: white;';
        }

        // ✅ Australiana: mostrar ronda activa en lugar del nombre inicial
        let nombresDisplay = p.nombres;
        if (p.tipo === 'equipos3' && p.ids && p.ids.length === 3) {
            const [_idA, _idB, _idC] = p.ids.map(String);
            const _ri = (p.rondaActual ?? 0) % 3;
            const _rondas = [
                { par: [_idA, _idB], sol: _idC },
                { par: [_idA, _idC], sol: _idB },
                { par: [_idB, _idC], sol: _idA }
            ];
            const _cfg = _rondas[_ri];
            const _gN = id => db.jugadores.find(j => String(j.id) === id)?.nombre || '???';
            nombresDisplay = `R${(p.rondaActual ?? 0) + 1}: ${_cfg.par.map(_gN).join('+')} vs ${_gN(_cfg.sol)}`;
        }

        const partidoId = p.id;
        const colorTextoBadge = (esTrio || esAsimetrico || p.esVenganza || p.gamified) ? 'black' : 'white';

        // ✅ NUEVO: calcular tiempo transcurrido para mostrar estado inicial
        // ✅ Reemplaza el bloque timerHTML dentro de renderPistas()
let timerHTML = '';
if (p.tiempoInicio) {
    // ✅ FIX BUG 4: misma corrección — tiempoInicio negativo = pausado
    const elapsed = p.tiempoInicio < 0
        ? -p.tiempoInicio
        : Date.now() - p.tiempoInicio;
    const excedido = elapsed > limiteMs;
    const pct = Math.min(100, (elapsed / limiteMs) * 100).toFixed(1);
    const mins = Math.floor(elapsed / 60000).toString().padStart(2, '0');
    const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
    timerHTML = `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;
                    padding:8px 12px; background:#f8f9fa; border-radius:8px; border:1px solid #eee;">
            <span style="font-size:0.6rem; color:#888; font-weight:bold; text-transform:uppercase; min-width:52px;">TIEMPO</span>
            <span data-partido-timer="${p.tiempoInicio}"
                  style="font-family:monospace; font-size:1.05rem; font-weight:900;
                         color:${excedido ? '#d9534f' : '#C5A059'}; min-width:50px;">
                ${mins}:${secs}
            </span>
            <div style="flex:1; background:#e9ecef; height:5px; border-radius:4px; overflow:hidden;">
                <div data-timer-bar
                     style="width:${pct}%; height:100%;
                            background:${excedido ? '#d9534f' : '#C5A059'};
                            transition:width 1s linear;">
                </div>
            </div>
            ${excedido
                ? `<span style="font-size:0.6rem; background:#fee; color:#d9534f; padding:2px 6px; border-radius:4px; font-weight:bold;">¡Tiempo!</span>`
                : `<span style="font-size:0.6rem; color:#aaa;">${limiteMins}min</span>`}
            <button onclick="pausarTimerPartido('${partidoId}')"
                data-pause-btn="${partidoId}"
                style="background:none; border:1px solid #ddd; border-radius:5px; padding:2px 7px;
                       font-size:0.65rem; cursor:pointer; color:#888;">
                ${p.tiempoInicio < 0 ? '▶' : '⏸'}
            </button>
            <button onclick="resetTimerPartido('${partidoId}')"
                style="background:none; border:1px solid #ddd; border-radius:5px; padding:2px 7px;
                       font-size:0.65rem; cursor:pointer; color:#888;">↺</button>
        </div>`;
}

        html += `
            <div class="card-pista-activa" style="${estiloCard} margin-bottom:18px; padding:18px; position:relative; box-shadow:0 6px 12px rgba(0,0,0,0.1); border-radius:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: ${colorBadge}; color: ${colorTextoBadge}; padding: 3px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 900;">
                            PISTA ${p.pista}
                        </span>
                        <span style="font-size:0.65rem; font-weight:bold; color:#888; text-transform:uppercase;">
                            ${extraLabel}
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px; opacity: 0.7;">
                        <small style="font-weight: bold; color: #555;">🕒 ${p.inicio || '--:--'}</small>
                    </div>
                </div>

                <h4 style="margin:8px 0 12px 0; font-size:${esTrio ? '1rem' : '1.15rem'}; color:#001e3c; font-weight: 800;">
                    ${nombresDisplay}
                </h4>

                ${timerHTML}
        `;

        if (p.gamified) {
            html += `<div style="margin-top: 15px; border-top: 1px solid rgba(0, 212, 255, 0.2); padding-top: 10px;">`;
            // Pre-calcular máximo para preview proporcional
            const _todosGam = (p.ids || []).map(id => (p.puntosGamificados && p.puntosGamificados[id]) || 0);
            const _maxGamP  = Math.max(0, ..._todosGam);
            const _numMaxP  = _todosGam.filter(v => v === _maxGamP).length;
            const _esEmpP   = _numMaxP > 1 && _maxGamP > 0;

            (p.ids || []).forEach(id => {
                const jugador = db.jugadores.find(j => String(j.id) === String(id));
                const nombre = jugador ? jugador.nombre : "???";
                const puntos = (p.puntosGamificados && p.puntosGamificados[id]) || 0;
                // Preview pts ranking proporcional
                let _rkP;
                if (_maxGamP === 0)              _rkP = 1;
                else if (_esEmpP && puntos === _maxGamP) _rkP = 2;
                else if (puntos === _maxGamP)    _rkP = 3;
                else if (puntos === 0)           _rkP = 0;
                else { _rkP = Math.max(1, Math.round((puntos / _maxGamP) * 3)); if (_rkP >= 3) _rkP = 2; }
                const _rkColor = _rkP === 3 ? '#10ac84' : _rkP === 2 ? '#f39c12' : _rkP === 1 ? '#888' : '#ee5253';

                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.6); padding: 5px 10px; border-radius: 8px; margin-bottom: 5px; border: 1px solid rgba(0, 212, 255, 0.1);">
                        <span style="font-weight: 700; font-size: 0.8rem;">${nombre.toUpperCase()}</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button onclick="cambiarPuntoGamificadoPorId('${partidoId}', '${id}', -1)" style="width: 25px; height: 25px; border: none; background: #ee5253; color: white; border-radius: 4px; cursor: pointer;">-</button>
                            <span style="font-size: 1rem; font-weight: 900; min-width: 20px; text-align: center;">${puntos}</span>
                            <button onclick="cambiarPuntoGamificadoPorId('${partidoId}', '${id}', 1)" style="width: 25px; height: 25px; border: none; background: #10ac84; color: white; border-radius: 4px; cursor: pointer;">+</button>
                            <span style="font-size: 0.6rem; color:${_rkColor}; font-weight:900; min-width:30px; text-align:center;">→+${_rkP}🏆</span>
                        </div>
                    </div>`;
            });
            html += `</div>`;

        } else if (p.tipo === 'equipos3' && p.ids && p.ids.length === 3) {
            // ── AUSTRALIANA UI ──
            const [idA, idB, idC] = p.ids.map(String);
            const rondaIdx  = (p.rondaActual ?? 0) % 3;
            const rondaNum  = p.rondaActual ?? 0;
            const rondas    = [
                { pareja: [idA, idB], solo: idC },
                { pareja: [idA, idC], solo: idB },
                { pareja: [idB, idC], solo: idA }
            ];
            const cfg = rondas[rondaIdx];
            const gN  = id => db.jugadores.find(j => String(j.id) === id)?.nombre || '???';
            const pts = p.puntosAustraliana || { [idA]: 0, [idB]: 0, [idC]: 0 };

            // Tabla de acumulados
            const filasPts = p.ids.map(id => {
                const nombre = gN(String(id));
                const acum   = pts[String(id)] || 0;
                return `<div style="display:flex; justify-content:space-between; align-items:center;
                                    padding:4px 8px; border-radius:6px; background:#f8f9fa; margin-bottom:3px;">
                            <span style="font-size:0.8rem; font-weight:700;">${nombre}</span>
                            <span style="font-size:1rem; font-weight:900; color:#001e3c;">${acum} jgs</span>
                        </div>`;
            }).join('');

            const nombrePareja = cfg.pareja.map(id => gN(id)).join(' + ');
            const nombreSolo   = gN(cfg.solo);

            html += `
                <div style="margin-top:12px;">
                    <!-- Ronda actual -->
                    <div style="background:#e8f4fd; border:1px solid #bee3f8; border-radius:8px;
                                padding:10px 14px; margin-bottom:10px; text-align:center;">
                        <div style="font-size:0.6rem; color:#2b6cb0; font-weight:900; letter-spacing:1px; margin-bottom:4px;">
                            RONDA ${rondaNum + 1} · CONFIGURACIÓN ACTUAL
                        </div>
                        <div style="font-size:0.85rem; font-weight:900; color:#1a365d;">
                            🤝 ${nombrePareja}
                            <span style="color:#718096; margin:0 6px;">VS</span>
                            🎾 ${nombreSolo}
                        </div>
                    </div>
                    <!-- Marcador ronda -->
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;
                                background:#f8f9fa; padding:10px; border-radius:10px; border:1px solid #eee;">
                        <div style="flex:1; text-align:center;">
                            <div style="font-size:0.55rem; font-weight:900; color:#555; margin-bottom:4px;">PAREJA</div>
                            <div style="font-size:2rem; font-weight:900; color:#001e3c;">${p.juegosA || 0}</div>
                            <div style="display:flex; justify-content:center; gap:5px; margin-top:4px;">
                                <button onclick="sumarJuegoPorId('${partidoId}','A')" style="width:32px; height:32px; border:none; background:#10ac84; color:white; border-radius:6px; font-size:1.1rem; cursor:pointer;">+</button>
                                <button onclick="restarJuegoPorId('${partidoId}','A')" style="width:32px; height:32px; border:none; background:#ee5253; color:white; border-radius:6px; font-size:1.1rem; cursor:pointer;">−</button>
                            </div>
                        </div>
                        <div style="font-size:0.75rem; color:#ccc; font-weight:900;">VS</div>
                        <div style="flex:1; text-align:center;">
                            <div style="font-size:0.55rem; font-weight:900; color:#555; margin-bottom:4px;">SOLO</div>
                            <div style="font-size:2rem; font-weight:900; color:#001e3c;">${p.juegosB || 0}</div>
                            <div style="display:flex; justify-content:center; gap:5px; margin-top:4px;">
                                <button onclick="sumarJuegoPorId('${partidoId}','B')" style="width:32px; height:32px; border:none; background:#10ac84; color:white; border-radius:6px; font-size:1.1rem; cursor:pointer;">+</button>
                                <button onclick="restarJuegoPorId('${partidoId}','B')" style="width:32px; height:32px; border:none; background:#ee5253; color:white; border-radius:6px; font-size:1.1rem; cursor:pointer;">−</button>
                            </div>
                        </div>
                    </div>
                    <!-- Botón rotar -->
                    <button onclick="rotarAustraliana('${partidoId}')"
                        style="width:100%; padding:10px; background:#a78bfa; color:white; border:none;
                               border-radius:8px; font-weight:900; cursor:pointer; font-size:0.85rem;
                               letter-spacing:1px; margin-bottom:10px;">
                        🔄 ROTAR — Siguiente configuración
                    </button>
                    <!-- Acumulados -->
                    <div style="font-size:0.6rem; color:#888; font-weight:900; letter-spacing:1px; margin-bottom:4px; text-transform:uppercase;">
                        Juegos acumulados:
                    </div>
                    ${filasPts}
                </div>`;

        } else {
            // ── MODO TIE-BREAK activo ──────────────────────────────
            if (p.tiebreak) {
                html += _htmlTiebreak(p, false);
            }

            // SCRIPT-2 FIX: cuando el tie-break está activo, los botones normales +/-
            // de juegos siguen visibles y operativos, lo que confunde al admin que
            // puede modificar juegosA/B mientras usa el TB. Los ocultamos con display:none
            // cuando p.tiebreak es true. El marcador de juegos se sigue mostrando (solo lectura)
            // para que el admin sepa el contexto (ej: partido 0-0 + TB).
            html += `
                <div style="display:flex; align-items:center; justify-content:center; gap:15px; margin:15px 0; background: #f8f9fa; padding: 12px; border-radius: 12px; border: 1px solid #eee;${p.tiebreak ? '; opacity:0.45; pointer-events:none;' : ''}">
                    ${p.tiebreak ? '<div style="width:100%;text-align:center;font-size:0.65rem;color:#888;font-style:italic;">Marcador de sets (solo lectura mientras hay TB activo)</div>' : ''}
                    <div style="text-align:center; flex: 1;">
                        <div style="font-size:0.6rem; font-weight:900; color:#555;">EQUIPO A</div>
                        <div style="font-size:2.5rem; font-weight:900; color:#001e3c;">${p.juegosA || 0}</div>
                        <div style="display: flex; justify-content: center; gap: 5px;${p.tiebreak ? '; display:none;' : ''}">
                            <button onclick="sumarJuegoPorId('${partidoId}', 'A')" style="width:35px; height:35px; border:none; background:#10ac84; color:white; border-radius:6px; font-size:1.2rem; cursor: pointer;">+</button>
                            <button onclick="restarJuegoPorId('${partidoId}', 'A')" style="width:35px; height:35px; border:none; background:#ee5253; color:white; border-radius:6px; font-size:1.2rem; cursor: pointer;">−</button>
                        </div>
                    </div>
                    <div style="font-size:0.8rem; color:#ccc; font-weight:900;">VS</div>
                    <div style="text-align:center; flex: 1;">
                        <div style="font-size:0.6rem; font-weight:900; color:#555;">EQUIPO B</div>
                        <div style="font-size:2.5rem; font-weight:900; color:#001e3c;">${p.juegosB || 0}</div>
                        <div style="display: flex; justify-content: center; gap: 5px;${p.tiebreak ? '; display:none;' : ''}">
                            <button onclick="sumarJuegoPorId('${partidoId}', 'B')" style="width:35px; height:35px; border:none; background:#10ac84; color:white; border-radius:6px; font-size:1.2rem; cursor: pointer;">+</button>
                            <button onclick="restarJuegoPorId('${partidoId}', 'B')" style="width:35px; height:35px; border:none; background:#ee5253; color:white; border-radius:6px; font-size:1.2rem; cursor: pointer;">−</button>
                        </div>
                    </div>
                </div>

                <!-- Botón activar tie-break -->
                ${!p.tiebreak ? `
                <div style="text-align:center; margin-bottom:4px;">
                    <button class="btn-tiebreak-activar" onclick="toggleTiebreak('${partidoId}')">
                        🎾 Activar tie-break
                    </button>
                </div>` : ''}`;
        }

        html += `
                <!-- Botón acceso rápido a golpes de los jugadores de ESTE partido -->
                <div style="margin-top:10px; margin-bottom:2px;">
                    <button onclick="irAGolpesDesdePartido('${partidoId}', 'jornada')"
                        style="width:100%; padding:9px 12px; background:linear-gradient(135deg,#001e3c,#002d5c);
                               color:#ccff00; border:1px solid rgba(204,255,0,0.3); border-radius:10px;
                               font-weight:900; font-size:0.78rem; cursor:pointer; letter-spacing:1px;
                               touch-action:manipulation; display:flex; align-items:center; justify-content:center; gap:6px;">
                        🎯 Registrar golpes de este partido
                    </button>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button onclick="finalizarPartidoPorId('${partidoId}')" style="flex: 3; padding:12px; background:#ee5253; color:white; border:none; border-radius:10px; font-weight:900; cursor: pointer; text-transform: uppercase; min-height:48px; touch-action:manipulation;">🏁 Finalizar</button>
                    <button onclick="menuEdicionRapida('${partidoId}')" style="flex: 1; background: #fff; border: 1px solid #ccc; border-radius: 10px; cursor: pointer; min-height:48px; touch-action:manipulation; font-size:1.2rem;">🛠️</button>
                </div>
                <div style="margin-top:6px; text-align:right;">
                    <button onclick="anularPartidoSinGuardarPorId('${partidoId}')"
                        style="background:transparent; border:1px solid #ddd; color:#aaa;
                               border-radius:8px; cursor:pointer; font-size:0.68rem; padding:6px 14px;
                               touch-action:manipulation;">
                        🗑️ Anular sin guardar
                    </button>
                </div>
            </div>`;
    });

    cont.innerHTML = html;
}



/**
 * Elimina un partido de la pista activa sin guardarlo en el historial
 * y libera a los jugadores para que puedan volver a jugar.
 */


// ✅ NUEVO: Wrapper de finalizarPartido que busca por ID en lugar de índice
function finalizarPartidoPorId(id) {
    const index = window.partidosAbiertos.findIndex(p => String(p.id) === String(id));
    if (index === -1) return alert("❌ Partido no encontrado. Puede que ya haya sido finalizado.");
    finalizarPartido(index); // Llama a tu función original intacta
}

// ✅ NUEVO: Wrapper de anularPartidoSinGuardar que busca por ID
function anularPartidoSinGuardarPorId(id) {
    const index = window.partidosAbiertos.findIndex(p => String(p.id) === String(id));
    if (index === -1) return alert("❌ Partido no encontrado.");
    anularPartidoSinGuardar(index); // Llama a tu función original intacta
}

