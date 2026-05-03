/* ============================================================
   ATP PLATINUM — fans/02-render-pistas.js
   Render de pistas en directo
   ── Refactor: extraído de fans.js (líneas 73-334)
   ============================================================ */

function renderPistasFans() {
    const contenedor = document.getElementById('fans-pistas-container');
    // ✅ FIX: guard igual que renderHistorialFans — el listener Firebase puede dispararse
    // antes de que el DOM esté listo, causando TypeError que rompe todas las actualizaciones.
    if (!contenedor) return;
    // ✅ FIX BUG ALTO 1: Firebase serializa arrays como objetos {0:..,1:..} cuando
    // tienen muchos elementos o tras una reconexión. Normalizar siempre a Array.
    const partidosEnJuego = Array.isArray(db.partidosAbiertos)
        ? db.partidosAbiertos
        : Object.values(db.partidosAbiertos || {});
    const partidosTerminados = Array.isArray(db.partidosRecientes)
        ? db.partidosRecientes
        : Object.values(db.partidosRecientes || {});

    if (partidosEnJuego.length === 0 && partidosTerminados.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; color:#888; padding: 20px;">No hay partidos registrados en esta jornada todavía.</p>';
        return;
    }

    const tituloColumna = contenedor?.closest('.columna')?.querySelector('h3');
    let html = '';

    if (partidosEnJuego.length > 0) {
        if (tituloColumna) {
            tituloColumna.innerHTML = '🔴 EN DIRECTO';
            tituloColumna.classList.add('live-indicator');
        }
        html += `<h4 class="live-indicator" style="margin-bottom:15px; text-transform:uppercase; font-size:0.85rem; letter-spacing:2px;">
                    📡 RETRANSMITIENDO EN VIVO
                 </h4>`;
    } else {
        if (tituloColumna) {
            tituloColumna.innerHTML = '📅 ÚLTIMA JORNADA';
            tituloColumna.classList.remove('live-indicator');
            tituloColumna.style.color = '#C5A059';
        }
        html += `<h4 style="color:#888; margin-bottom:15px; text-transform:uppercase; font-size:0.85rem; letter-spacing:1px;">
                    🎾 RESUMEN ÚLTIMA JORNADA
                 </h4>`;
    }

    const buscarNombre = (id) => {
        if (!id) return "Jugador";
        const j = (db.jugadores || []).find(x => String(x.id) === String(id));
        return j ? j.nombre : "???";
    };

    const resolverEquipos = (p, separadorMulti = '<br>') => {
        let eqA = 'Equipo A', eqB = 'Equipo B', etiqueta = '🤺 INDIVIDUAL';

        if (!p.ids || p.ids.length < 2) return { eqA, eqB, etiqueta };

        if (p.gamified || p.tipo === 'gamificado') {
            eqA = p.ids.map(id => buscarNombre(id)).join(' · ');
            eqB = '';
            etiqueta = '🎮 GAMIFICADO';

        } else if (p.tipo === 'asimetrico') {
            const corte = p.tamanoEquipoA != null ? Number(p.tamanoEquipoA) : Math.floor(p.ids.length / 2);
            eqA = p.ids.slice(0, corte).map(id => buscarNombre(id)).join(separadorMulti);
            eqB = p.ids.slice(corte).map(id => buscarNombre(id)).join(separadorMulti);
            etiqueta = `⚡ ASIMÉTRICO (${corte}v${p.ids.length - corte})`;

        } else if (p.tipo === 'trios' || (p.ids.length === 6 && !p.gamified && p.tipo !== 'asimetrico')) {
            eqA = [p.ids[0], p.ids[1], p.ids[2]].map(id => buscarNombre(id)).join(separadorMulti);
            eqB = [p.ids[3], p.ids[4], p.ids[5]].map(id => buscarNombre(id)).join(separadorMulti);
            etiqueta = '🔱 TRÍOS';

        } else if (p.ids.length === 4 || p.tipo === 'dobles') {
            const sep = separadorMulti === '<br>' ? `${separadorMulti}<span style="color:#888; font-size:0.8rem;">&</span> ` : ' / ';
            eqA = `${buscarNombre(p.ids[0])}${sep}${buscarNombre(p.ids[1])}`;
            eqB = `${buscarNombre(p.ids[2])}${sep}${buscarNombre(p.ids[3])}`;
            etiqueta = '🎾 DOBLES';

        } else if (p.tipo === 'equipos3' && p.ids.length === 3) {
            const rondaIdx = (p.rondaActual ?? 0) % 3;
            const rondas = [
                { par: [p.ids[0], p.ids[1]], sol: p.ids[2] },
                { par: [p.ids[0], p.ids[2]], sol: p.ids[1] },
                { par: [p.ids[1], p.ids[2]], sol: p.ids[0] }
            ];
            const cfg = rondas[rondaIdx];
            eqA = cfg.par.map(id => buscarNombre(id)).join(' + ');
            eqB = buscarNombre(cfg.sol);
            etiqueta = `🔄 AUSTRALIANA R${(p.rondaActual ?? 0) + 1}`;

        } else {
            eqA = buscarNombre(p.ids[0]);
            eqB = buscarNombre(p.ids[1]);
            etiqueta = '🤺 INDIVIDUAL';
        }

        return { eqA, eqB, etiqueta };
    };

    // PARTIDOS ACTIVOS
    if (partidosEnJuego.length > 0) {
        partidosEnJuego.forEach((p, index) => {
            const { eqA, eqB, etiqueta } = resolverEquipos(p, '<br>');

            // Australiana: layout especial con 3 jugadores y acumulados
            if (p.tipo === 'equipos3' && p.ids && p.ids.length === 3) {
                const buscarNombreLocal = id => {
                    const j = (db.jugadores || []).find(x => String(x.id) === String(id));
                    return j ? j.nombre : '???';
                };
                const pts = p.puntosAustraliana || {};
                const rondaIdx = (p.rondaActual ?? 0) % 3;
                // FANS-D FIX: normalizar ids a String antes de construir rondas
                // para evitar discrepancia number/string en cfg.par.includes(String(id))
                const [_idA, _idB, _idC] = p.ids.map(String);
                const rondas = [
                    { par: [_idA, _idB], sol: _idC },
                    { par: [_idA, _idC], sol: _idB },
                    { par: [_idB, _idC], sol: _idA }
                ];
                const cfg = rondas[rondaIdx];
                const ronda = (p.rondaActual ?? 0) + 1;

                html += `
                <div style="background:#11151a; padding:15px 20px; border-radius:8px; margin-bottom:15px;
                            border-left:5px solid #a78bfa; box-shadow:0 4px 6px rgba(0,0,0,0.3);">
                    <div style="display:flex; justify-content:space-between; color:#888; font-size:0.75rem;
                                margin-bottom:10px; font-weight:bold; letter-spacing:1px;">
                        <span>PISTA ${p.pista || index + 1}</span>
                        <span style="color:#a78bfa;">🔄 AUSTRALIANA · R${ronda}</span>
                    </div>
                    <div style="font-size:0.75rem; color:#a78bfa; font-weight:bold; margin-bottom:8px; text-align:center;">
                        🤝 ${cfg.par.map(id => buscarNombreLocal(id)).join(' + ')}
                        <span style="color:#555; margin:0 6px;">vs</span>
                        🎾 ${buscarNombreLocal(cfg.sol)}
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px;">
                        ${p.ids.map(id => {
                            const acum = pts[String(id)] || 0;
                            const esPareja = cfg.par.includes(String(id));
                            const allPts = p.ids.map(i => pts[String(i)] || 0);
                            const maxAcum = Math.max(...allPts);
                            const esLider = acum === maxAcum && maxAcum > 0;
                            const esSoloLider = !esPareja && esLider;
                            return `<div style="background:rgba(167,139,250,0.1); border:1px solid rgba(167,139,250,${esSoloLider?'0.6':'0.2'});
                                                border-radius:6px; padding:8px; text-align:center;">
                                        <div style="font-size:0.65rem; color:#888; margin-bottom:4px;">${buscarNombreLocal(id)}</div>
                                        <div style="font-size:1.2rem; font-weight:900; color:${esSoloLider?'#ff6b35':'#ccff00'};">${acum}</div>
                                        <div style="font-size:0.5rem; color:${esPareja ? '#a78bfa' : '#C5A059'}; font-weight:bold;">${esPareja ? 'PAREJA' : 'SOLO'}${esSoloLider ? ' ⚡' : ''}</div>
                                    </div>`;
                        }).join('')}
                    </div>
                </div>`;
                return;
            }

            html += `
            <div style="background:#11151a; padding:15px 20px; border-radius:8px; margin-bottom:15px;
                        border-left:5px solid #ccff00; box-shadow:0 4px 6px rgba(0,0,0,0.3);">
                <div style="display:flex; justify-content:space-between; color:#888; font-size:0.75rem;
                            margin-bottom:12px; font-weight:bold; letter-spacing:1px;">
                    <span>PISTA ${p.pista || index + 1}</span>
                    <span style="color:#C5A059;">${etiqueta}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;
                            font-size:1.1rem; font-weight:900; color:white;">
                    <div style="flex:1; text-align:left; line-height:1.1;">${eqA}</div>
                    <div style="background:#ccff00; color:#000; padding:6px 15px; border-radius:8px;
                                font-size:${(p.gamified || p.tipo === 'gamificado') ? '0.75rem' : '1.2rem'}; margin:0 15px; box-shadow:0 0 10px rgba(204,255,0,0.3); text-align:center; max-width:120px; overflow:hidden;">
                        ${(p.gamified || p.tipo === 'gamificado') && p.puntosGamificados && p.ids
                            ? p.ids.map(id => {
                                const gNL = (db.jugadores || []).find(j => String(j.id) === String(id))?.nombre?.split(' ')[0] || '?';
                                return `${gNL}:${p.puntosGamificados[id] || 0}`;
                              }).join(' ')
                            : (p.marcador || "0-0")
                        }
                    </div>
                    <div style="flex:1; text-align:right; line-height:1.1;">${eqB}</div>
                </div>
            </div>`;
        });
    }

    // PARTIDOS FINALIZADOS
    if (partidosTerminados.length > 0) {
        html += '<h4 style="color:#888; margin-top:25px; margin-bottom:10px; text-transform:uppercase; font-size:0.85rem; letter-spacing:1px;">✅ RESULTADOS DEL DÍA</h4>';

        [...partidosTerminados].reverse().forEach((p) => {
            // Australiana: layout especial de resultado final
            if (p.tipo === 'equipos3' && p.puntosAustraliana && p.ids) {
                const buscarNombreLocal = id => {
                    const j = (db.jugadores || []).find(x => String(x.id) === String(id));
                    return j ? j.nombre : '???';
                };
                const pts = p.puntosAustraliana;
                const maxPts = Math.max(0, ...p.ids.map(id => pts[String(id)] || 0));

                html += `
                <div style="background:rgba(167,139,250,0.06); padding:15px 20px; border-radius:8px;
                            margin-bottom:10px; border-left:5px solid #a78bfa;">
                    <div style="font-size:0.65rem; color:#a78bfa; font-weight:bold; margin-bottom:8px; letter-spacing:1px;">
                        🔄 AUSTRALIANA · PISTA ${p.pista || ''}
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px;">
                        ${p.ids.map(id => {
                            const acum = pts[String(id)] || 0;
                            const esGanador = acum === maxPts && maxPts > 0;
                            return `<div style="background:rgba(255,255,255,0.04); border:1px solid ${esGanador ? '#ccff00' : 'rgba(255,255,255,0.08)'};
                                                border-radius:6px; padding:8px; text-align:center;">
                                        <div style="font-size:0.65rem; color:#888; margin-bottom:4px;">${buscarNombreLocal(id)}</div>
                                        <div style="font-size:1.3rem; font-weight:900; color:${esGanador ? '#ccff00' : '#aaa'};">${acum}</div>
                                        ${esGanador ? '<div style="font-size:0.55rem; color:#ccff00;">🏆</div>' : ''}
                                    </div>`;
                        }).join('')}
                    </div>
                </div>`;
                return;
            }

            const { eqA, eqB } = resolverEquipos(p, '+');
            const setsA = parseInt(p.juegosA) || 0;
            const setsB = parseInt(p.juegosB) || 0;
            const sinDatos2 = setsA === 0 && setsB === 0;
            const marcadorFin = sinDatos2 && p.marcador && p.marcador !== '0-0'
                ? p.marcador
                : `${setsA} - ${setsB}`;

            // FANS-A FIX: si el partido se decidió solo con tie-break (setsA=0, setsB=0),
            // parsear el ganador del campo p.marcador ("TB 7-4") en lugar de usar setsA/B.
            let ganoA = setsA > setsB;
            let ganoB = setsB > setsA;
            if (sinDatos2 && p.marcador) {
                const tbMatch = p.marcador.match(/TB\s*(\d+)-(\d+)/i);
                if (tbMatch) {
                    const tbA = parseInt(tbMatch[1]);
                    const tbB = parseInt(tbMatch[2]);
                    ganoA = tbA > tbB;
                    ganoB = tbB > tbA;
                }
            }

            html += `
            <div style="background:rgba(255,255,255,0.03); padding:15px 20px; border-radius:8px;
                        margin-bottom:10px; border-left:5px solid #444;">
                <div style="display:flex; justify-content:space-between; align-items:center;
                            font-size:0.95rem; color:#888;">
                    <div style="${ganoA ? 'color:white; font-weight:bold;' : 'opacity:0.7;'} flex:1; text-align:left;">
                        ${eqA}
                    </div>
                    <div style="background:#222; color:#ddd; padding:4px 12px; border-radius:6px;
                                font-weight:bold; margin:0 15px; border:1px solid #444;">
                        ${marcadorFin}
                    </div>
                    <div style="${ganoB ? 'color:white; font-weight:bold;' : 'opacity:0.7;'} flex:1; text-align:right;">
                        ${eqB}
                    </div>
                </div>
            </div>`;
        });
    }

    contenedor.innerHTML = html;
}


// 4. RENDER DE RANKING
