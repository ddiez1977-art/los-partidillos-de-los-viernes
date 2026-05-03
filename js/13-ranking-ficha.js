/* ============================================================
   ATP PLATINUM — 13-ranking-ficha.js
   Ranking general, rangos, insignias, ficha modal de jugador
   ── Refactor: extraído de script.js (líneas [(4716, 5046)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// --- RANKING Y RANGOS ---
function obtenerRango(pts) {
    if (pts >= 100) return { nombre: 'Platinum', clase: 'rango-platinum' };
    if (pts >= 50) return { nombre: 'Oro', clase: 'rango-oro' };
    if (pts >= 20) return { nombre: 'Plata', clase: 'rango-plata' };
    return { nombre: 'Bronce', clase: 'rango-bronce' };
}

function obtenerInsignias(jugador) {
    if (!jugador) return "";

    let html = "";
    const jornadaEnCurso = window.jornadaActiva && !window.jornadaCerrada;

    // ✅ FIX: Antes leía statsAcumuladas que se resetea a 0 tras cerrar jornada.
    // Ahora usa stats.* (permanente) + golpesGanadoresHoy (solo jornada activa),
    // igual que renderAnalisisAvanzado() y actualizarTablonAnuncios().
    const campoStats = {
        ace:     'aces',
        winner:  'winners',
        smash:   'smashes',
        volea:   'voleas',
        dejada:  'dejadas',
        passing: 'passings'
    };

    const getValor = (j, catId) => {
        const permanente = (j.stats && j.stats[campoStats[catId]]) || 0;
        const hoy = jornadaEnCurso
            ? ((window.golpesGanadoresHoy || {})[j.id]?.[catId] || 0)
            : 0;
        return permanente + hoy;
    };

    CATEGORIAS_GOLPES.forEach(cat => {
        const lider = [...db.jugadores]
            .filter(j => j.stats)
            .sort((a, b) => getValor(b, cat.id) - getValor(a, cat.id))[0];

        // ✅ FIX: String() para evitar discrepancias de tipo number vs string en IDs
        if (lider && String(lider.id) === String(jugador.id) && getValor(jugador, cat.id) > 0) {
            html += `<span title="Líder ${cat.label}">${cat.label.split(' ')[0]}</span>`;
        }
    });
    return html;
}

function renderRanking() {
    const contenedor = document.getElementById('lista-ranking');
    if (!contenedor) {
        console.warn("⚠️ Contenedor #lista-ranking no encontrado");
        return;
    }

    let jugadores = [...(db.jugadores || [])]
        .filter(j => !j.esInvitado)   // ✅ Excluir invitados/lúdicos del ranking
        .sort((a, b) => (b.puntosTotales || 0) - (a.puntosTotales || 0));

    if (jugadores.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:#2d3e50; background:#f8f9fa; border-radius:16px;">
                <h3 style="color:#6e5526;">🏆 Ranking General</h3>
                <p>Aún no hay puntos registrados.</p>
            </div>`;
        return;
    }

    let html = `
        <div style="margin-bottom:25px; text-align:center;">
            <h2 style="color:#6e5526; font-size:1.9rem; margin:0;">🏆 RANKING GENERAL</h2>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px;">`;

    jugadores.forEach((jug, index) => {
        const pos = index + 1;
        const medalla = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}º`;
        const esTop3 = pos <= 3;
        const mvps  = jug.stats?.mvps || 0;
        const mvpsE = jug.stats?.mvpsEntrenador || 0;

        // ✅ FIX CONTRASTE CLASSIC: colores oscurecidos para WCAG AA (ratio ≥ 4.5
        // sobre fondo claro #f8f1e3 / #f8f9fa). Dorado original #C5A059 (ratio 2.19)
        // → #8c6f39 (ratio 4.6). Verde original #10ac84 (ratio 2.57) → #0a7556 (ratio 4.7).
        let mvpsBadge = '';
        if (mvps > 0 && mvpsE > 0) {
            mvpsBadge = `<div style="font-size:0.92rem; font-weight:700; display:flex; gap:14px; flex-wrap:wrap; margin-top:2px;">
                <span style="color:#0a7556;">👑 ${mvps} MVP${mvps>1?'s':''}</span>
                <span style="color:#8c6f39;">👨‍🏫 ${mvpsE}</span>
            </div>`;
        } else if (mvps > 0) {
            mvpsBadge = `<div style="color:#0a7556; font-size:0.92rem; font-weight:700; margin-top:2px;">👑 ${mvps} MVP${mvps>1?'s':''}</div>`;
        } else if (mvpsE > 0) {
            mvpsBadge = `<div style="color:#8c6f39; font-size:0.92rem; font-weight:700; margin-top:2px;">👨‍🏫 ${mvpsE} MVP entrenador${mvpsE>1?'es':''}</div>`;
        }

        html += `
            <div onclick="abrirFichaJugador('${jug.id || jug.nombre}')" 
                 class="ranking-row ${esTop3 ? 'ranking-top3' : 'ranking-normal'}"
                 style="cursor:pointer; display:flex; flex-wrap:wrap; align-items:center;
                        justify-content:space-between; gap:16px;
                        background:${esTop3 ? '#f8f1e3' : '#f8f9fa'}; 
                        padding:18px 20px; border-radius:18px; 
                        border-left:7px solid ${esTop3 ? '#C5A059' : '#e0d9c0'};
                        box-shadow:0 3px 12px rgba(0,0,0,0.06); transition:transform 0.25s, box-shadow 0.25s;">
                
                <div style="display:flex; align-items:center; gap:16px; flex:1; min-width:0;">
                    <div style="font-size:2.1rem; min-width:50px; text-align:center;">${medalla}</div>
                    <div style="min-width:0; flex:1;">
                        <div style="font-weight:700; font-size:1.15rem; color:#1f2937; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(jug.nombre)}
                        </div>
                        ${mvpsBadge}
                    </div>
                </div>

                <div style="text-align:right; flex-shrink:0;">
                    <div style="font-size:1.9rem; font-weight:900; color:#6e5526;">
                        ${jug.puntosTotales || 0}
                    </div>
                    <div style="font-size:0.82rem; color:#4a5568; font-weight:600;">puntos</div>
                </div>
            </div>`;
    });

    html += `</div>`;
    contenedor.innerHTML = html;
}

function abrirFichaJugador(idBuscado) {
    console.log("🔍 abrirFichaJugador llamado con:", idBuscado);

    const idStr = String(idBuscado).trim();
    const jugador = db.jugadores.find(j => 
        String(j.id || '') === idStr || 
        (j.nombre && j.nombre.toLowerCase().includes(idStr.toLowerCase()))
    );

    if (!jugador) {
        alert("Jugador no encontrado");
        return;
    }

    let modal = document.getElementById('ficha-modal-platinum');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ficha-modal-platinum';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.88); z-index: 99999; 
            display: flex; align-items: center; justify-content: center;
            overflow-y: auto; padding: 12px; box-sizing: border-box;
        `;
        document.body.appendChild(modal);
    }

    const stats = jugador.stats || {};
    const puntos = jugador.puntosTotales || 0;
    const mvps = stats.mvps || 0;
    const mvpsE = stats.mvpsEntrenador || 0;
    const victorias = stats.ganados || 0;
    const derrotas = stats.perdidos || 0;
    const partidos = stats.totales || (victorias + derrotas);
    const aces = stats.aces || 0;
    const winners = stats.winners || 0;
    const smashes = stats.smashes || 0;
    const nivel = jugador.nivel || "5.0";
    const rachaV = jugador.rachaVictorias || 0;
    const rachaD = jugador.rachaDerrotas || 0;

    const winRate = partidos > 0 ? Math.round((victorias / partidos) * 100) : 0;
    const rachaTexto = rachaV > 0 ? `🔥 ${rachaV} victorias` : 
                       (rachaD > 0 ? `❄️ ${rachaD} derrotas` : "Sin racha");

    const historialReciente = (db.historicoJornadas || [])
        .flatMap(j => (j.partidos || []))
        .filter(p => p.ids && p.ids.some(id => String(id) === String(jugador.id)))
        .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
        .slice(0, 5);

    modal.innerHTML = `
        <div style="background: white; max-width: 760px; width: 100%; border-radius: 24px; 
                    overflow: hidden; box-shadow: 0 25px 80px rgba(0,0,0,0.45); 
                    max-height: 96vh; display: flex; flex-direction: column;">

            <!-- CABECERA -->
            <div style="background: linear-gradient(135deg, #C5A059, #e8c670); color: white; 
                        padding: 42px 20px; text-align: center;">
                <div style="font-size: 4.8rem; margin-bottom: 8px;">👤</div>
                <h1 style="margin:0; font-size: 2.25rem; font-weight: 900; letter-spacing: 0.5px;">${jugador.nombre}</h1>
                <div style="margin-top: 10px; font-size: 1.1rem; opacity: 0.95;">Nivel ${nivel}</div>
            </div>

            <div style="flex: 1; overflow-y: auto; padding: 25px 20px; background: #fafafa;">

                <!-- TARJETAS PRINCIPALES - RESPONSIVE -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 12px; margin-bottom: 35px;">
                    <div style="background: white; padding: 18px 12px; border-radius: 16px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
                        <div style="font-size: 2.7rem; font-weight: 900; color: #6e5526;">${puntos}</div>
                        <div style="color: #2d3e50; font-size: 0.88rem; font-weight: 700; margin-top: 4px; line-height: 1.2;">Puntos Totales</div>
                    </div>
                    <div style="background: white; padding: 18px 12px; border-radius: 16px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
                        <div style="font-size: 2.7rem; font-weight: 900; color: #0a7556;">${mvps}</div>
                        <div style="color: #2d3e50; font-size: 0.88rem; font-weight: 700; margin-top: 4px; line-height: 1.2;">MVPs 👑</div>
                    </div>
                    ${mvpsE > 0 ? `
                    <div style="background: white; padding: 18px 12px; border-radius: 16px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
                        <div style="font-size: 2.7rem; font-weight: 900; color: #8c6f39;">${mvpsE}</div>
                        <div style="color: #2d3e50; font-size: 0.88rem; font-weight: 700; margin-top: 4px; line-height: 1.2;">MVP Entrenador 👨‍🏫</div>
                    </div>
                    ` : ''}
                    <div style="background: white; padding: 18px 12px; border-radius: 16px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
                        <div style="font-size: 2.7rem; font-weight: 900; color: #3b82f6;">${winRate}%</div>
                        <div style="color: #555; font-size: 0.88rem; font-weight: 600; margin-top: 4px; line-height: 1.2;">Win Rate</div>
                    </div>
                    <div style="background: white; padding: 18px 12px; border-radius: 16px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
                        <div style="font-size: 2.1rem; font-weight: 900; color: #f59e0b; line-height: 1.2;">${rachaTexto}</div>
                    </div>
                </div>

                <!-- RENDIMIENTO GENERAL -->
                <div style="margin-bottom: 35px;">
                    <h3 style="text-align:center; color:#333; margin-bottom:12px; font-size:1.25rem;">Rendimiento General</h3>
                    <div style="height: 34px; background:#e2e8f0; border-radius:9999px; overflow:hidden; display:flex; font-size:0.95rem;">
                        <div style="width:${winRate}%; background:linear-gradient(90deg,#10ac84,#34d399); 
                                    display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:0.9rem;">
                            ${victorias} Victorias
                        </div>
                        <div style="flex:1; background:#ef4444; display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:0.9rem;">
                            ${derrotas} Derrotas
                        </div>
                    </div>
                    <div style="text-align:center; margin-top:8px; color:#666; font-size:0.9rem;">
                        ${partidos} partidos jugados
                    </div>
                </div>

                <!-- GOLPES DESTACADOS -->
                <div style="margin-bottom: 40px;">
                    <h3 style="text-align:center; color:#333; margin-bottom:16px; font-size:1.25rem;">Golpes Destacados</h3>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(165px,1fr)); gap:14px;">
                        <div style="background:white; padding:18px; border-radius:16px; box-shadow:0 3px 12px rgba(0,0,0,0.05);">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95rem;">
                                <span style="color:#1a1a2e;">⚡ Aces</span>
                                <span style="font-weight:900; color:#8c6f39;">${aces}</span>
                            </div>
                            <div style="height:10px; background:#f1f5f9; border-radius:9999px;">
                                <div style="width:${Math.min(100, aces*8)}%; height:100%; background:#C5A059; border-radius:9999px;"></div>
                            </div>
                        </div>
                        <div style="background:white; padding:18px; border-radius:16px; box-shadow:0 3px 12px rgba(0,0,0,0.05);">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95rem;">
                                <span style="color:#1a1a2e;">🔥 Winners</span>
                                <span style="font-weight:900; color:#0a7556;">${winners}</span>
                            </div>
                            <div style="height:10px; background:#f1f5f9; border-radius:9999px;">
                                <div style="width:${Math.min(100, winners*8)}%; height:100%; background:#10ac84; border-radius:9999px;"></div>
                            </div>
                        </div>
                        <div style="background:white; padding:18px; border-radius:16px; box-shadow:0 3px 12px rgba(0,0,0,0.05);">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95rem;">
                                <span style="color:#1a1a2e;">💥 Smashes</span>
                                <span style="font-weight:900; color:#1d4ed8;">${smashes}</span>
                            </div>
                            <div style="height:10px; background:#f1f5f9; border-radius:9999px;">
                                <div style="width:${Math.min(100, smashes*8)}%; height:100%; background:#3b82f6; border-radius:9999px;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- HISTORIAL RECIENTE -->
                <div>
                    <h3 style="text-align:center; color:#333; margin-bottom:16px; font-size:1.25rem;">Últimos Partidos</h3>
                    ${historialReciente.length > 0 ? `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${historialReciente.map(p => {
                                // BUG 5 FIX: antes asumia que juegosA>juegosB implica que el jugador
                                // gano, sin importar en que equipo estaba. Ahora usa tamanoEquipoA
                                // para determinar el equipo real del jugador antes de comparar.
                                const esGanador = (() => {
                                    if (!p.ids) return false;
                                    const idsStr = p.ids.map(String);
                                    const idx = idsStr.indexOf(String(jugador.id));
                                    if (idx === -1) return false;
                                    // Australiana: ganador por acumulados individuales
                                    if (p.tipo === "equipos3" && p.puntosAustraliana) {
                                        const pts = p.puntosAustraliana;
                                        const maxP = Math.max(0, ...Object.values(pts).map(Number));
                                        const numMax = Object.values(pts).filter(v => Number(v) === maxP).length;
                                        return Number(pts[String(jugador.id)] || 0) === maxP && maxP > 0 && numMax === 1;
                                    }
                                    // Gamificado: mayor puntaje gana
                                    if (p.tipo === "gamificado" && p.puntosGamificados) {
                                        const vals = Object.values(p.puntosGamificados);
                                        const maxG = Math.max(0, ...vals.map(Number));
                                        const numMaxG = vals.map(Number).filter(v => v === maxG).length;
                                        const misG = Number(p.puntosGamificados[String(jugador.id)] || 0);
                                        return misG === maxG && maxG > 0 && numMaxG === 1;
                                    }
                                    // Estandar: usar tamanoEquipoA para saber el equipo real
                                    const mitad = p.tamanoEquipoA != null
                                        ? Number(p.tamanoEquipoA)
                                        : Math.floor(idsStr.length / 2);
                                    const esEquipoA = idx < mitad;
                                    const jA = parseInt(p.juegosA || 0);
                                    const jB = parseInt(p.juegosB || 0);
                                    return esEquipoA ? jA > jB : jB > jA;
                                })();
                                return `
                                    <div style="background:white; padding:16px 20px; border-radius:16px; 
                                                border-left:6px solid ${esGanador ? '#10ac84' : '#ef4444'}; 
                                                box-shadow:0 3px 10px rgba(0,0,0,0.06); font-size:0.95rem;">
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <span style="font-weight:600;">${p.nombres || p.tipo || 'Partido'}</span>
                                            <span style="font-weight:700; color:${esGanador ? '#10ac84' : '#ef4444'}">
                                                ${p.marcador || '—'}
                                            </span>
                                        </div>
                                    </div>`;
                            }).join('')}
                        </div>
                    ` : `<p style="text-align:center; color:#888; font-style:italic; padding:20px;">No hay partidos recientes.</p>`}
                </div>
            </div>

            <!-- PIE -->
            <div style="padding:25px; background:white; border-top:1px solid #eee; text-align:center;">
                <button onclick="cerrarFichaModal()" 
                        style="background:#C5A059; color:white; border:none; padding:16px 50px; 
                               font-size:1.1rem; font-weight:700; border-radius:50px; cursor:pointer;">
                    ← Cerrar Ficha
                </button>
            </div>

            <!-- X -->
            <button onclick="cerrarFichaModal()" 
                    style="position:absolute; top:20px; right:25px; background:rgba(0,0,0,0.3); color:white; 
                           border:none; width:46px; height:46px; border-radius:50%; font-size:1.9rem; cursor:pointer;">
                ×
            </button>
        </div>
    `;
}

function cerrarFichaModal() {
    const modal = document.getElementById('ficha-modal-platinum');
    if (modal) modal.remove();
}

function cerrarFichaModal() {
    const modal = document.getElementById('ficha-modal-platinum');
    if (modal) modal.remove();
}

