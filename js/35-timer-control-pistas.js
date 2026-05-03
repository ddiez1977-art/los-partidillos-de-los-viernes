/* ============================================================
   ATP PLATINUM — 35-timer-control-pistas.js
   Timer global de partidos, panel de control de pistas, asignación rápida
   ── Refactor: extraído de script.js (líneas [(11309, 11750)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// FUNCIÓN PARA EXPORTAR COPIA DE SEGURIDAD
// ==========================================

// ==========================================
// TIMER GLOBAL DE PARTIDOS
// ==========================================
// Llamar una vez en isFirstLoad después del resto de inicializaciones
function iniciarTimerPartidos() {
    if (window._timerPartidosInterval) clearInterval(window._timerPartidosInterval);
    window._timerPartidosInterval = setInterval(() => {
        const limite = (parseInt(document.getElementById('plan-duracion')?.value) || 15) * 60 * 1000;
        document.querySelectorAll('[data-partido-timer]').forEach(el => {
            const raw = parseInt(el.getAttribute('data-partido-timer'));
            // ✅ FIX: raw===0 o NaN significan "sin timer", pero !raw bloqueaba también
            // valores negativos pequeños. Usamos isNaN para ser explícitos.
            if (!raw || isNaN(raw)) return;

            let elapsed, pausado;
            if (raw < 0) {
                // Pausado — mostramos el tiempo congelado
                elapsed = -raw;
                pausado = true;
            } else {
                elapsed = Date.now() - raw;
                pausado = false;
            }

            const excedido = elapsed > limite;
            const mins = Math.floor(elapsed / 60000).toString().padStart(2, '0');
            const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');

            el.textContent = `${mins}:${secs}`;
            // Pausado = azul, corriendo normal = dorado, excedido = rojo
            el.style.color = pausado ? '#00d4ff' : (excedido ? '#d9534f' : '#C5A059');

            const card = el.closest('.card-pista-activa, [class*="card"]');
            if (card) {
                const barra = card.querySelector('[data-timer-bar]');
                if (barra) {
                    const pct = Math.min(100, (elapsed / limite) * 100);
                    barra.style.width = `${pct}%`;
                    barra.style.background = pausado ? '#00d4ff' : (excedido ? '#d9534f' : '#C5A059');
                }
                // Actualizar icono del botón pause
                const btnPause = card.querySelector('[data-pause-btn]');
                if (btnPause) btnPause.textContent = pausado ? '▶' : '⏸';
            }
        });
    }, 1000);
}

function resetTimerPartido(idPartido) {
    const p = window.partidosAbiertos.find(x => String(x.id) === String(idPartido));
    if (!p) return;
    p.tiempoInicio = Date.now();
    saveDB();
    if (typeof renderPistas === 'function') renderPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof renderControlPistas === 'function') renderControlPistas();
}


function renderControlPistas() {
    const cont = document.getElementById('control-pistas-container');
    if (!cont) return;

    const seccion = document.getElementById('control-pistas');
    if (seccion) {
        seccion.style.background = '#000c18';
        seccion.style.minHeight = '100vh';
        seccion.style.padding = '0';
        seccion.style.margin = '0';
    }

    const partidos = window.partidosAbiertos || [];
    const totalPistas = parseInt(document.getElementById('plan-pistas-totales')?.value) || 2;
    const limite = (parseInt(document.getElementById('plan-duracion')?.value) || 15) * 60 * 1000;

    let html = `
        <div style="background:#000c18; min-height:100vh; padding-bottom:120px;">

        <div style="background:var(--atp-navy, #001e3c); padding:15px 20px; border-bottom:2px solid #C5A059;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0; color:#C5A059; font-size:1.1rem; font-weight:900; letter-spacing:2px;">
                    🎮 CONTROL DE PISTAS
                </h2>
                <div style="display:flex; gap:8px; align-items:center;">
                    <span style="font-size:0.75rem; color:#ccff00; font-weight:bold;">
                        ${partidos.length} activos · ${getPistasLibres().length} libres de ${getPistasDisponiblesJornada().length}
                    </span>
                    <button onclick="renderControlPistas()"
                        style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);
                               color:white; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:0.7rem;">
                        ↻ Actualizar
                    </button>
                </div>
            </div>
        </div>

        <div style="padding:15px; display:flex; flex-direction:column; gap:12px;">`;

    partidos.forEach(p => {
        const modo       = resolverModoPartido(p);
        const esTrio       = modo.esTrio;
        const esAsimetrico = modo.esAsimetrico;
        const esGamificado = modo.esGamificado;
        const esVenganza = p.esVenganza;

        const colorBorde = esVenganza    ? '#ff9f43'
                         : esGamificado  ? '#00d4ff'
                         : esAsimetrico  ? '#ff6b35'
                         : esTrio        ? '#C5A059'
                         : '#ccff00';

        const elapsed = p.tiempoInicio
            ? (p.tiempoInicio > 0 ? Date.now() - p.tiempoInicio : -p.tiempoInicio)
            : null;
        const pausado = p.tiempoInicio != null && p.tiempoInicio < 0;
        const timerStr = elapsed !== null
            ? `${Math.floor(elapsed / 60000).toString().padStart(2,'0')}:${Math.floor((elapsed % 60000) / 1000).toString().padStart(2,'0')}`
            : '--:--';
        const excedido = elapsed !== null && elapsed > limite;
        const colorTimer = pausado ? '#00d4ff' : (excedido ? '#d9534f' : '#ccff00');

        html += `
            <div style="background:rgba(255,255,255,0.06); border-radius:12px; overflow:hidden;
                        border:1px solid rgba(255,255,255,0.08); border-left:4px solid ${colorBorde};">

                <!-- CABECERA -->
                <div style="background:rgba(0,0,0,0.4); padding:10px 15px;
                            display:flex; justify-content:space-between; align-items:center;
                            border-bottom:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span style="color:${colorBorde}; font-weight:900; font-size:0.85rem; letter-spacing:1px;">
                            PISTA ${p.pista}
                        </span>
                        <span style="color:rgba(255,255,255,0.4); font-size:0.65rem; text-transform:uppercase; letter-spacing:1px;">
                            ${esGamificado ? '🎮 GAMIFICADO' : esAsimetrico ? `⚡ ${modo.etiqueta}` : esTrio ? '🔱 TRÍOS' : p.tipo === 'equipos3' ? '🔄 AUSTRALIANA' : esVenganza ? '🔥 VENGANZA' : (p.tipo || 'DOBLES').toUpperCase()}
                        </span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span data-partido-timer="${p.tiempoInicio || ''}"
                              style="font-family:monospace; font-size:1.1rem; font-weight:900; color:${colorTimer};">
                            ${timerStr}
                        </span>
                        <button onclick="pausarTimerPartido('${p.id}')"
                            data-pause-btn
                            style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);
                                   color:white; padding:3px 10px; border-radius:5px; cursor:pointer; font-size:0.8rem;">
                            ${pausado ? '▶' : '⏸'}
                        </button>
                    </div>
                </div>

                <!-- NOMBRES -->
                <div style="padding:12px 15px 8px 15px;">
                    <div style="color:#ffffff; font-weight:900;
                                font-size:${(esTrio || esAsimetrico) ? '0.9rem' : '1rem'};
                                line-height:1.4; text-shadow:0 1px 4px rgba(0,0,0,0.8);
                                margin-bottom:12px;">
                        ${p.nombres}
                    </div>`;

        if (esGamificado) {
            html += `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-bottom:12px;">`;
            // Preview proporcional
            const _todosGamC = (p.ids || []).map(id => (p.puntosGamificados && p.puntosGamificados[id]) || 0);
            const _maxGamC   = Math.max(0, ..._todosGamC);
            const _numMaxC   = _todosGamC.filter(v => v === _maxGamC).length;
            const _esEmpC    = _numMaxC > 1 && _maxGamC > 0;

            (p.ids || []).forEach(id => {
                const jugador = db.jugadores.find(j => String(j.id) === String(id));
                const nombre = jugador ? jugador.nombre : '???';
                const puntos = (p.puntosGamificados && p.puntosGamificados[id]) || 0;
                let _rkC;
                if (_maxGamC === 0)               _rkC = 1;
                else if (_esEmpC && puntos === _maxGamC) _rkC = 2;
                else if (puntos === _maxGamC)     _rkC = 3;
                else if (puntos === 0)            _rkC = 0;
                else { _rkC = Math.max(1, Math.round((puntos / _maxGamC) * 3)); if (_rkC >= 3) _rkC = 2; }
                const _rkColC = _rkC === 3 ? '#ccff00' : _rkC === 2 ? '#f39c12' : _rkC === 1 ? '#888' : '#ee5253';
                html += `
                    <div style="background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.2);
                                border-radius:8px; padding:8px 10px;
                                display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#ffffff; font-size:0.85rem; font-weight:700;">${nombre}</span>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button onclick="cambiarPuntoGamificadoPorId('${p.id}','${id}',-1)"
                                style="width:28px; height:28px; border:none; background:#ee5253; color:white;
                                       border-radius:6px; cursor:pointer; font-size:1rem; font-weight:900;">−</button>
                            <span style="color:#ccff00; font-weight:900; font-size:1.2rem;
                                         min-width:24px; text-align:center;">${puntos}</span>
                            <button onclick="cambiarPuntoGamificadoPorId('${p.id}','${id}',1)"
                                style="width:28px; height:28px; border:none; background:#10ac84; color:white;
                                       border-radius:6px; cursor:pointer; font-size:1rem; font-weight:900;">+</button>
                            <span style="font-size:0.6rem; color:${_rkColC}; font-weight:900;">+${_rkC}🏆</span>
                        </div>
                    </div>`;
            });
            html += `</div>`;

        } else if (p.tipo === 'equipos3' && p.ids && p.ids.length === 3) {
            // ── AUSTRALIANA UI (dark panel) ──
            const [idA, idB, idC] = p.ids.map(String);
            const rondaIdx = (p.rondaActual ?? 0) % 3;
            const rondaNum = p.rondaActual ?? 0;
            const rondas   = [
                { pareja: [idA, idB], solo: idC },
                { pareja: [idA, idC], solo: idB },
                { pareja: [idB, idC], solo: idA }
            ];
            const cfg = rondas[rondaIdx];
            const gN  = id => db.jugadores.find(j => String(j.id) === id)?.nombre || '???';
            const pts = p.puntosAustraliana || { [idA]: 0, [idB]: 0, [idC]: 0 };
            const nombrePareja = cfg.pareja.map(id => gN(id)).join(' + ');
            const nombreSolo   = gN(cfg.solo);

            html += `
                <!-- Ronda actual -->
                <div style="background:rgba(167,139,250,0.12); border:1px solid rgba(167,139,250,0.3);
                            border-radius:8px; padding:10px; margin-bottom:10px; text-align:center;">
                    <div style="font-size:0.55rem; color:#a78bfa; font-weight:900; letter-spacing:1px; margin-bottom:4px;">
                        RONDA ${rondaNum + 1} — CONFIGURACIÓN ACTUAL
                    </div>
                    <div style="font-size:0.85rem; font-weight:900; color:white;">
                        🤝 ${nombrePareja}
                        <span style="color:rgba(255,255,255,0.3); margin:0 6px;">VS</span>
                        🎾 ${nombreSolo}
                    </div>
                </div>
                <!-- Marcador ronda -->
                <div style="display:flex; align-items:center; gap:15px; margin-bottom:10px;
                            background:rgba(0,0,0,0.3); border-radius:10px; padding:12px 15px;
                            border:1px solid rgba(255,255,255,0.06);">
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.55rem; color:rgba(255,255,255,0.4); font-weight:bold; margin-bottom:6px;">PAREJA</div>
                        <div style="font-size:2.5rem; font-weight:900; color:#ccff00; line-height:1; margin-bottom:8px;">${p.juegosA || 0}</div>
                        <div style="display:flex; justify-content:center; gap:8px;">
                            <button onclick="sumarJuegoPorId('${p.id}','A'); renderControlPistas();"
                                style="width:40px; height:40px; border:none; background:#10ac84; color:white;
                                       border-radius:8px; cursor:pointer; font-size:1.3rem; font-weight:900;">+</button>
                            <button onclick="restarJuegoPorId('${p.id}','A'); renderControlPistas();"
                                style="width:40px; height:40px; border:none; background:#ee5253; color:white;
                                       border-radius:8px; cursor:pointer; font-size:1.3rem; font-weight:900;">−</button>
                        </div>
                    </div>
                    <div style="font-size:1rem; color:rgba(255,255,255,0.2); font-weight:900;">VS</div>
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.55rem; color:rgba(255,255,255,0.4); font-weight:bold; margin-bottom:6px;">SOLO</div>
                        <div style="font-size:2.5rem; font-weight:900; color:#ccff00; line-height:1; margin-bottom:8px;">${p.juegosB || 0}</div>
                        <div style="display:flex; justify-content:center; gap:8px;">
                            <button onclick="sumarJuegoPorId('${p.id}','B'); renderControlPistas();"
                                style="width:40px; height:40px; border:none; background:#10ac84; color:white;
                                       border-radius:8px; cursor:pointer; font-size:1.3rem; font-weight:900;">+</button>
                            <button onclick="restarJuegoPorId('${p.id}','B'); renderControlPistas();"
                                style="width:40px; height:40px; border:none; background:#ee5253; color:white;
                                       border-radius:8px; cursor:pointer; font-size:1.3rem; font-weight:900;">−</button>
                        </div>
                    </div>
                </div>
                <!-- Botón rotar -->
                <button onclick="rotarAustraliana('${p.id}')"
                    style="width:100%; padding:11px; background:#a78bfa; color:white; border:none;
                           border-radius:8px; font-weight:900; cursor:pointer; font-size:0.85rem;
                           letter-spacing:1px; margin-bottom:10px;">
                    🔄 ROTAR — Siguiente configuración
                </button>
                <!-- Acumulados -->
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:4px;">
                    ${p.ids.map(id => {
                        const soloAcumCtrl = (p.juegosSoloAustraliana || {})[String(id)] || 0;
                        const totalAcum = pts[String(id)] || 0;
                        const esCurrentSolo = String(cfg.solo) === String(id);
                        return `
                        <div style="background:rgba(255,255,255,${esCurrentSolo ? '0.12' : '0.06'}); border-radius:8px; padding:8px; text-align:center; border:1px solid ${esCurrentSolo ? 'rgba(167,139,250,0.5)' : 'transparent'};">
                            <div style="font-size:0.6rem; color:rgba(255,255,255,0.5); margin-bottom:4px;">${gN(String(id))}${esCurrentSolo ? ' 🎾' : ''}</div>
                            <div style="font-size:1.3rem; font-weight:900; color:#ccff00;">${totalAcum}</div>
                            ${soloAcumCtrl > 0 ? `<div style="font-size:0.5rem; color:#ff9f43;">(solo: ${soloAcumCtrl})</div>` : `<div style="font-size:0.5rem; color:rgba(255,255,255,0.3);">juegos</div>`}
                        </div>`;
                    }).join('')}
                </div>`;

        } else {
            // ── MODO TIE-BREAK activo (dark) ───────────────────────
            if (p.tiebreak) {
                html += _htmlTiebreak(p, true);
            }

            html += `
                <div style="display:flex; align-items:center; gap:15px; margin-bottom:12px;
                            background:rgba(0,0,0,0.3); border-radius:10px; padding:12px 15px;
                            border:1px solid rgba(255,255,255,0.06);">
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.6rem; color:rgba(255,255,255,0.4); font-weight:bold;
                                    margin-bottom:6px; letter-spacing:1px;">EQUIPO A</div>
                        <div style="font-size:2.5rem; font-weight:900; color:#ccff00;
                                    line-height:1; margin-bottom:8px;">${p.juegosA || 0}</div>
                        <div style="display:flex; justify-content:center; gap:8px;">
                            <button onclick="sumarJuegoPorId('${p.id}','A'); renderControlPistas();"
                                style="width:40px; height:40px; border:none; background:#10ac84; color:white;
                                       border-radius:8px; cursor:pointer; font-size:1.3rem; font-weight:900;">+</button>
                            <button onclick="restarJuegoPorId('${p.id}','A'); renderControlPistas();"
                                style="width:40px; height:40px; border:none; background:#ee5253; color:white;
                                       border-radius:8px; cursor:pointer; font-size:1.3rem; font-weight:900;">−</button>
                        </div>
                    </div>
                    <div style="font-size:1rem; color:rgba(255,255,255,0.2); font-weight:900;">VS</div>
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.6rem; color:rgba(255,255,255,0.4); font-weight:bold;
                                    margin-bottom:6px; letter-spacing:1px;">EQUIPO B</div>
                        <div style="font-size:2.5rem; font-weight:900; color:#ccff00;
                                    line-height:1; margin-bottom:8px;">${p.juegosB || 0}</div>
                        <div style="display:flex; justify-content:center; gap:8px;">
                            <button onclick="sumarJuegoPorId('${p.id}','B'); renderControlPistas();"
                                style="width:40px; height:40px; border:none; background:#10ac84; color:white;
                                       border-radius:8px; cursor:pointer; font-size:1.3rem; font-weight:900;">+</button>
                            <button onclick="restarJuegoPorId('${p.id}','B'); renderControlPistas();"
                                style="width:40px; height:40px; border:none; background:#ee5253; color:white;
                                       border-radius:8px; cursor:pointer; font-size:1.3rem; font-weight:900;">−</button>
                        </div>
                    </div>
                </div>

                <!-- Botón activar tie-break (dark) -->
                ${!p.tiebreak ? `
                <div style="text-align:center; margin-bottom:10px;">
                    <button class="btn-tiebreak-activar" onclick="toggleTiebreak('${p.id}'); renderControlPistas();">
                        🎾 Activar tie-break
                    </button>
                </div>` : ''}`;
        }

        // ✅ FIX BUG 1: eliminado el </div> extra — solo dos cierres: botones + card principal
        html += `
                <!-- BOTÓN GOLPES RÁPIDO (dark) -->
                <div style="padding:0 15px 8px 15px;">
                    <button onclick="irAGolpesDesdePartido('${p.id}', 'control-pistas')"
                        style="width:100%; padding:10px 12px;
                               background:rgba(204,255,0,0.08); border:1px solid rgba(204,255,0,0.25);
                               color:#ccff00; border-radius:8px; font-weight:900; cursor:pointer;
                               font-size:0.78rem; letter-spacing:1px; touch-action:manipulation;
                               display:flex; align-items:center; justify-content:center; gap:6px;">
                        🎯 Registrar golpes de este partido
                    </button>
                </div>
                <!-- BOTONES ACCIÓN -->
                <div style="display:flex; gap:8px; padding:0 15px 12px 15px;">
                    <button onclick="finalizarPartidoPorId('${p.id}')"
                        style="flex:3; padding:12px; background:#d9534f; color:white; border:none;
                               border-radius:8px; font-weight:900; cursor:pointer; font-size:0.9rem;
                               letter-spacing:1px; min-height:48px; touch-action:manipulation;">
                        🏁 FINALIZAR
                    </button>
                    <button onclick="menuEdicionRapida('${p.id}')"
                        style="flex:1; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);
                               color:white; border-radius:8px; cursor:pointer; font-size:1rem;
                               min-height:48px; touch-action:manipulation;">🛠️</button>
                </div>
                <div style="padding:0 15px 12px 15px; text-align:right;">
                    <button onclick="anularPartidoSinGuardarPorId('${p.id}')"
                        style="background:transparent; border:1px solid rgba(217,83,79,0.3);
                               color:rgba(255,107,107,0.7); border-radius:8px; cursor:pointer;
                               font-size:0.68rem; padding:6px 14px; touch-action:manipulation;">
                        🗑️ Anular sin guardar
                    </button>
                </div>
            </div>`;
    });

    // PISTAS LIBRES — iterar las pistas DISPONIBLES PARA LA JORNADA
    // ✅ FIX BUG ASIGNACIÓN MANUAL: antes usaba getPistasDelClub() (todas las
    // físicas del club), mostrando como "libres" pistas que ni siquiera
    // estaban activadas. Ahora solo muestra las que tienen sentido en la jornada.
    const _pistasDisponibles = getPistasDisponiblesJornada();
    const _ocupadasSet = new Set(partidos.map(p => String(p.pista)));
    _pistasDisponibles.forEach(i => {
        if (!_ocupadasSet.has(String(i))) {
            html += `
                <div style="background:rgba(204,255,0,0.04); border:1px dashed rgba(204,255,0,0.25);
                            border-radius:12px; padding:25px; text-align:center;">
                    <div style="color:rgba(204,255,0,0.7); font-size:0.85rem; margin-bottom:10px;
                                font-weight:900; letter-spacing:2px; text-transform:uppercase;">
                        PISTA ${i} — LIBRE
                    </div>
                    <button onclick="asignarPistaRapida(${i})"
                        style="background:rgba(204,255,0,0.12); border:1px solid rgba(204,255,0,0.4);
                               color:#ccff00; padding:10px 24px; border-radius:8px; cursor:pointer;
                               font-size:0.85rem; font-weight:bold; letter-spacing:1px;">
                        + Asignar partido
                    </button>
                </div>`;
        }
    });

    html += `
        <button onclick="showSection('jornada')"
            style="width:100%; padding:12px; background:rgba(255,255,255,0.05);
                   border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.5);
                   border-radius:8px; cursor:pointer; font-size:0.8rem; margin-top:8px;
                   letter-spacing:1px;">
            ← IR A CONFIGURACIÓN COMPLETA DE JORNADA
        </button>
        </div>
        </div>`;

    cont.innerHTML = html;
}

// Botón rápido desde pista libre — lleva a jornada y pre-selecciona la pista
function asignarPistaRapida(numPista) {
    showSection('jornada');
    // Poblar el select (libre/ocupado) y preseleccionar la pista elegida
    poblarSelectPistaManual(numPista);
    const selector = document.getElementById('selector-partido-manual');
    if (selector) setTimeout(() => selector.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
}


function pausarTimerPartido(idPartido) {
    const p = window.partidosAbiertos.find(x => String(x.id) === String(idPartido));
    if (!p) return;

    if (!p.tiempoInicio) return;

    if (p.tiempoInicio > 0) {
        // ✅ PAUSAR: guardamos el tiempo transcurrido como negativo
        // El signo negativo es la señal de "pausado" — almacena cuánto
        // tiempo llevaba corriendo en el momento de pausar.
        const elapsed = Date.now() - p.tiempoInicio;
        p.tiempoInicio = -elapsed; // negativo = pausado, valor = ms transcurridos
    } else {
        // ✅ REANUDAR: reconstruimos el tiempoInicio restando los ms ya transcurridos
        const elapsed = -p.tiempoInicio; // recuperamos los ms guardados
        p.tiempoInicio = Date.now() - elapsed;
    }

    saveDB();
    renderPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof renderControlPistas === 'function') renderControlPistas();
}


