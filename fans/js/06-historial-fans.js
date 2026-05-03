/* ============================================================
   ATP PLATINUM — fans/06-historial-fans.js
   Render historial + toggle jornada
   ── Refactor: extraído de fans.js (líneas 609-879)
   ============================================================ */

function renderHistorialFans() {
    const contenedor = document.getElementById('fans-historial-container');
    // ✅ FIX: guard contra null — el listener Firebase puede dispararse antes de
    // que la pestaña Historial esté en el DOM, causando TypeError que rompe
    // todo el ciclo de actualizaciones en tiempo real.
    if (!contenedor) return;
    // ✅ FIX BUG ALTO 2: Firebase puede serializar historicoJornadas como objeto.
    // Array.isArray falla con objetos {0:..,1:..}, causando TypeError en .reverse().
    const historicoRaw = Array.isArray(db.historicoJornadas)
        ? db.historicoJornadas
        : Object.values(db.historicoJornadas || {});

    if (historicoRaw.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">No hay jornadas guardadas.</p>';
        return;
    }

    // ✅ FIX BUG-FANS-1: ordenar explícitamente por fecha descendente.
    // .reverse() sobre el array de Firebase devuelve el orden de inserción,
    // no el cronológico — jornadas ADMIN insertadas fuera de orden quedan mal.
    // Si dos jornadas comparten fecha, la de ID mayor (más reciente) va primero.
    const historico = [...historicoRaw].sort((a, b) => {
        const tA = _parseFechaJornada(a.fecha);
        const tB = _parseFechaJornada(b.fecha);
        if (tB !== tA) return tB - tA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    // ✅ FIX BUG-FANS-2: preservar estado de acordeones abiertos antes de re-render.
    // Cuando Firebase actualiza datos en tiempo real, innerHTML se sobreescribe y
    // todos los acordeones se cierran. Guardamos los IDs reales abiertos.
    const abiertosAntes = new Set();
    contenedor.querySelectorAll('.jornada-content.open').forEach(el => {
        abiertosAntes.add(el.id);
    });

    const buscarNombre = (id) => {
        const j = (db.jugadores || []).find(x => String(x.id) === String(id));
        return j ? j.nombre : "???";
    };

    // ✅ FIX Bug 2: resolverEquipos del historial ahora incluye etiqueta (sincronizado con renderPistasFans)
    const resolverEquipos = (p) => {
        let eqA = 'Equipo A', eqB = 'Equipo B', etiqueta = '🤺 INDIVIDUAL';
        if (!p.ids || p.ids.length < 2) return { eqA, eqB, etiqueta };

        if (p.gamified || p.tipo === 'gamificado') {
            eqA = p.ids.map(id => buscarNombre(id)).join(' · ');
            eqB = '';
            etiqueta = '🎮 GAMIFICADO';
        } else if (p.tipo === 'asimetrico') {
            const corte = p.tamanoEquipoA != null ? Number(p.tamanoEquipoA) : Math.floor(p.ids.length / 2);
            eqA = p.ids.slice(0, corte).map(id => buscarNombre(id)).join('+');
            eqB = p.ids.slice(corte).map(id => buscarNombre(id)).join('+');
            // ✅ etiqueta asimétrico ahora visible también en historial
            etiqueta = `⚡ ASIMÉTRICO (${corte}v${p.ids.length - corte})`;
        } else if (p.tipo === 'trios' || (p.ids.length === 6 && !p.gamified && p.tipo !== 'asimetrico')) {
            eqA = `${buscarNombre(p.ids[0])}+${buscarNombre(p.ids[1])}+${buscarNombre(p.ids[2])}`;
            eqB = `${buscarNombre(p.ids[3])}+${buscarNombre(p.ids[4])}+${buscarNombre(p.ids[5])}`;
            etiqueta = '🔱 TRÍOS';
        } else if (p.ids.length === 4 || p.tipo === 'dobles') {
            eqA = `${buscarNombre(p.ids[0])} / ${buscarNombre(p.ids[1])}`;
            eqB = `${buscarNombre(p.ids[2])} / ${buscarNombre(p.ids[3])}`;
            etiqueta = '🎾 DOBLES';
        } else if (p.tipo === 'equipos3' && p.ids.length === 3) {
            if (p.puntosAustraliana) {
                eqA = p.ids.map(id => `${buscarNombre(id)}:${p.puntosAustraliana[id] || 0}`).join(' · ');
                eqB = '';
            } else {
                eqA = p.ids.map(id => buscarNombre(id)).join(' · ');
                eqB = '';
            }
            etiqueta = '🔄 AUSTRALIANA';
        } else {
            eqA = buscarNombre(p.ids[0]);
            eqB = buscarNombre(p.ids[1]);
            etiqueta = '🤺 INDIVIDUAL';
        }
        return { eqA, eqB, etiqueta };
    };

    let html = '';

    // ✅ FIX BUG-FANS-1: iterar sobre `historico` ya ordenado por fecha descendente.
    // Ya NO usamos [...historico].reverse() — ese patrón devolvía el orden de
    // inserción de Firebase, que no es cronológico cuando hay jornadas ADMIN.
    historico.forEach((jornada, index) => {
        // ✅ FIX BUG-FANS-2: ID del acordeón basado en el ID real de jornada (estable),
        // NO en el índice del array (que varía entre renders y causaba que el acordeón
        // se cerrara solo al actualizarse Firebase en tiempo real).
        const idJornada = `jf-${String(jornada.id || jornada.timestamp || index).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        // Normalizar fecha: ISO "2026-04-24" → "24/4/2026"
        const _fechaRaw = jornada.fecha || '';
        let fechaStr;
        if (_fechaRaw.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y,m,d] = _fechaRaw.split('-');
            fechaStr = `${parseInt(d)}/${parseInt(m)}/${y}`;
        } else {
            fechaStr = _fechaRaw || 'Sin fecha';
        }
        // ✅ FIX BUG HISTORIAL: Firebase serializa arrays como objetos {0:..,1:..}.
        // Normalizamos siempre a Array antes de operar con .length, .forEach, .map.
        const partidos = Array.isArray(jornada.partidos)
            ? jornada.partidos
            : Object.values(jornada.partidos || {});
        // ✅ FIX BUG-FANS-3: abrir automáticamente el PRIMER elemento del array
        // YA ORDENADO (la jornada más reciente de verdad), solo si tiene partidos.
        // Además, si el acordeón estaba abierto antes del re-render, mantenerlo abierto.
        const esMasReciente = index === 0 && partidos.length > 0;
        const estabaAbierto = abiertosAntes.has(idJornada);
        const debeAbrir = esMasReciente || estabaAbierto;
        const claseOpen = debeAbrir ? 'open' : '';
        const claseFlecha = debeAbrir ? 'open-arrow' : '';

        html += `
        <div class="jornada-wrapper">
            <button class="jornada-header" onclick="toggleJornada('${idJornada}', this)">
                <div style="display:flex; align-items:center; gap:15px; flex:1;">
                    <span style="font-size:1.2rem;">📅</span>
                    <div>
                        <div style="color:#ccff00; font-weight:900; font-size:1.1rem;">
                            ${fechaStr}
                            ${jornada.esAdmin ? '<span style="font-size:0.6rem;background:rgba(197,160,89,0.2);color:#C5A059;border:1px solid rgba(197,160,89,0.4);border-radius:4px;padding:1px 6px;margin-left:6px;font-weight:800;vertical-align:middle;">ADMIN</span>' : ''}
                        </div>
                        ${(() => {
                            const gN = id => { const j = (db.jugadores||[]).find(x=>String(x.id)===String(id)); return j ? j.nombre : '?'; };
                            const mJ = Array.isArray(jornada.mvpIdsJugadores) && jornada.mvpIdsJugadores.length
                                ? `<span style="color:#10ac84;font-size:0.7rem;font-weight:700;">🗳️ ${jornada.mvpIdsJugadores.map(gN).join(', ')}</span>` : '';
                            const mE = Array.isArray(jornada.mvpIdsEntrenadores) && jornada.mvpIdsEntrenadores.length
                                ? `<span style="color:#C5A059;font-size:0.7rem;font-weight:700;">👨‍🏫 ${jornada.mvpIdsEntrenadores.map(gN).join(', ')}</span>` : '';
                            const leg = jornada.mvp && !mJ && !mE
                                ? `<span style="color:#ff9f43;font-size:0.7rem;">👑 ${jornada.mvp}</span>` : '';
                            return [mJ, mE, leg].filter(Boolean).join(' · ');
                        })()}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                    <span style="color:#888; font-size:0.8rem;">${partidos.length} Partidos</span>
                    <span class="arrow-icon ${claseFlecha}">▼</span>
                </div>
            </button>
            <div id="${idJornada}" class="jornada-content ${claseOpen}">`;

        partidos.forEach(p => {
            const { eqA, eqB } = resolverEquipos(p);

            // Gamificado: layout especial con pts individuales
            if ((p.gamified || p.tipo === 'gamificado') && p.puntosGamificados && p.ids && p.ids.length > 0) {
                const allPts = p.ids.map(id => Number(p.puntosGamificados[id] || 0));
                const maxPts = Math.max(0, ...allPts);
                // ✅ FIX BUG MEDIO 3: si todos tienen 0 pts, mostrar estado "sin resultado"
                // en lugar de celdas grises planas que no indican nada al usuario.
                if (maxPts === 0) {
                    html += `
                    <div style="padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:0.6rem; color:#00d4ff; font-weight:bold; letter-spacing:1px; margin-bottom:4px;">🎮 GAMIFICADO</div>
                        <div style="color:#555; font-size:0.75rem; font-style:italic; text-align:center;">Sin resultado registrado</div>
                    </div>`;
                    return;
                }
                html += `
                <div style="padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="font-size:0.6rem; color:#00d4ff; font-weight:bold; letter-spacing:1px; margin-bottom:6px;">🎮 GAMIFICADO</div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        ${p.ids.map((id, i) => {
                            const nombre = buscarNombre(id);
                            const pts = allPts[i];
                            const esGanador = pts === maxPts && maxPts > 0 && allPts.filter(v => v === maxPts).length === 1;
                            return `<div style="background:rgba(0,212,255,0.08); border:1px solid ${esGanador ? '#ccff00' : 'rgba(0,212,255,0.2)'};
                                                border-radius:6px; padding:6px 10px; text-align:center; flex:1; min-width:60px;">
                                        <div style="font-size:0.65rem; color:#888;">${nombre}</div>
                                        <div style="font-size:1.1rem; font-weight:900; color:${esGanador ? '#ccff00' : '#aaa'};">${pts}</div>
                                        ${esGanador ? '<div style="font-size:0.55rem; color:#ccff00;">🏆</div>' : ''}
                                    </div>`;
                        }).join('')}
                    </div>
                </div>`;
                return;
            }

            // Australiana: layout especial de 3 jugadores con acumulados
            if (p.tipo === 'equipos3' && p.ids && p.ids.length === 3) {
                const pts = p.puntosAustraliana || {};
                const soloH = p.juegosSoloAustraliana || {};
                const haySoloH = Object.values(soloH).some(v => Number(v) > 0);
                const maxPts = Math.max(0, ...p.ids.map(id => Number(pts[String(id)] || 0)));
                html += `
                <div style="padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="font-size:0.6rem; color:#a78bfa; font-weight:bold; letter-spacing:1px; margin-bottom:6px;">🔄 AUSTRALIANA</div>
                    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:4px;">
                        ${p.ids.map(id => {
                            const acum = Number(pts[String(id)] || 0);
                            const soloAcum = Number(soloH[id] || 0);
                            const esGanador = acum === maxPts && maxPts > 0;
                            const nombre = buscarNombre(id);
                            return `<div style="background:rgba(167,139,250,0.08); border:1px solid ${esGanador ? '#ccff00' : 'rgba(255,255,255,0.06)'};
                                                border-radius:6px; padding:6px; text-align:center;">
                                        <div style="font-size:0.65rem; color:#888;">${nombre}</div>
                                        <div style="font-size:1.1rem; font-weight:900; color:${esGanador ? '#ccff00' : '#aaa'};">${acum}</div>
                                        ${haySoloH && soloAcum > 0 ? `<div style="font-size:0.55rem; color:#ff9f43;">solo:${soloAcum}</div>` : ''}
                                    </div>`;
                        }).join('')}
                    </div>
                </div>`;
                return;
            }

            const setsA = parseInt(p.juegosA) || 0;
            const setsB = parseInt(p.juegosB) || 0;
            const sinDatos = setsA === 0 && setsB === 0;
            const marcadorTexto = sinDatos && p.marcador && p.marcador !== '0-0'
                ? p.marcador
                : `${setsA} - ${setsB}`;
            // FANS-B FIX: misma lógica que FANS-A — detectar ganador de TB puro
            let ganoA = setsA > setsB;
            let ganoB = setsB > setsA;
            if (sinDatos && p.marcador) {
                const tbMatchH = p.marcador.match(/TB\s*(\d+)-(\d+)/i);
                if (tbMatchH) {
                    const tbAH = parseInt(tbMatchH[1]);
                    const tbBH = parseInt(tbMatchH[2]);
                    ganoA = tbAH > tbBH;
                    ganoB = tbBH > tbAH;
                }
            }

            html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0;
                        border-bottom:1px solid rgba(255,255,255,0.05); min-height:50px;">
                <div style="flex:1; text-align:right; padding-right:15px; font-size:0.85rem; line-height:1.2;
                            ${ganoA ? 'color:white; font-weight:900;' : 'color:#777;'}">
                    ${eqA}
                </div>
                <div style="background:#1a2530; color:#ccff00; padding:4px 10px; border-radius:6px;
                            font-weight:bold; font-size:0.9rem; border:1px solid #334155;
                            min-width:55px; text-align:center;">
                    ${marcadorTexto}
                </div>
                <div style="flex:1; text-align:left; padding-left:15px; font-size:0.85rem; line-height:1.2;
                            ${ganoB ? 'color:white; font-weight:900;' : 'color:#777;'}">
                    ${eqB}
                </div>
            </div>`;
        });

        html += `</div></div>`;
    });

    contenedor.innerHTML = html;
}

// 9. ACORDEÓN — toggleJornada
function toggleJornada(id, btn) {
    // ✅ FIX Bug 3: guard contra content null (race condition DOM)
    const content = document.getElementById(id);
    if (!content) return;
    const arrow = btn.querySelector('.arrow-icon');

    // Cerrar todas las demás antes de abrir la nueva
    document.querySelectorAll('.jornada-content').forEach(c => {
        if (c.id !== id) {
            c.classList.remove('open');
            const otroHeader = c.previousElementSibling;
            if (otroHeader) otroHeader.querySelector('.arrow-icon')?.classList.remove('open-arrow');
        }
    });

    content.classList.toggle('open');
    if (arrow) arrow.classList.toggle('open-arrow');
}
