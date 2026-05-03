/* ============================================================
   ATP PLATINUM — 04-ranking-especialistas-tv.js
   Ranking de especialistas (golpes), resultados de hoy, dashboard TV
   ── Refactor: extraído de script.js (líneas [(1191, 1711)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function renderRankingEspecialistas() {
    const cont = document.getElementById('ranking-especialistas');
    if (!cont) return;

    const jugadores = Array.isArray(db.jugadores)
        ? db.jugadores.filter(j => !j.esInvitado)
        : Object.values(db.jugadores || {}).filter(j => !j.esInvitado);

    if (!jugadores.length) { cont.innerHTML = ''; return; }

    const jornadaEnCurso = window.jornadaActiva && !window.jornadaCerrada;

    // ── 1. TOP 3 POR GOLPE ───────────────────────────────────────────────────
    // Para cada golpe: suma statsAcumuladas (histórico) + golpesGanadoresHoy (jornada en curso)
    const GOLPES = [
        { id: 'ace',     label: 'ACE',     emoji: '🚀', color: '#002855' },
        { id: 'winner',  label: 'WINNER',  emoji: '🔥', color: '#d9534f' },
        { id: 'smash',   label: 'SMASH',   emoji: '💥', color: '#333333' },
        { id: 'volea',   label: 'VOLEA',   emoji: '🧤', color: '#0056b3' },
        { id: 'dejada',  label: 'DEJADA',  emoji: '🧤', color: '#C5A059' },
        { id: 'passing', label: 'PASSING', emoji: '🎯', color: '#28a745' }
    ];

    // Mapeo golpe.id → clave en stats permanentes
    const STATS_KEY = { ace: 'aces', winner: 'winners', smash: 'smashes', volea: 'voleas', dejada: 'dejadas', passing: 'passings' };

    function totalGolpeJugador(j, golpeId) {
        const hist = (j.statsAcumuladas && j.statsAcumuladas[golpeId]) || (j.stats && j.stats[STATS_KEY[golpeId]]) || 0;
        const hoy  = jornadaEnCurso
            ? ((window.golpesGanadoresHoy || {})[String(j.id)]?.[golpeId] || 0)
            : 0;
        return Number(hist) + Number(hoy);
    }

    // Calcular top3 para cada golpe
    const top3PorGolpe = GOLPES.map(g => {
        const ranking = jugadores
            .map(j => ({ nombre: j.nombre, total: totalGolpeJugador(j, g.id) }))
            .filter(x => x.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 3);
        return { ...g, ranking };
    });

    // ── 2. ACUMULADO TOTAL POR JUGADOR ───────────────────────────────────────
    const acumulados = jugadores.map(j => {
        const total = GOLPES.reduce((sum, g) => sum + totalGolpeJugador(j, g.id), 0);
        const desglose = GOLPES.map(g => {
            const v = totalGolpeJugador(j, g.id);
            return v > 0 ? `${g.emoji}${v}` : null;
        }).filter(Boolean).join(' ');
        return { nombre: j.nombre, total, desglose };
    }).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

    // ── 3. HABILIDADES TÉCNICAS (top 1 por habilidad) ────────────────────────
    const HABILIDADES = [
        { id: 'Saque', label: 'SERVICIO', emoji: '🚀' },
        { id: 'Derecha', label: 'DERECHA', emoji: '🔥' },
        { id: 'Reves', label: 'REVÉS', emoji: '🔙' },
        { id: 'Volea', label: 'VOLEA', emoji: '🧤' },
        { id: 'Mental', label: 'MENTAL', emoji: '🧠' }
    ];
    const mejorPorHabilidad = HABILIDADES.map(h => {
        let mejor = null, maxVal = 0;
        jugadores.forEach(j => {
            const v = (j.habilidades && j.habilidades[h.id]) || 0;
            if (v > maxVal) { maxVal = v; mejor = j; }
        });
        return { ...h, mejor, valor: maxVal };
    });

    // ── 4. HITOS ESPECIALES (mvps, tríos) ───────────────────────────────────
    const HITOS = [
        { id: 'mvps', label: 'VITRINA MVP', emoji: '👑', color: '#C5A059' },
        { id: 'trios', label: 'REY TRÍOS', emoji: '🔱', color: '#1a2530' }
    ];
    const mejorPorHito = HITOS.map(h => {
        let mejor = null, maxVal = 0;
        jugadores.forEach(j => {
            const v = (j.stats && j.stats[h.id]) || 0;
            if (v > maxVal) { maxVal = v; mejor = j; }
        });
        return { ...h, mejor, valor: maxVal };
    }).filter(x => x.valor > 0);

    // ── 5. HTML ───────────────────────────────────────────────────────────────
    const medalEmoji = ['🥇', '🥈', '🥉'];
    const golpesConDatos = top3PorGolpe.filter(g => g.ranking.length > 0);
    let html = '';

    // ── Detección de tema para ajustar colores ────────────────────────────────
    const isDark = document.body.classList.contains('theme-platinum');
    const clr = {
        bg:        isDark ? 'var(--pt-surface2,#162232)'    : 'white',
        bgAlt:     isDark ? 'var(--pt-surface3,#1a2d42)'    : '#fafafa',
        bgCard:    isDark ? 'var(--pt-surface,#0f1923)'     : 'white',
        border:    isDark ? 'var(--pt-border-hi,#2a4060)'   : '#eee',
        borderSub: isDark ? 'var(--pt-border,#1e3048)'      : '#f0f0f0',
        text:      isDark ? 'var(--pt-text,#f0f4f8)'        : 'var(--atp-navy,#001e3c)',
        textSub:   isDark ? 'var(--pt-text-sub,#94a3b8)'    : '#444',
        textDim:   isDark ? 'var(--pt-text-dim,#64748b)'    : '#888',
        shadow:    isDark ? '0 2px 8px rgba(0,0,0,0.4)'     : '0 2px 8px rgba(0,0,0,0.08)',
        titleClr:  isDark ? 'var(--pt-text,#f0f4f8)'        : 'var(--atp-navy,#001e3c)',
    };

    // ── Sección A: Top 3 por golpe ────────────────────────────────────────────
    if (golpesConDatos.length > 0) {
        html += `
        <div style="margin-bottom:28px;">
            <h3 style="font-size:0.75rem; font-weight:900; color:${clr.titleClr};
                       letter-spacing:2px; text-transform:uppercase; margin:0 0 14px 0;
                       padding-bottom:8px; border-bottom:2px solid var(--atp-gold,#C5A059);">
                🏅 TOP 3 POR GOLPE
            </h3>
            <div style="display:grid;
                        grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
                        gap:12px;">`;

        golpesConDatos.forEach(g => {
            html += `
            <div style="background:${clr.bg}; border-radius:12px; overflow:hidden;
                        box-shadow:${clr.shadow}; border:1px solid ${clr.border};">
                <div style="background:${g.color}; padding:8px 14px; display:flex;
                            align-items:center; gap:8px;">
                    <span style="font-size:1rem;">${g.emoji}</span>
                    <span style="font-size:0.7rem; font-weight:900; color:white;
                                 letter-spacing:1.5px; text-transform:uppercase;">${g.label}</span>
                </div>
                <div style="padding:10px 14px;">
                    ${g.ranking.map((p, i) => `
                    <div style="display:flex; align-items:center; gap:10px;
                                padding:6px 0; ${i < g.ranking.length - 1 ? `border-bottom:1px solid ${clr.borderSub};` : ''}">
                        <span style="font-size:${i === 0 ? '1.2rem' : '1rem'}; min-width:26px;">${medalEmoji[i]}</span>
                        <span style="flex:1; font-weight:${i === 0 ? '900' : '700'};
                                     color:${i === 0 ? clr.text : clr.textSub};
                                     font-size:${i === 0 ? '0.9rem' : '0.82rem'};
                                     white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(p.nombre.split(' ')[0])}
                        </span>
                        <span style="font-weight:900; font-size:${i === 0 ? '1.1rem' : '0.9rem'};
                                     color:${g.color}; min-width:28px; text-align:right;">${p.total}</span>
                    </div>`).join('')}
                </div>
            </div>`;
        });

        html += `</div></div>`;
    }

    // ── Sección B: Acumulado de golpes por jugador ───────────────────────────
    if (acumulados.length > 0) {
        html += `
        <div style="margin-bottom:28px;">
            <h3 style="font-size:0.75rem; font-weight:900; color:${clr.titleClr};
                       letter-spacing:2px; text-transform:uppercase; margin:0 0 14px 0;
                       padding-bottom:8px; border-bottom:2px solid var(--atp-gold,#C5A059);">
                🎯 GOLPES ACUMULADOS
            </h3>
            <div style="background:${clr.bg}; border-radius:12px; overflow:hidden;
                        box-shadow:${clr.shadow}; border:1px solid ${clr.border};">`;

        acumulados.forEach((j, i) => {
            const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            html += `
            <div style="display:flex; align-items:center; gap:12px; padding:10px 16px;
                        background:${i % 2 === 0 ? clr.bgAlt : clr.bg};
                        ${i < acumulados.length - 1 ? `border-bottom:1px solid ${clr.borderSub};` : ''}">
                <span style="font-size:${i < 3 ? '1.1rem' : '0.85rem'}; min-width:26px; text-align:center;">${medalla}</span>
                <span style="flex:1; font-weight:${i < 3 ? '800' : '600'};
                             color:${clr.text}; font-size:0.88rem;
                             white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${escapeHtml(j.nombre)}
                </span>
                <span style="font-size:0.7rem; color:${clr.textDim}; flex:1.5;
                             white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${j.desglose}</span>
                <span style="font-weight:900; font-size:1rem; color:${isDark ? 'var(--pt-green,#ccff00)' : 'var(--atp-navy,#001e3c)'};
                             min-width:32px; text-align:right;">${j.total}</span>
            </div>`;
        });

        html += `</div></div>`;
    }

    // ── Sección C: Habilidades técnicas + Hitos ───────────────────────────────
    html += `
    <div style="margin-bottom:28px;">
        <h3 style="font-size:0.75rem; font-weight:900; color:${clr.titleClr};
                   letter-spacing:2px; text-transform:uppercase; margin:0 0 14px 0;
                   padding-bottom:8px; border-bottom:2px solid var(--atp-gold,#C5A059);">
            ⚡ LÍDERES TÉCNICOS
        </h3>
        <div style="display:grid;
                    grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
                    gap:10px;">`;

    mejorPorHabilidad.forEach(h => {
        const nombre = h.mejor ? escapeHtml(h.mejor.nombre.split(' ')[0].toUpperCase()) : '—';
        // ✅ FIX CONTRASTE: en classic el dorado claro #C5A059 sobre fondo blanco
        // tiene ratio 2.46 (WCAG fails). En classic usamos #6e5526 (dorado oscuro,
        // ratio 6.5). En dark mode el #C5A059 sí tiene buen contraste sobre #162232.
        const labelColor = isDark ? 'var(--atp-gold,#C5A059)' : '#6e5526';
        html += `
        <div style="background:${clr.bg}; border-radius:12px;
                    border-top:4px solid var(--atp-gold,#C5A059);
                    padding:14px 12px; text-align:center; box-shadow:${clr.shadow};
                    border:1px solid ${clr.border}; border-top:4px solid var(--atp-gold,#C5A059);
                    position:relative; overflow:hidden;">
            <div style="font-size:0.7rem; font-weight:900; color:${labelColor};
                         letter-spacing:1.5px; margin-bottom:8px;">${h.emoji} ${h.label}</div>
            <div style="font-size:0.85rem; font-weight:900; color:${clr.text};
                         margin-bottom:6px;">${nombre}</div>
            <div style="font-size:1.4rem; font-weight:900; color:${clr.text};">${h.valor.toFixed(1)}</div>
            <div style="position:absolute; right:-8px; bottom:-8px; font-size:3rem;
                         opacity:0.06; pointer-events:none;">${h.emoji}</div>
        </div>`;
    });

    mejorPorHito.forEach(h => {
        const nombre = h.mejor ? escapeHtml(h.mejor.nombre.split(' ')[0].toUpperCase()) : '—';
        const hitoColor = isDark && h.color === '#1a2530' ? 'var(--pt-blue,#4895ef)' : h.color;
        // ✅ FIX CONTRASTE: oscurecer también el color de hitos en classic mode
        // para que 👑 VITRINA MVP no quede ilegible sobre fondo blanco.
        const hitoLabelColor = !isDark && hitoColor === '#C5A059' ? '#6e5526' : hitoColor;
        html += `
        <div style="background:${clr.bg}; border-radius:12px;
                    border-top:4px solid ${hitoColor};
                    padding:14px 12px; text-align:center; box-shadow:${clr.shadow};
                    border:1px solid ${clr.border}; border-top:4px solid ${hitoColor};
                    position:relative; overflow:hidden;">
            <div style="font-size:0.7rem; font-weight:900; color:${hitoLabelColor};
                         letter-spacing:1.5px; margin-bottom:8px;">${h.emoji} ${h.label}</div>
            <div style="font-size:0.85rem; font-weight:900; color:${clr.text};
                         margin-bottom:6px;">${nombre}</div>
            <div style="font-size:1.4rem; font-weight:900; color:${clr.text};">${h.valor}</div>
            <div style="position:absolute; right:-8px; bottom:-8px; font-size:3rem;
                         opacity:0.06; pointer-events:none;">${h.emoji}</div>
        </div>`;
    });

    html += `</div></div>`;

    cont.innerHTML = html;
}

// Mantenemos tu función auxiliar intacta para no perder estilo
function generarCardEspecialista(h, mejor, valor, esHito = false) {
    const nombreStr = mejor ? mejor.nombre.toUpperCase() : '---';
    const valorNum  = esHito ? Math.floor(valor) : valor.toFixed(1);
    const borderCol = esHito ? 'var(--atp-blue, #0056b3)' : 'var(--atp-gold, #C5A059)';

    // Pequeño ajuste: Si el hito es Tríos, usamos el azul profundo de la marca
    const finalCol = h.id === 'trios' ? '#1a2530' : borderCol;

    return `
        <div class="card" style="margin-bottom:0; text-align:center; border-top: 4px solid ${finalCol}; background: white; padding: 18px; position: relative; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 12px;">
            <div style="font-size:0.65rem; font-weight:900; color: ${finalCol}; letter-spacing: 1.5px; margin-bottom: 10px; text-transform: uppercase;">
                ${h.i} ${h.n}
            </div>
            
            <div class="rango-platinum" style="font-size:0.95rem; font-weight:900; margin:8px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #1a2530;">
                ${nombreStr}
            </div>
            
            <div style="color: #1a2530; font-weight:900; font-size:1.5rem; margin-top: 5px;">
                ${valorNum}
            </div>

            <div style="position: absolute; right: -12px; bottom: -12px; opacity: 0.07; font-size: 3.5rem; transform: rotate(-15deg); pointer-events: none;">
                ${h.i}
            </div>
        </div>`;
}
// --- GESTIÓN DE ASISTENCIA ---

function renderResultadosHoy() {
    const contenedor = document.getElementById('lista-resultados-hoy');
    if (!contenedor) return;

    if (!window.partidosFinalizadosHoy || window.partidosFinalizadosHoy.length === 0) {
        contenedor.innerHTML = '<p style="opacity:0.5; text-align:center; padding: 20px;">No hay partidos finalizados aún.</p>';
        return;
    }

    const obtenerNombresSeguros = (p) => {
        if (p.nombres && !p.nombres.includes('undefined')) return p.nombres;
        const { eqA, eqB } = resolverNombresEquipos(p);
        return eqB ? `${eqA} vs ${eqB}` : eqA;
    };

    contenedor.innerHTML = [...window.partidosFinalizadosHoy].reverse().map(p => {
        const nombresLimpios = obtenerNombresSeguros(p);

        const modo         = resolverModoPartido(p);
        const esGamificado = modo.esGamificado;
        const esTrio       = modo.esTrio;
        const esAsimetrico = modo.esAsimetrico;
        const esVenganza = p.esVenganza || nombresLimpios.includes("🔥");

        const colorBorde = esVenganza   ? 'var(--atp-gold)'
                         : esGamificado ? '#00d4ff'
                         : esAsimetrico ? '#ff6b35'
                         : esTrio       ? '#C5A059'
                         : p.tipo === 'equipos3' ? '#a78bfa'
                         : '#334155';

        return `
            <div class="card-resultado" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px; border-left: 5px solid ${colorBorde};">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; font-size: ${(esTrio || esAsimetrico || p.tipo === 'equipos3') ? '0.85rem' : '1rem'}; color: white; line-height: 1.2; flex: 1;">
                        ${nombresLimpios}
                    </span>
                    <span style="background: var(--atp-gold); color: black; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-weight: 900; font-size: 1.1rem; min-width: 60px; text-align: center; box-shadow: 0 0 10px rgba(197, 160, 89, 0.2);">
                        ${p.marcador || p.resultadoFinal || '0-0'}
                    </span>
                </div>
                <div style="font-size: 0.75rem; opacity: 0.5; margin-top: 8px; display: flex; justify-content: space-between; text-transform: uppercase; letter-spacing: 0.5px;">
                    <span>📍 Pista ${p.pista} • ${esGamificado ? '🎮 GAMIFICADO' : esTrio ? '🔱 TRÍOS' : esAsimetrico ? '⚡ ASIMÉTRICO' : p.tipo === 'equipos3' ? '🔄 AUSTRALIANA' : (p.tipo || 'PARTIDO').toUpperCase()}</span>
                    <span>🕒 ${p.fin || p.horaFin || ''}</span>
                </div>
            </div>
        `;
    }).join('');
}

function abrirDashboardTV() {
    const tvWindow = window.open("", "ATPTV", "width=1300,height=900,menubar=no,toolbar=no,location=no,status=no");
    if (!tvWindow) return alert("❌ Por favor, permite las ventanas emergentes para abrir la pantalla gigante.");

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>ATP MASTER LIVE TV | PLATINUM v.2026</title>
            <style>
                * { box-sizing: border-box; }
                :root { --atp-navy: #001e3c; --atp-gold: #C5A059; --atp-tennis: #ccff00; --atp-platinum: #00d4ff; }
                body { background: #000c18; color: white; margin: 0; padding: 10px; font-family: 'Segoe UI', sans-serif; height: 100vh; overflow: hidden; }
                .header-tv { display: flex; justify-content: space-between; align-items: center; height: 60px; border-bottom: 1px solid rgba(197,160,89,0.3); margin-bottom: 10px; }
                #tv-timer { font-size: 2.8rem; background: #000; padding: 5px 25px; border-radius: 12px; color: var(--atp-tennis); border: 2px solid #333; font-family: monospace; }
                .layout { display: grid; grid-template-columns: 42% 58%; gap: 15px; height: calc(100vh - 90px); }
                .main-pistas { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
                
                /* Cards de Pista con estados dinámicos */
                .match-card { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 15px; text-align: center; border-left: 8px solid var(--atp-tennis); position: relative; transition: all 0.5s ease; }
                .gamified-card { border-left-color: var(--atp-platinum); background: rgba(0,212,255,0.05); }
                .venganza-card { border-left-color: var(--atp-gold); background: rgba(197,160,89,0.15); box-shadow: inset 0 0 20px rgba(197,160,89,0.2); }
                .trio-card { border-left-color: #ffffff; }
                .asimetrico-card { border-left-color: #ff6b35; background: rgba(255,107,53,0.05); }
                .australiana-card { border-left-color: #a78bfa; background: rgba(167,139,250,0.05); }

                .score { font-size: 3.2rem; font-weight: 900; color: var(--atp-tennis); font-family: monospace; line-height: 1; margin: 5px 0; }
                .player-names { font-size: 1.1rem; font-weight: bold; text-transform: uppercase; line-height: 1.2; }
                .trio-names { font-size: 0.9rem !important; } /* Ajuste para que quepan 6 nombres */

                .sidebar-container { display: flex; flex-direction: column; gap: 15px; height: 100%; overflow: hidden; }
                .panel { background: rgba(255,255,255,0.02); border-radius: 20px; padding: 15px; border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; }
                
                #tv-ranking-list { overflow-y: hidden; height: 100%; display: flex; flex-direction: column; gap: 6px; }
                .rank-item-new { display: flex; justify-content: space-between; align-items: center; padding: 8px 15px; border-radius: 10px; background: rgba(255,255,255,0.04); }
                .mvp-highlight { border: 1px solid var(--atp-tennis); background: rgba(204,255,0,0.08); }
                .rank-points-box { background: #000; padding: 4px 12px; border-radius: 8px; border: 1px solid var(--atp-gold); min-width: 80px; text-align: center; }
                .rank-points-val { font-size: 1.3rem; font-weight: 900; color: var(--atp-tennis); font-family: monospace; }
                
                .esp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .esp-item { background: rgba(0,0,0,0.4); padding: 10px; border-radius: 12px; border-bottom: 3px solid var(--atp-gold); text-align: center; }
                .marquesina-venganza { position: absolute; bottom: 0; left: 0; width: 100%; background: var(--atp-gold); color: black; font-weight: 900; font-size: 0.7rem; padding: 2px 0; border-radius: 0 0 15px 15px; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class="header-tv">
                <h1 id="tv-main-title" style="margin:0; font-size: 1.8rem; color:var(--atp-gold);">📡 ATP MASTER LIVE</h1>
                <div id="tv-timer">15:00</div>
            </div>
            <div class="layout">
                <div id="tv-pistas" class="main-pistas"></div>
                <div class="sidebar-container">
                    <div class="panel" style="flex: 2.5; overflow: hidden;">
                        <h2 style="color:var(--atp-gold); text-align:center; font-size:1rem; margin:0 0 12px 0;">🏆 World Ranking</h2>
                        <div id="tv-ranking-list"></div>
                    </div>
                    <div class="panel" style="flex: 1;">
                        <h2 style="color:var(--atp-tennis); text-align:center; font-size:1rem; margin:0 0 12px 0;">🎯 Skills Leaders</h2>
                        <div id="tv-especialistas-list" class="esp-grid"></div>
                    </div>
                </div>
            </div>
            <script>
                var channel = new BroadcastChannel('atp_tv_sync');
                var scrollPos = 0;

                function render(data) {
                    if (!data) return;
                    
                    // 1. Reloj sincronizado
                    if (data.time) document.getElementById('tv-timer').innerText = data.time;

                    if (data.action === 'UPDATE_DATA') {
                        // 2. Título dinámico con MVP
                        var titulo = "📡 ATP MASTER ";
                        if (data.mvp) titulo += "<span style='color:var(--atp-tennis); margin-left:20px;'>🏆 MVP: " + data.mvp + "</span>";
                        document.getElementById('tv-main-title').innerHTML = titulo;

                        // 3. Renderizado de Pistas (Individual, Dobles, Tríos, Venganza)
                        if (data.partidos) {
                            var htmlPistas = "";
                            data.partidos.forEach(function(p) {
                                var marcadorJuegos = p.marcador || "0-0";
                                var esTrio = p.esTrio || false;
                                var esAsimetrico = p.esAsimetrico || false;
                                var esVenganza = p.esVenganza || false;
                                
                                var claseExtra = p.gamified ? 'gamified-card' : '';
                                if (esVenganza)       claseExtra += ' venganza-card';
                                if (esTrio)           claseExtra += ' trio-card';
                                if (esAsimetrico)     claseExtra += ' asimetrico-card';
                                if (p.esAustraliana)  claseExtra += ' australiana-card';

                                var htmlPuntos = "";
                                if (p.gamified) {
                                    // ✅ Usar p.marcador que ya viene formateado desde sincronizarTV
                                    // (ej: "🎮 7-4-2"). Las claves de puntosGamificados son IDs, no "A"/"B"
                                    var marcGam = p.marcador || '🎮';
                                    htmlPuntos = '<div style="font-size:1rem; color:var(--atp-platinum); margin-top:5px; font-family:monospace;">' + marcGam + '</div>';
                                }

                                var bannerVenganza = esVenganza ? '<div class="marquesina-venganza">🔥 PARTIDO DE VENGANZA 🔥</div>' : '';
                                var iconoModo = p.iconoModo || (esTrio ? '🔱 ' : (esAsimetrico ? '⚡ ' : ''));
                                var etiqueta  = p.etiquetaModo || (esTrio ? 'TRÍOS' : (esAsimetrico ? 'ASIMÉTRICO' : ''));

                                // ✅ Australiana: score compacto + acumulados en lugar del score gigante
                                var scoreHTML = '';
                                if (p.esAustraliana) {
                                    scoreHTML = '<div style="font-size:1.1rem; font-weight:900; color:var(--atp-tennis); font-family:monospace; line-height:1.3; margin:5px 0;">' +
                                                    '<div style="font-size:0.7rem; color:var(--atp-gold); margin-bottom:4px;">Ronda: ' + (p.marcadorRonda || '0-0') + '</div>' +
                                                    '<div style="font-size:1rem; letter-spacing:1px;">' + (p.marcador || '') + '</div>' +
                                                '</div>';
                                } else {
                                    scoreHTML = '<div class="score">' + marcadorJuegos + '</div>';
                                }

                                htmlPistas += '<div class="match-card ' + claseExtra + '">' +
                                              '<div style="color:var(--atp-gold); font-size: 0.7rem; font-weight:bold;">' + iconoModo + 'PISTA ' + p.pista + (etiqueta ? ' · ' + etiqueta : '') + '</div>' +
                                              '<div class="player-names ' + ((esTrio || esAsimetrico) ? 'trio-names' : '') + '">' + p.nombres + '</div>' +
                                              scoreHTML + 
                                              htmlPuntos + 
                                              bannerVenganza +
                                              '</div>';
                            });
                            document.getElementById('tv-pistas').innerHTML = htmlPistas;
                        }

                        // 4. Ranking con Auto-Scroll
                        if (data.ranking) {
                            var htmlRank = "";
                            // ✅ FIX BUG MEDIO 2: data.mvp es un string "Nombre1, Nombre2".
                            // Comparar con === fallaba si había varios MVPs o espacios distintos.
                            // Usamos un array y .includes() para que funcione con multi-MVP.
                            var mvpNombresArr = data.mvp ? data.mvp.split(', ') : [];
                            data.ranking.forEach(function(j, i) {
                                var esMVP = mvpNombresArr.includes(j.nombre);
                                var deco = (i === 0) ? "🥇" : (i === 1) ? "🥈" : (i === 2) ? "🥉" : (i + 1) + ".";
                                htmlRank += '<div class="rank-item-new ' + (esMVP ? 'mvp-highlight' : '') + '">' +
                                            '<div style="display: flex; align-items: center; gap: 10px;">' +
                                            '<span style="font-size: 1.4rem;">' + deco + '</span>' +
                                            '<span style="font-weight: bold;">' + j.nombre + (esMVP ? ' 👑' : '') + '</span></div>' +
                                            '<div class="rank-points-box"><span class="rank-points-val">' + (j.puntosTotales || 0) + '</span></div></div>';
                            });
                            document.getElementById('tv-ranking-list').innerHTML = htmlRank;
                        }

                        // 5. Especialistas
                        if (data.especialistas) {
                            var htmlEsp = "";
                            data.especialistas.forEach(function(e) {
                                htmlEsp += '<div class="esp-item">' +
                                           '<div style="font-size:0.55rem; color:var(--atp-gold); font-weight:800; text-transform:uppercase;">' + e.label + '</div>' +
                                           '<div style="font-weight:bold; font-size:0.85rem; margin:2px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + (e.nombre || '---') + '</div>' +
                                           '<div style="color:var(--atp-tennis); font-size:1.3rem; font-weight:900;">' + e.valor + '</div>' +
                                           '</div>';
                            });
                            document.getElementById('tv-especialistas-list').innerHTML = htmlEsp;
                        }
                    }
                }

                channel.onmessage = function(e) { render(e.data); };

                // ✅ FIX BUG ALTO 4: BroadcastChannel no funciona en Safari iOS <15.4
                // ni entre pestañas de distinto origen. Añadimos polling de localStorage
                // como fallback: si hay datos nuevos (ts mayor al último renderizado),
                // se renderizan aunque el canal esté silencioso.
                var lastRenderTs = 0;
                setInterval(function() {
                    try {
                        var raw = localStorage.getItem('tv_data_sync');
                        if (!raw) return;
                        var parsed = JSON.parse(raw);
                        if (parsed && parsed.ts && parsed.ts > lastRenderTs) {
                            lastRenderTs = parsed.ts;
                            render(parsed.datos);
                        }
                    } catch(e) {}
                }, 3000);

                setInterval(function() {
                    var list = document.getElementById('tv-ranking-list');
                    if (list.scrollHeight > list.clientHeight) {
                        scrollPos += 0.5;
                        if (scrollPos >= (list.scrollHeight - list.clientHeight)) scrollPos = -20;
                        list.scrollTop = Math.max(0, scrollPos);
                    }
                }, 50);

                channel.postMessage({ action: 'REQUEST_DATA' });
            <\/script>
        </body>
        </html>
    `;

    tvWindow.document.write(htmlContent);
    tvWindow.document.close();
    
    setTimeout(function() {
        if (typeof sincronizarTV === 'function') sincronizarTV();
    }, 1500);
}

