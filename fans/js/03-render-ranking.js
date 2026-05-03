/* ============================================================
   ATP PLATINUM — fans/03-render-ranking.js
   Render del ranking
   ── Refactor: extraído de fans.js (líneas 335-500)
   ============================================================ */

function renderRankingFans() {
    const contenedor = document.getElementById('fans-ranking-container');
    if (!contenedor) return;

    const jugadores = (Array.isArray(db.jugadores)
        ? db.jugadores
        : Object.values(db.jugadores || {})).filter(j => !j.esInvitado);

    if (!jugadores.length) return;

    const ranking = [...jugadores].sort((a, b) => (b.puntosTotales || 0) - (a.puntosTotales || 0));
    const hayPuntos = ranking.some(j => (j.puntosTotales || 0) > 0);

    const mvpIdsHoyFans = [...new Set([
        ...(Array.isArray(db.mvpIdsHoy)         ? db.mvpIdsHoy         : (db.mvpIdHoy ? [db.mvpIdHoy] : [])),
        ...(Array.isArray(db.mvpIdsJugadores)    ? db.mvpIdsJugadores   : []),
        ...(Array.isArray(db.mvpIdsEntrenadores) ? db.mvpIdsEntrenadores: [])
    ].map(String))];

    // ── Helpers golpes ────────────────────────────────────────────────────────
    const GOLPES_FANS = [
        { id: 'ace',     label: 'ACE',     emoji: '🚀', color: '#00aaff' },
        { id: 'winner',  label: 'WINNER',  emoji: '🔥', color: '#ff4d6d' },
        { id: 'smash',   label: 'SMASH',   emoji: '💥', color: '#aaa'    },
        { id: 'volea',   label: 'VOLEA',   emoji: '🧤', color: '#4895ef' },
        { id: 'dejada',  label: 'DEJADA',  emoji: '🎭', color: '#C5A059' },
        { id: 'passing', label: 'PASSING', emoji: '🎯', color: '#4cc9f0' }
    ];
    const STATS_KEY_F = { ace:'aces', winner:'winners', smash:'smashes', volea:'voleas', dejada:'dejadas', passing:'passings' };

    function totalGolpeFans(j, golpeId) {
        // FANS-C FIX: sumar golpesGanadoresHoy durante jornada activa.
        // El admin ve los especialistas en tiempo real; los fans veían el histórico congelado.
        const hist = (j.statsAcumuladas && j.statsAcumuladas[golpeId]) || (j.stats && j.stats[STATS_KEY_F[golpeId]]) || 0;
        const hoy = (db.golpesGanadoresHoy && db.golpesGanadoresHoy[String(j.id)]
            ? (db.golpesGanadoresHoy[String(j.id)][golpeId] || 0)
            : 0);
        return Number(hist) + Number(hoy);
    }

    // Top 3 por golpe
    const top3 = GOLPES_FANS.map(g => {
        const pod = jugadores
            .map(j => ({ nombre: j.nombre, total: totalGolpeFans(j, g.id) }))
            .filter(x => x.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 3);
        return { ...g, pod };
    }).filter(g => g.pod.length > 0);

    // Acumulado total
    const acumulados = jugadores.map(j => {
        const total = GOLPES_FANS.reduce((s, g) => s + totalGolpeFans(j, g.id), 0);
        return { nombre: j.nombre, total };
    }).filter(x => x.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);

    const medal = ['🥇','🥈','🥉'];

    let html = '';

    // ── RANKING PUNTOS ────────────────────────────────────────────────────────
    if (hayPuntos) {
        html += `<div style="margin-bottom:20px;">
            <div style="font-size:0.65rem; font-weight:900; color:#C5A059; letter-spacing:2px;
                        text-transform:uppercase; margin-bottom:10px; padding-bottom:6px;
                        border-bottom:1px solid rgba(197,160,89,0.3);">🏆 CLASIFICACIÓN</div>`;

        ranking.slice(0, 10).forEach((j, i) => {
            const med = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`;
            const esMVP = mvpIdsHoyFans.includes(String(j.id));
            html += `
            <div style="display:flex; align-items:center; gap:10px; padding:9px 10px;
                        border-radius:8px; margin-bottom:4px;
                        background:${i < 3 ? 'rgba(197,160,89,0.07)' : 'transparent'};
                        ${esMVP ? 'border-left:3px solid #C5A059;' : ''}">
                <span style="font-size:${i<3?'1.1rem':'0.85rem'}; min-width:24px; text-align:center;">${med}</span>
                <span style="flex:1; font-weight:${i<3?'900':'700'}; color:${i<3?'white':'#ccc'};
                             font-size:${i<3?'0.9rem':'0.82rem'};
                             white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${escapeHtml(j.nombre)}${esMVP ? ' 👑' : ''}
                </span>
                <span style="font-weight:900; color:#C5A059; font-size:${i<3?'1rem':'0.88rem'};">
                    ${j.puntosTotales} pts
                </span>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<p style="text-align:center; color:#666; padding:16px; font-style:italic; font-size:0.85rem;">
            La clasificación se activará al finalizar el primer partido.</p>`;
    }

    // ── TOP 3 POR GOLPE ───────────────────────────────────────────────────────
    if (top3.length > 0) {
        html += `
        <div style="margin-bottom:20px;">
            <div style="font-size:0.65rem; font-weight:900; color:#C5A059; letter-spacing:2px;
                        text-transform:uppercase; margin-bottom:10px; padding-bottom:6px;
                        border-bottom:1px solid rgba(197,160,89,0.3);">🏅 ESPECIALISTAS</div>
            <div style="display:grid;
                        grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
                        gap:10px;">`;

        top3.forEach(g => {
            html += `
            <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
                        border-top:3px solid ${g.color}; border-radius:10px; overflow:hidden;">
                <div style="padding:7px 12px; display:flex; align-items:center; gap:7px;
                            background:rgba(0,0,0,0.2);">
                    <span>${g.emoji}</span>
                    <span style="font-size:0.65rem; font-weight:900; color:white;
                                 letter-spacing:1px; text-transform:uppercase;">${g.label}</span>
                </div>
                <div style="padding:8px 12px;">
                    ${g.pod.map((p, i) => `
                    <div style="display:flex; align-items:center; gap:8px; padding:4px 0;
                                ${i < g.pod.length-1 ? 'border-bottom:1px solid rgba(255,255,255,0.05);' : ''}">
                        <span style="font-size:${i===0?'1rem':'0.85rem'}; min-width:20px;">${medal[i]}</span>
                        <span style="flex:1; font-size:${i===0?'0.82rem':'0.75rem'};
                                     font-weight:${i===0?'900':'600'};
                                     color:${i===0?'white':'#aaa'};
                                     white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(p.nombre.split(' ')[0])}
                        </span>
                        <span style="font-weight:900; font-size:${i===0?'0.95rem':'0.8rem'};
                                     color:${g.color};">${p.total}</span>
                    </div>`).join('')}
                </div>
            </div>`;
        });

        html += `</div></div>`;
    }

    // ── ACUMULADO GOLPES ──────────────────────────────────────────────────────
    if (acumulados.length > 0) {
        html += `
        <div>
            <div style="font-size:0.65rem; font-weight:900; color:#C5A059; letter-spacing:2px;
                        text-transform:uppercase; margin-bottom:10px; padding-bottom:6px;
                        border-bottom:1px solid rgba(197,160,89,0.3);">🎯 GOLPES TOTALES</div>`;

        acumulados.forEach((j, i) => {
            const med = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`;
            html += `
            <div style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                        border-radius:8px; margin-bottom:3px;
                        background:${i%2===0?'rgba(255,255,255,0.03)':'transparent'};">
                <span style="font-size:${i<3?'1rem':'0.82rem'}; min-width:22px; text-align:center;">${med}</span>
                <span style="flex:1; font-weight:${i<3?'800':'600'}; color:${i<3?'white':'#bbb'};
                             font-size:${i<3?'0.88rem':'0.8rem'};
                             white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${escapeHtml(j.nombre)}
                </span>
                <span style="font-weight:900; font-size:${i<3?'1rem':'0.88rem'};
                             color:#ccff00;">${j.total}</span>
            </div>`;
        });

        html += `</div>`;
    }

    contenedor.innerHTML = html || '<p style="text-align:center;color:#666;padding:20px;">Sin datos disponibles.</p>';
}

// 5. TICKER
