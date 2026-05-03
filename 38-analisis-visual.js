/* ============================================================
   ATP PLATINUM — 38-analisis-visual.js
   Visualizaciones avanzadas para entrenadores:
   1. Radar pentagonal de habilidades (por jugador)
   2. Sparkline de evolución temporal
   3. Termómetro de forma (últimas 5 jornadas)
   4. Sugerencias automáticas (3 puntos a trabajar)
   5. Combinaciones equilibradas (dobles + tríos)
   ============================================================ */

// ── HELPERS ──────────────────────────────────────────────────

/**
 * Calcular nivel medio de un jugador a partir de sus 5 habilidades.
 * Si no tiene habilidades, devuelve 5.0 (base).
 */
function _avNivelJugador(j) {
    const h = j.habilidades || {};
    const vals = [h.Saque || 5, h.Derecha || 5, h.Reves || 5, h.Volea || 5, h.Mental || 5];
    return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Determina los IDs ganadores de un partido archivado mirando los datos
 * que SÍ se guardan en historicoJornadas.partidos[]:
 *   - Estándar (1v1, 2v2, asimétrico, tríos): juegosA vs juegosB
 *   - Australiana: puntosAustraliana[id] (gana el o los del max)
 *   - Gamificado: puntosGamificados[id] (gana el o los del max)
 *
 * Devuelve { ganadores:Set<string>, jugadores:Set<string>, empate:boolean, sinDatos:boolean }
 * - empate=true si hay marcador empatado (cuenta como "no derrota").
 * - sinDatos=true si el partido se archivó sin marcador (no debe contarse).
 */
function _avResolverGanadoresPartido(p) {
    const empty = { ganadores: new Set(), jugadores: new Set(), empate: false, sinDatos: true };
    if (!p) return empty;

    const tipo = p.tipo || (p.gamified ? 'gamificado' : null);
    const esGamificado = tipo === 'gamificado' || !!p.gamified;
    const esAustraliana = tipo === 'australiana' || !!p.puntosAustraliana;

    // ── 1) GAMIFICADO: gana el / los que tienen máxima puntuación
    if (esGamificado) {
        const pts = p.puntosGamificados || {};
        const ids = (p.idsG && p.idsG.length ? p.idsG : (p.ids || [])).map(String);
        if (!ids.length) return empty;
        const max = Math.max(0, ...ids.map(id => Number(pts[id] || pts[String(id)] || 0)));
        if (max <= 0) {
            // Sin datos de puntos → no contar como derrota de todos
            return { ganadores: new Set(), jugadores: new Set(ids), empate: false, sinDatos: true };
        }
        const ganadores = new Set(ids.filter(id => Number(pts[id] || pts[String(id)] || 0) === max));
        return { ganadores, jugadores: new Set(ids), empate: ganadores.size > 1, sinDatos: false };
    }

    // ── 2) AUSTRALIANA: gana el / los que tienen máximos juegos
    if (esAustraliana) {
        const pts = p.puntosAustraliana || {};
        const ids = (p.ids || []).map(String);
        if (!ids.length) return empty;
        const max = Math.max(0, ...ids.map(id => Number(pts[id] || 0)));
        if (max <= 0) return { ganadores: new Set(), jugadores: new Set(ids), empate: false, sinDatos: true };
        const ganadores = new Set(ids.filter(id => Number(pts[id] || 0) === max));
        return { ganadores, jugadores: new Set(ids), empate: ganadores.size > 1, sinDatos: false };
    }

    // ── 3) ESTÁNDAR (1v1, 2v2, 3v3, asimétrico): juegosA vs juegosB
    const jA = Number(p.juegosA || 0);
    const jB = Number(p.juegosB || 0);
    // Reparto correcto de equipos: solo dividir por la mitad si tamanoEquipoA NO está, y SIEMPRE redondeado.
    let idsA, idsB;
    if (Array.isArray(p.idsA) && Array.isArray(p.idsB)) {
        idsA = p.idsA.map(String);
        idsB = p.idsB.map(String);
    } else if (p.ids) {
        const ids = p.ids.map(String);
        const corte = Number.isFinite(p.tamanoEquipoA) ? Number(p.tamanoEquipoA) : Math.floor(ids.length / 2);
        idsA = ids.slice(0, corte);
        idsB = ids.slice(corte);
    } else {
        return empty;
    }
    const todos = new Set([...idsA, ...idsB]);
    if (jA === 0 && jB === 0) {
        // Marcador 0-0 → partido sin datos, no contar
        return { ganadores: new Set(), jugadores: todos, empate: false, sinDatos: true };
    }
    // Tiebreak desempata si lo hay
    let ganaA;
    if (jA === jB) {
        const tbA = Number((p.tiebreakScores && p.tiebreakScores.A) || p.tbA || 0);
        const tbB = Number((p.tiebreakScores && p.tiebreakScores.B) || p.tbB || 0);
        if (tbA !== tbB) ganaA = tbA > tbB;
        else return { ganadores: new Set(), jugadores: todos, empate: true, sinDatos: false };
    } else {
        ganaA = jA > jB;
    }
    const ganadores = new Set(ganaA ? idsA : idsB);
    return { ganadores, jugadores: todos, empate: false, sinDatos: false };
}

/**
 * Construir array de jornadas con resultados por jugador.
 * Devuelve: [{ fecha, jornadaId, resultados: { jugadorId: { ganados, empatados, perdidos, jugados, puntos } } }]
 * Ordenado cronológicamente (más antigua primero).
 */
function _avRendimientoPorJornada() {
    const historico = Array.isArray(db.historicoJornadas)
        ? db.historicoJornadas
        : Object.values(db.historicoJornadas || {});

    const initStats = () => ({ ganados: 0, empatados: 0, perdidos: 0, jugados: 0, puntos: 0 });

    const out = [];
    historico.forEach(jor => {
        if (!jor || !Array.isArray(jor.partidos)) return;
        const resultados = {}; // jugadorId → stats
        jor.partidos.forEach(p => {
            const { ganadores, jugadores, empate, sinDatos } = _avResolverGanadoresPartido(p);
            if (sinDatos) return;  // partido archivado sin marcador → ignorar para no falsear stats

            jugadores.forEach(id => {
                if (!resultados[id]) resultados[id] = initStats();
                resultados[id].jugados++;
                if (empate) {
                    resultados[id].empatados++;
                    resultados[id].puntos += 2;
                } else if (ganadores.has(id)) {
                    resultados[id].ganados++;
                    resultados[id].puntos += 3;
                } else {
                    resultados[id].perdidos++;
                    resultados[id].puntos += 1;
                }
            });
        });

        // MVPs adicionales (bonus aparte del partido)
        (jor.mvpIdsJugadores || []).forEach(id => {
            const sid = String(id);
            if (!resultados[sid]) resultados[sid] = initStats();
            resultados[sid].puntos += 3;
        });
        (jor.mvpIdsEntrenadores || []).forEach(id => {
            const sid = String(id);
            if ((jor.mvpIdsJugadores || []).map(String).includes(sid)) return;  // evitar doble
            if (!resultados[sid]) resultados[sid] = initStats();
            resultados[sid].puntos += 2;
        });

        out.push({ fecha: jor.fecha, jornadaId: jor.id, resultados });
    });

    // Ordenar por fecha ascendente (más antigua primero)
    out.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    return out;
}

// ──────────────────────────────────────────────────────────────
// 1. RADAR PENTAGONAL
// ──────────────────────────────────────────────────────────────

/**
 * Genera un SVG radar pentagonal para un jugador.
 * Las 5 habilidades se distribuyen en pentágono regular.
 * Devuelve string HTML con el SVG.
 */
function avRenderRadarSVG(jugador, opts = {}) {
    const tam = opts.tam || 220;
    const cx = tam / 2, cy = tam / 2;
    const radioMax = (tam / 2) - 30;
    const h = jugador.habilidades || {};
    const habs = [
        { label: 'SAQUE',   key: 'Saque',   icono: '🚀' },
        { label: 'DERECHA', key: 'Derecha', icono: '🔥' },
        { label: 'REVÉS',   key: 'Reves',   icono: '🔙' },
        { label: 'VOLEA',   key: 'Volea',   icono: '🧤' },
        { label: 'MENTAL',  key: 'Mental',  icono: '🧠' }
    ];

    // 5 puntos del pentágono (empieza arriba)
    const angulo = (i) => -Math.PI / 2 + (i * 2 * Math.PI / 5);

    // Anillos de fondo (niveles 2, 4, 6, 8, 10)
    let anillos = '';
    [2, 4, 6, 8, 10].forEach(nivel => {
        const r = (nivel / 10) * radioMax;
        const pts = habs.map((_, i) => {
            const a = angulo(i);
            return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(' ');
        const opacity = nivel === 10 ? 0.35 : 0.15;
        anillos += `<polygon points="${pts}" fill="none" stroke="#94a3b8" stroke-width="1" opacity="${opacity}"/>`;
    });

    // Líneas radiales
    let radiales = '';
    habs.forEach((_, i) => {
        const a = angulo(i);
        radiales += `<line x1="${cx}" y1="${cy}" x2="${cx + radioMax * Math.cos(a)}" y2="${cy + radioMax * Math.sin(a)}" stroke="#94a3b8" stroke-width="1" opacity="0.2"/>`;
    });

    // Polígono del jugador
    const valores = habs.map(h_ => Math.max(0, Math.min(10, h[h_.key] || 5)));
    const ptsJugador = habs.map((_, i) => {
        const a = angulo(i);
        const r = (valores[i] / 10) * radioMax;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');

    // Puntos en cada vértice (círculos pequeños)
    let vertices = '';
    habs.forEach((_, i) => {
        const a = angulo(i);
        const r = (valores[i] / 10) * radioMax;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        vertices += `<circle cx="${x}" cy="${y}" r="3.5" fill="#0a7556"/>`;
    });

    // Etiquetas de las habilidades + valor
    let etiquetas = '';
    habs.forEach((hab, i) => {
        const a = angulo(i);
        const labelR = radioMax + 18;
        const lx = cx + labelR * Math.cos(a);
        const ly = cy + labelR * Math.sin(a);
        const valR = (valores[i] / 10) * radioMax + 12;
        const vx = cx + valR * Math.cos(a);
        const vy = cy + valR * Math.sin(a);
        etiquetas += `
            <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle"
                  font-size="10" font-weight="900" fill="#1f2937">${hab.icono}</text>
            <text x="${lx}" y="${ly + 11}" text-anchor="middle" dominant-baseline="middle"
                  font-size="8" font-weight="700" fill="#4a5568" letter-spacing="0.5">${hab.label}</text>
        `;
    });

    return `
        <svg viewBox="0 0 ${tam} ${tam}" width="100%" style="max-width:${tam}px;display:block;margin:auto;">
            ${anillos}
            ${radiales}
            <polygon points="${ptsJugador}" fill="rgba(10,117,86,0.25)" stroke="#0a7556" stroke-width="2.5" stroke-linejoin="round"/>
            ${vertices}
            ${etiquetas}
        </svg>
    `;
}

// ──────────────────────────────────────────────────────────────
// 2. SPARKLINE EVOLUCIÓN TEMPORAL
// ──────────────────────────────────────────────────────────────

/**
 * SVG sparkline de los puntos de un jugador en las últimas N jornadas.
 * @param {object} jugador
 * @param {object} rendJornadas  array de _avRendimientoPorJornada()
 * @param {number} maxJornadas   últimas N jornadas (default: 10)
 */
function avRenderSparklineSVG(jugador, rendJornadas, maxJornadas = 10) {
    const idStr = String(jugador.id);
    const datos = rendJornadas
        .slice(-maxJornadas)
        .map(j => (j.resultados[idStr] || {}).puntos || 0);

    if (datos.length === 0) return '<p style="color:#888;font-size:0.78rem;text-align:center;padding:12px;">Sin datos históricos aún</p>';

    const ancho = 240, alto = 60, padding = 6;
    const max = Math.max(...datos, 1);
    const dx = datos.length > 1 ? (ancho - padding * 2) / (datos.length - 1) : 0;
    const points = datos.map((v, i) => {
        const x = padding + i * dx;
        const y = alto - padding - (v / max) * (alto - padding * 2);
        return [x, y];
    });

    // Path de la línea
    const linePath = points.map((p, i) =>
        (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)
    ).join(' ');

    // Path del área rellena (debajo de la línea)
    const areaPath = `${linePath} L ${points[points.length-1][0]} ${alto - padding} L ${points[0][0]} ${alto - padding} Z`;

    // Tendencia: comparar primer tercio vs último tercio
    const tercio = Math.max(1, Math.floor(datos.length / 3));
    const promPrimer = datos.slice(0, tercio).reduce((a,b)=>a+b,0) / tercio;
    const promUltimo = datos.slice(-tercio).reduce((a,b)=>a+b,0) / tercio;
    let tendencia = '';
    if (promUltimo > promPrimer * 1.15)      tendencia = '<span style="color:#0a7556;font-weight:900;">📈 SUBE</span>';
    else if (promUltimo < promPrimer * 0.85) tendencia = '<span style="color:#dc2626;font-weight:900;">📉 BAJA</span>';
    else                                      tendencia = '<span style="color:#6e5526;font-weight:900;">➡️ ESTABLE</span>';

    // Puntos circulares en cada vértice
    const dots = points.map((p, i) => {
        const v = datos[i];
        const color = v === max ? '#0a7556' : '#3b82f6';
        return `<circle cx="${p[0]}" cy="${p[1]}" r="${i === points.length - 1 ? 4 : 2.5}" fill="${color}"/>`;
    }).join('');

    return `
        <div style="display:flex;align-items:center;gap:12px;">
            <svg viewBox="0 0 ${ancho} ${alto}" width="100%" style="max-width:${ancho}px;flex:1;min-width:0;">
                <path d="${areaPath}" fill="rgba(59,130,246,0.15)"/>
                <path d="${linePath}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                ${dots}
            </svg>
            <div style="text-align:right;font-size:0.72rem;line-height:1.4;flex-shrink:0;">
                ${tendencia}<br>
                <span style="color:#4a5568;font-weight:600;">${datos.length} jornada${datos.length>1?'s':''}</span>
            </div>
        </div>
    `;
}

// ──────────────────────────────────────────────────────────────
// 3. TERMÓMETRO DE FORMA
// ──────────────────────────────────────────────────────────────

/**
 * Calcula la "forma" del jugador en las últimas 5 jornadas.
 * Devuelve { estado: 'caliente'|'tibio'|'frio'|'sin-datos', winRate, jornadas, racha }
 *
 * winRate "ponderado": las victorias valen 1, los empates 0.5, las derrotas 0.
 * Necesita ≥3 partidos jugados en las últimas 5 jornadas para clasificar;
 * si no hay datos suficientes devuelve 'sin-datos'.
 */
function avCalcularForma(jugador, rendJornadas) {
    const idStr = String(jugador.id);
    const ultimas = rendJornadas.slice(-5).filter(j => j.resultados[idStr]);
    if (ultimas.length === 0) return { estado: 'sin-datos', winRate: 0, jornadas: 0, racha: 0 };

    let totalGanados = 0, totalEmpatados = 0, totalJugados = 0;
    ultimas.forEach(j => {
        const r = j.resultados[idStr];
        totalGanados   += r.ganados   || 0;
        totalEmpatados += r.empatados || 0;
        totalJugados   += r.jugados   || 0;
    });

    // Sin partidos suficientes → no clasificar como frío por defecto
    if (totalJugados < 3) {
        return { estado: 'sin-datos', winRate: 0, jornadas: ultimas.length, racha: 0,
                 rachaD: jugador.rachaDerrotas || 0 };
    }

    // Empate cuenta como medio (no es derrota)
    const winRate = Math.round(((totalGanados + totalEmpatados * 0.5) / totalJugados) * 100);

    let estado;
    if (winRate >= 60)       estado = 'caliente';
    else if (winRate >= 40)  estado = 'tibio';
    else                      estado = 'frio';

    return {
        estado,
        winRate,
        jornadas: ultimas.length,
        racha: jugador.rachaVictorias || 0,
        rachaD: jugador.rachaDerrotas || 0
    };
}

function avBadgeForma(forma) {
    const config = {
        'caliente':  { emoji: '🔥', txt: 'EN RACHA',   bg: 'rgba(220,38,38,0.12)', color: '#dc2626' },
        'tibio':     { emoji: '〰️', txt: 'REGULAR',    bg: 'rgba(146,64,14,0.10)', color: '#92400e' },
        'frio':      { emoji: '❄️', txt: 'FRÍO',       bg: 'rgba(59,130,246,0.10)', color: '#1d4ed8' },
        'sin-datos': { emoji: '⏳', txt: 'SIN DATOS',  bg: '#f1f5f9',                color: '#64748b' }
    };
    const c = config[forma.estado];
    return `
        <div style="display:inline-flex;align-items:center;gap:6px;background:${c.bg};
                    color:${c.color};padding:5px 12px;border-radius:14px;
                    font-weight:900;font-size:0.78rem;letter-spacing:0.5px;">
            <span style="font-size:1rem;">${c.emoji}</span>${c.txt}
            ${forma.estado !== 'sin-datos' ? `<span style="opacity:0.85;font-weight:700;">· ${forma.winRate}%</span>` : ''}
        </div>
    `;
}

// ──────────────────────────────────────────────────────────────
// 4. SUGERENCIAS AUTOMÁTICAS
// ──────────────────────────────────────────────────────────────

/**
 * Genera 1-3 sugerencias inteligentes para un jugador basadas en sus stats.
 * Detecta: habilidades flojas, fortalezas, asimetrías, tendencias.
 */
function avSugerenciasJugador(jugador, rendJornadas) {
    const sug = [];
    const h = jugador.habilidades || {};
    const stats = jugador.stats || {};

    // 1. Habilidad MÁS BAJA → trabajar
    const habMap = [
        { key: 'Saque',   label: 'el saque',   icono: '🚀', val: h.Saque   || 5 },
        { key: 'Derecha', label: 'la derecha', icono: '🔥', val: h.Derecha || 5 },
        { key: 'Reves',   label: 'el revés',   icono: '🔙', val: h.Reves   || 5 },
        { key: 'Volea',   label: 'la volea',   icono: '🧤', val: h.Volea   || 5 },
        { key: 'Mental',  label: 'lo mental',  icono: '🧠', val: h.Mental  || 5 }
    ];
    const habsOrd = [...habMap].sort((a, b) => a.val - b.val);
    const masBaja = habsOrd[0];
    const masAlta = habsOrd[habsOrd.length - 1];

    // Solo sugerir trabajar la habilidad si hay una clara debilidad
    if (masAlta.val - masBaja.val >= 1.0) {
        sug.push({
            tipo: 'mejorar',
            icono: masBaja.icono,
            color: '#dc2626',
            txt: `<b>Trabajar ${masBaja.label}</b> (${masBaja.val.toFixed(1)}/10 — punto débil)`
        });
    }

    // 2. Fortaleza clara → seguir explotando
    if (masAlta.val >= 7) {
        sug.push({
            tipo: 'fortaleza',
            icono: masAlta.icono,
            color: '#0a7556',
            txt: `<b>Aprovechar ${masAlta.label}</b> (${masAlta.val.toFixed(1)}/10 — fortaleza)`
        });
    }

    // 3. Win rate bajo → consistencia
    const totales = stats.totales || 0;
    const ganados = stats.ganados || 0;
    if (totales >= 4) {
        const winRate = Math.round((ganados / totales) * 100);
        if (winRate < 35) {
            sug.push({
                tipo: 'consistencia',
                icono: '🎯',
                color: '#92400e',
                txt: `<b>Mejora la consistencia</b> en partidos (${winRate}% victorias en ${totales} partidos)`
            });
        } else if (winRate >= 70) {
            sug.push({
                tipo: 'destacado',
                icono: '🏆',
                color: '#0a7556',
                txt: `<b>Jugador de élite</b> (${winRate}% victorias en ${totales} partidos)`
            });
        }
    }

    // 4. Tendencia (sparkline)
    if (rendJornadas && rendJornadas.length >= 3) {
        const idStr = String(jugador.id);
        const datos = rendJornadas
            .slice(-6)
            .map(j => (j.resultados[idStr] || {}).puntos || 0);
        if (datos.length >= 3 && datos.some(d => d > 0)) {
            const tercio = Math.max(1, Math.floor(datos.length / 2));
            const primero = datos.slice(0, tercio).reduce((a,b)=>a+b,0) / tercio;
            const ultimo = datos.slice(-tercio).reduce((a,b)=>a+b,0) / tercio;
            if (ultimo > primero * 1.3) {
                sug.push({
                    tipo: 'tendencia',
                    icono: '📈',
                    color: '#0a7556',
                    txt: `<b>En clara mejoría</b> — ha subido su rendimiento últimamente`
                });
            } else if (ultimo < primero * 0.7 && primero > 0) {
                sug.push({
                    tipo: 'tendencia',
                    icono: '📉',
                    color: '#dc2626',
                    txt: `<b>Bajada de rendimiento</b> — revisar motivación o fatiga`
                });
            }
        }
    }

    // 5. Pocos partidos → fomentar participación
    if (totales > 0 && totales < 4) {
        sug.push({
            tipo: 'participacion',
            icono: '🎾',
            color: '#1d4ed8',
            txt: `<b>Necesita más partidos</b> (solo ${totales} jugado${totales>1?'s':''}) — convocar más a menudo`
        });
    }

    // 6. Asimetría grande aces vs winners (indica saque vs juego de fondo)
    const aces = stats.aces || 0;
    const winners = stats.winners || 0;
    if (aces + winners >= 5) {
        if (aces > winners * 2.5) {
            sug.push({
                tipo: 'estilo',
                icono: '⚡',
                color: '#1d4ed8',
                txt: `<b>Estilo "saque-volea"</b> — ${aces} aces vs ${winners} winners. Buscar variar el juego`
            });
        } else if (winners > aces * 4 && aces >= 1) {
            sug.push({
                tipo: 'estilo',
                icono: '💪',
                color: '#1d4ed8',
                txt: `<b>Buen jugador de fondo</b> — ${winners} winners vs ${aces} aces. Trabajar el saque`
            });
        }
    }

    // Si no hay sugerencias relevantes, una positiva genérica
    if (sug.length === 0) {
        sug.push({
            tipo: 'equilibrado',
            icono: '⚖️',
            color: '#6e5526',
            txt: `<b>Jugador equilibrado</b> — sin debilidades marcadas, sigue así`
        });
    }

    return sug.slice(0, 3);  // máximo 3
}

// ──────────────────────────────────────────────────────────────
// 5. COMBINACIONES EQUILIBRADAS PARA DOBLES Y TRÍOS
// ──────────────────────────────────────────────────────────────

/**
 * Algoritmo: para dobles, encontrar 2 parejas cuyo nivel SUMADO sea similar.
 * Para tríos, dividir en 2 equipos de 3 cuyo nivel sumado sea similar.
 *
 * Estrategia simple y rápida:
 *  - Ordenar jugadores por nivel descendente
 *  - Asignar alternando (snake): pareja A recibe 1°, pareja B recibe 2°,
 *    pareja B recibe 3°, pareja A recibe 4°, etc. Esto equilibra naturalmente.
 *
 * @param {Array} jugadores  jugadores a emparejar (4 para dobles, 6 para tríos)
 * @param {string} modo  'dobles' o 'trios'
 * @returns { equipoA, equipoB, nivelA, nivelB, diff }
 */
function avEquilibrarEquipos(jugadores, modo) {
    if (modo === 'dobles' && jugadores.length !== 4) return null;
    if (modo === 'trios'  && jugadores.length !== 6) return null;

    const conNivel = jugadores
        .map(j => ({ j, nivel: _avNivelJugador(j) }))
        .sort((a, b) => b.nivel - a.nivel);

    const equipoA = [], equipoB = [];

    if (modo === 'dobles') {
        // Snake óptima para 4 jugadores:
        // 1° y 4° en equipo A, 2° y 3° en equipo B
        equipoA.push(conNivel[0].j, conNivel[3].j);
        equipoB.push(conNivel[1].j, conNivel[2].j);
    } else { // trios
        // Snake óptima para 6 jugadores:
        // 1°, 4°, 5° en equipo A; 2°, 3°, 6° en equipo B
        equipoA.push(conNivel[0].j, conNivel[3].j, conNivel[4].j);
        equipoB.push(conNivel[1].j, conNivel[2].j, conNivel[5].j);
    }

    const nivelA = equipoA.reduce((s, j) => s + _avNivelJugador(j), 0);
    const nivelB = equipoB.reduce((s, j) => s + _avNivelJugador(j), 0);

    return {
        equipoA, equipoB,
        nivelA: nivelA.toFixed(1),
        nivelB: nivelB.toFixed(1),
        diff: Math.abs(nivelA - nivelB).toFixed(1)
    };
}

/**
 * Genera 3 sugerencias de combinaciones equilibradas a partir
 * de los jugadores convocados o de toda la cantera.
 */
function avCombinacionesSugeridas(jugadores, modo) {
    // Filtrar jugadores con datos
    const validos = jugadores.filter(j => !j.esInvitado && j.habilidades);
    const tamano = modo === 'dobles' ? 4 : 6;
    if (validos.length < tamano) {
        return { suficientes: false, necesarios: tamano, actuales: validos.length };
    }

    // Ordenar por nivel para escenarios variados
    const ord = [...validos].sort((a, b) => _avNivelJugador(b) - _avNivelJugador(a));
    const combinaciones = [];

    // Combinación 1: top tamaño jugadores (los mejores)
    if (ord.length >= tamano) {
        const grupo = ord.slice(0, tamano);
        const eq = avEquilibrarEquipos(grupo, modo);
        if (eq) combinaciones.push({ etiqueta: '🏆 Élite (top jugadores)', equipo: eq });
    }

    // Combinación 2: nivel medio (saltando los mejores 1-2 para variar)
    if (ord.length >= tamano + 2) {
        const grupo = ord.slice(2, 2 + tamano);
        const eq = avEquilibrarEquipos(grupo, modo);
        if (eq) combinaciones.push({ etiqueta: '⚖️ Nivel medio', equipo: eq });
    } else if (ord.length === tamano + 1) {
        // Si justo uno más: rotar uno de los del medio
        const grupo = [ord[0], ...ord.slice(2, 2 + tamano - 1)];
        const eq = avEquilibrarEquipos(grupo, modo);
        if (eq) combinaciones.push({ etiqueta: '🔄 Rotación alternativa', equipo: eq });
    }

    // Combinación 3: alternativa con criterio distinto al equilibrar
    // Si solo hay justo `tamano` jugadores, generar una combinación distinta
    // usando otra distribución (mejor+peor en mismo equipo en lugar de cruzar).
    if (ord.length >= tamano) {
        const grupo = ord.slice(0, tamano);
        const altEq = _avEmparejamientoAlternativo(grupo, modo);
        if (altEq && combinaciones.length < 3) {
            // Verificar que no sea duplicado de la primera
            const primeraIds = new Set([
                ...combinaciones[0].equipo.equipoA.map(j => String(j.id)),
                ...combinaciones[0].equipo.equipoB.map(j => String(j.id))
            ]);
            const altIdsA = altEq.equipoA.map(j => String(j.id));
            const altIdsB = altEq.equipoB.map(j => String(j.id));
            const primeraEqAIds = combinaciones[0].equipo.equipoA.map(j => String(j.id)).sort().join(',');
            const altEqAIds = altIdsA.slice().sort().join(',');
            // Solo añadir si la distribución es realmente distinta
            if (primeraEqAIds !== altEqAIds) {
                combinaciones.push({ etiqueta: '🎓 Mixto (formato alternativo)', equipo: altEq });
            }
        }
    }

    // Si todavía hay menos de 3 y hay suficientes jugadores extra, probar otra rotación
    if (combinaciones.length < 3 && ord.length >= tamano + 1) {
        // Sustituir el último del top por el siguiente disponible
        const grupo = [...ord.slice(0, tamano - 1), ord[tamano]];
        const eq = avEquilibrarEquipos(grupo, modo);
        if (eq) combinaciones.push({ etiqueta: '🔄 Rotación (con suplente)', equipo: eq });
    }

    return { suficientes: true, combinaciones };
}

/**
 * Emparejamiento alternativo: en vez de snake (1+4 vs 2+3 para dobles),
 * usa "polos" (1+2 vs 3+4) — desequilibra a propósito para mostrar
 * un formato donde los mejores enfrenten a los menos hábiles juntos.
 */
function _avEmparejamientoAlternativo(jugadores, modo) {
    const conNivel = jugadores
        .map(j => ({ j, nivel: _avNivelJugador(j) }))
        .sort((a, b) => b.nivel - a.nivel);

    const equipoA = [], equipoB = [];
    if (modo === 'dobles') {
        // Polos: 1°+2° vs 3°+4° (mejores juntos, menos hábiles juntos)
        equipoA.push(conNivel[0].j, conNivel[1].j);
        equipoB.push(conNivel[2].j, conNivel[3].j);
    } else { // tríos
        // Polos: 1°+2°+3° vs 4°+5°+6°
        equipoA.push(conNivel[0].j, conNivel[1].j, conNivel[2].j);
        equipoB.push(conNivel[3].j, conNivel[4].j, conNivel[5].j);
    }

    const nivelA = equipoA.reduce((s, j) => s + _avNivelJugador(j), 0);
    const nivelB = equipoB.reduce((s, j) => s + _avNivelJugador(j), 0);

    return {
        equipoA, equipoB,
        nivelA: nivelA.toFixed(1),
        nivelB: nivelB.toFixed(1),
        diff: Math.abs(nivelA - nivelB).toFixed(1)
    };
}

// ──────────────────────────────────────────────────────────────
// RENDER PRINCIPAL DE LA SECCIÓN
// ──────────────────────────────────────────────────────────────

function renderAnalisisVisual() {
    const cont = document.getElementById('analisis-visual-container');
    if (!cont) return;

    const jugadores = (db.jugadores || []).filter(j => !j.esInvitado);
    if (jugadores.length === 0) {
        cont.innerHTML = '<p style="text-align:center;padding:30px;color:#888;">📊 Aún no hay jugadores en la cantera.</p>';
        return;
    }

    const rendJornadas = _avRendimientoPorJornada();

    // Selector de jugador (memoria local)
    const selectedId = window._avJugadorSeleccionado || String(jugadores[0].id);
    const jugadoresOrd = [...jugadores].sort((a, b) => a.nombre.localeCompare(b.nombre));

    let html = `
        <!-- ═══ SELECTOR JUGADOR ═══ -->
        <div class="card" style="background:#fff;padding:18px 16px;margin-bottom:18px;">
            <label style="font-size:0.75rem;font-weight:900;color:#1f2937;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:8px;">
                👤 ANÁLISIS POR JUGADOR
            </label>
            <select id="av-selector-jugador" onchange="window._avJugadorSeleccionado=this.value;renderAnalisisVisual();"
                    class="atp-input" style="width:100%;font-size:1rem;font-weight:700;">
                ${jugadoresOrd.map(j => `<option value="${j.id}" ${String(j.id)===selectedId?'selected':''}>${escapeHtml(j.nombre)}</option>`).join('')}
            </select>
        </div>
    `;

    const jSel = jugadores.find(j => String(j.id) === selectedId) || jugadores[0];

    // ─── BLOQUE 1: TARJETA DEL JUGADOR (header con forma) ───
    const forma = avCalcularForma(jSel, rendJornadas);
    const nivelMedio = _avNivelJugador(jSel).toFixed(1);
    html += `
        <div class="card" style="background:linear-gradient(135deg,#fff,#f8f9fa);padding:20px 18px;margin-bottom:18px;border-left:5px solid #6e5526;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
                <h3 style="margin:0;font-size:1.4rem;font-weight:900;color:#1f2937;">${escapeHtml(jSel.nombre)}</h3>
                ${avBadgeForma(forma)}
            </div>
            <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:0.85rem;color:#4a5568;font-weight:600;">
                <div>📊 Nivel: <b style="color:#6e5526;">${nivelMedio}/10</b></div>
                <div>🏆 Puntos: <b style="color:#6e5526;">${jSel.puntosTotales || 0}</b></div>
                <div>🎾 Partidos: <b>${(jSel.stats||{}).totales || 0}</b></div>
                <div>✓ Ganados: <b style="color:#0a7556;">${(jSel.stats||{}).ganados || 0}</b></div>
            </div>
        </div>
    `;

    // ─── BLOQUE 2: RADAR PENTAGONAL ───
    html += `
        <div class="card" style="background:#fff;padding:18px;margin-bottom:18px;">
            <h4 style="margin:0 0 14px 0;font-size:0.85rem;font-weight:900;color:#6e5526;
                       letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #f1f5f9;padding-bottom:8px;">
                🕸️ Perfil de Habilidades
            </h4>
            ${avRenderRadarSVG(jSel)}
        </div>
    `;

    // ─── BLOQUE 3: SPARKLINE EVOLUCIÓN ───
    html += `
        <div class="card" style="background:#fff;padding:18px;margin-bottom:18px;">
            <h4 style="margin:0 0 14px 0;font-size:0.85rem;font-weight:900;color:#6e5526;
                       letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #f1f5f9;padding-bottom:8px;">
                📈 Evolución de Puntos por Jornada
            </h4>
            ${avRenderSparklineSVG(jSel, rendJornadas)}
        </div>
    `;

    // ─── BLOQUE 4: SUGERENCIAS ───
    const sugerencias = avSugerenciasJugador(jSel, rendJornadas);
    html += `
        <div class="card" style="background:#fff;padding:18px;margin-bottom:18px;">
            <h4 style="margin:0 0 14px 0;font-size:0.85rem;font-weight:900;color:#6e5526;
                       letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #f1f5f9;padding-bottom:8px;">
                💡 Sugerencias del Entrenador
            </h4>
            <div style="display:flex;flex-direction:column;gap:10px;">
                ${sugerencias.map(s => `
                    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;
                                background:#f8f9fa;border-radius:10px;border-left:4px solid ${s.color};">
                        <span style="font-size:1.5rem;line-height:1;flex-shrink:0;">${s.icono}</span>
                        <div style="font-size:0.88rem;line-height:1.45;color:#1f2937;">${s.txt}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // ─── BLOQUE 5: COMBINACIONES EQUILIBRADAS ───
    html += `
        <div class="card" style="background:#fff;padding:18px;margin-bottom:18px;">
            <h4 style="margin:0 0 14px 0;font-size:0.85rem;font-weight:900;color:#6e5526;
                       letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #f1f5f9;padding-bottom:8px;">
                🤝 Combinaciones Equilibradas
            </h4>
            <div style="display:flex;gap:8px;margin-bottom:14px;">
                <button onclick="window._avModoCombi='dobles';renderAnalisisVisual();"
                        class="atp-input" style="flex:1;padding:10px;font-weight:900;cursor:pointer;
                        background:${(window._avModoCombi||'dobles')==='dobles'?'#0a7556':'#e2e8f0'};
                        color:${(window._avModoCombi||'dobles')==='dobles'?'#fff':'#4a5568'};border:none;">
                    👥 DOBLES (4)
                </button>
                <button onclick="window._avModoCombi='trios';renderAnalisisVisual();"
                        class="atp-input" style="flex:1;padding:10px;font-weight:900;cursor:pointer;
                        background:${(window._avModoCombi||'dobles')==='trios'?'#0a7556':'#e2e8f0'};
                        color:${(window._avModoCombi||'dobles')==='trios'?'#fff':'#4a5568'};border:none;">
                    🔱 TRÍOS (6)
                </button>
            </div>
            ${_avRenderCombinaciones(jugadores, window._avModoCombi || 'dobles')}
        </div>
    `;

    // ─── BLOQUE 6: TERMÓMETRO DE FORMA DE TODA LA CANTERA ───
    html += `
        <div class="card" style="background:#fff;padding:18px;margin-bottom:18px;">
            <h4 style="margin:0 0 14px 0;font-size:0.85rem;font-weight:900;color:#6e5526;
                       letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #f1f5f9;padding-bottom:8px;">
                🔥 Termómetro de Forma — Últimas 5 Jornadas
            </h4>
            ${_avRenderTermometroGrupo(jugadores, rendJornadas)}
        </div>
    `;

    cont.innerHTML = html;
}

/** Render auxiliar: combinaciones para dobles/tríos */
function _avRenderCombinaciones(jugadores, modo) {
    const sug = avCombinacionesSugeridas(jugadores, modo);
    if (!sug.suficientes) {
        return `<p style="color:#888;font-size:0.85rem;text-align:center;padding:14px;">
            Necesitas al menos ${sug.necesarios} jugadores con habilidades registradas
            para sugerir ${modo === 'dobles' ? 'parejas' : 'tríos'}.
            Actualmente: ${sug.actuales}.
        </p>`;
    }
    if (!sug.combinaciones || sug.combinaciones.length === 0) {
        return '<p style="color:#888;font-size:0.85rem;text-align:center;padding:14px;">Sin combinaciones disponibles.</p>';
    }

    return sug.combinaciones.map(c => {
        const eq = c.equipo;
        const nombreEquipo = (arr) => arr.map(j => `<b>${escapeHtml(j.nombre.split(' ')[0])}</b>`).join(modo==='dobles' ? ' + ' : ' / ');
        const balanceColor = parseFloat(eq.diff) <= 0.5 ? '#0a7556' : (parseFloat(eq.diff) <= 1.5 ? '#92400e' : '#dc2626');
        const balanceLabel = parseFloat(eq.diff) <= 0.5 ? '✓ EQUILIBRADO' :
                             (parseFloat(eq.diff) <= 1.5 ? '⚠️ ACEPTABLE' : '❌ DESEQUILIBRADO');
        return `
            <div style="margin-bottom:14px;background:#f8f9fa;border-radius:10px;padding:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span style="font-weight:900;font-size:0.9rem;color:#1f2937;">${c.etiqueta}</span>
                    <span style="font-size:0.7rem;font-weight:900;color:${balanceColor};">${balanceLabel}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;">
                    <div style="text-align:center;padding:10px;background:rgba(10,117,86,0.08);border-radius:8px;">
                        <div style="font-size:0.65rem;color:#0a7556;font-weight:900;letter-spacing:1px;margin-bottom:4px;">EQUIPO A</div>
                        <div style="font-size:0.85rem;color:#1f2937;line-height:1.4;">${nombreEquipo(eq.equipoA)}</div>
                        <div style="font-size:0.7rem;color:#4a5568;margin-top:4px;font-weight:700;">Nivel total: ${eq.nivelA}</div>
                    </div>
                    <div style="font-weight:900;font-size:1rem;color:#6e5526;">VS</div>
                    <div style="text-align:center;padding:10px;background:rgba(29,78,216,0.08);border-radius:8px;">
                        <div style="font-size:0.65rem;color:#1d4ed8;font-weight:900;letter-spacing:1px;margin-bottom:4px;">EQUIPO B</div>
                        <div style="font-size:0.85rem;color:#1f2937;line-height:1.4;">${nombreEquipo(eq.equipoB)}</div>
                        <div style="font-size:0.7rem;color:#4a5568;margin-top:4px;font-weight:700;">Nivel total: ${eq.nivelB}</div>
                    </div>
                </div>
                <div style="text-align:center;font-size:0.7rem;color:#4a5568;margin-top:8px;">
                    Diferencia: <b>${eq.diff}</b> puntos
                </div>
            </div>
        `;
    }).join('');
}

/** Render auxiliar: termómetro de toda la cantera ordenado por forma */
function _avRenderTermometroGrupo(jugadores, rendJornadas) {
    const conForma = jugadores.map(j => ({
        j,
        forma: avCalcularForma(j, rendJornadas)
    })).filter(x => x.forma.estado !== 'sin-datos');

    if (conForma.length === 0) {
        return '<p style="color:#888;font-size:0.85rem;text-align:center;padding:14px;">Aún no hay jornadas registradas para calcular la forma.</p>';
    }

    // Ordenar: caliente → tibio → frío
    const ordenEstado = { 'caliente': 0, 'tibio': 1, 'frio': 2 };
    conForma.sort((a, b) => {
        const dE = ordenEstado[a.forma.estado] - ordenEstado[b.forma.estado];
        if (dE !== 0) return dE;
        return b.forma.winRate - a.forma.winRate;
    });

    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
            ${conForma.map(({j, forma}) => {
                const colorByEstado = {
                    'caliente': { bg: 'rgba(220,38,38,0.08)', border: '#dc2626', emoji: '🔥' },
                    'tibio':    { bg: 'rgba(146,64,14,0.06)', border: '#92400e', emoji: '〰️' },
                    'frio':     { bg: 'rgba(59,130,246,0.06)', border: '#1d4ed8', emoji: '❄️' }
                };
                const c = colorByEstado[forma.estado];
                return `
                    <div style="background:${c.bg};border-left:4px solid ${c.border};
                                padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                        <div style="min-width:0;flex:1;">
                            <div style="font-weight:900;color:#1f2937;font-size:0.92rem;
                                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                ${escapeHtml(j.nombre)}
                            </div>
                            <div style="font-size:0.7rem;color:#4a5568;font-weight:700;margin-top:2px;">
                                ${forma.winRate}% · ${forma.jornadas} jornada${forma.jornadas>1?'s':''}
                            </div>
                        </div>
                        <span style="font-size:1.5rem;">${c.emoji}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Hacer accesibles globalmente
window.renderAnalisisVisual = renderAnalisisVisual;
window.avRenderRadarSVG = avRenderRadarSVG;
window.avSugerenciasJugador = avSugerenciasJugador;
window.avEquilibrarEquipos = avEquilibrarEquipos;
window.avCalcularForma = avCalcularForma;
window._avRendimientoPorJornada = _avRendimientoPorJornada;
