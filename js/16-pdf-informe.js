/* ============================================================
   ATP PLATINUM — 16-pdf-informe.js
   Generación de PDF informe de jornada
   ── Refactor: extraído de script.js (líneas [(5430, 5592)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function generarPDFInforme(datos) {
    // ✅ FIX: guard para datos incompletos — la función no se llama actualmente
    // desde ningún onclick activo, pero si se conecta en el futuro, un datos.especialistas
    // undefined lanzaría TypeError inmediato en la línea del .map().
    if (!datos || !datos.especialistas || !datos.ranking) {
        console.warn('⚠️ generarPDFInforme: datos incompletos, abortando.');
        return;
    }
    try {
        const htmlEspecialistas = datos.especialistas.map(esp => `
            <div style="border: 1px solid #eee; padding: 10px; border-radius: 8px; text-align: center;">
                <div style="font-size: 10px; color: #C5A059; font-weight: bold; text-transform: uppercase;">${esp.label}</div>
                <div style="font-size: 16px; font-weight: bold; margin: 5px 0;">${esp.nombre}</div>
                <div style="font-size: 18px; color: #001e3c; font-weight: 900;">${esp.valor}</div>
            </div>
        `).join('');

        let htmlPartidos = '<p style="color: #666; font-style: italic;">No se registraron resultados en esta jornada.</p>';

        if (datos.partidos && datos.partidos.length > 0) {
            let filasTabla = datos.partidos.map((p, i) => {
                const bgInfo = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
                const esGamificado = p.gamified || p.tipo === 'gamificado' || p.esGamificado;

                const getNombre = (id) => {
                    if (!id) return null;
                    const j = db.jugadores.find(x => String(x.id) === String(id));
                    return j ? j.nombre : '???';
                };

                if (esGamificado) {
                    const nombresParticipantes = (p.ids || [])
                        .map(id => getNombre(id))
                        .filter(Boolean)
                        .join(', ') || p.nombres || '---';
                    return `
                        <tr style="background-color: ${bgInfo};">
                            <td colspan="3" style="padding: 15px; border-bottom: 1px solid #eee; text-align: center;">
                                <span style="font-weight: 900; color: #C5A059; text-transform: uppercase; letter-spacing: 1px;">🎮 Modo Gamificado</span><br>
                                <span style="color: #444; font-size: 14px; font-style: italic;">Participantes: ${nombresParticipantes}</span>
                            </td>
                        </tr>
                    `;
                }

                // ✅ Australiana: fila especial con acumulados individuales
                if (p.tipo === 'equipos3' && p.ids && p.ids.length === 3) {
                    const pts = p.puntosAustraliana || {};
                    const maxPts = Math.max(0, ...p.ids.map(id => Number(pts[String(id)] || 0)));
                    const filaAus = p.ids.map(id => {
                        const nombre = getNombre(id) || '???';
                        const acum = Number(pts[String(id)] || 0);
                        const esGanador = acum === maxPts && maxPts > 0;
                        return `<td style="padding:10px; border-bottom:1px solid #eee; text-align:center; font-weight:${esGanador ? '900' : '600'}; color:${esGanador ? '#001e3c' : '#888'}; font-size:12px;">${nombre}<br><span style="font-size:16px; color:${esGanador ? '#001e3c' : '#aaa'};">${acum}</span>${esGanador ? ' 🏆' : ''}</td>`;
                    }).join('');
                    return `
                        <tr style="background-color: ${bgInfo};">
                            <td colspan="3" style="padding:4px 10px; border-bottom:1px solid #eee; text-align:center;">
                                <span style="font-size:10px; color:#a78bfa; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">🔄 Australiana</span>
                            </td>
                        </tr>
                        <tr style="background-color: ${bgInfo};">${filaAus}</tr>
                    `;
                }

                const ids = p.ids || [];
                const modo = resolverModoPartido(p);
                const mitad = modo.mitadEquipo;
                const idsA = ids.slice(0, mitad);
                const idsB = ids.slice(mitad);

                const esTrio = modo.esTrio;
                const esAsimetrico = modo.esAsimetrico;
                const separador = (esTrio || esAsimetrico) ? '+' : '/';
                const eqA = idsA.map(id => getNombre(id)).filter(Boolean).join(separador) || '???';
                const eqB = idsB.map(id => getNombre(id)).filter(Boolean).join(separador) || '???';
                const eqA_html = eqA.replace(/[/+]/g, '<br>');
                const eqB_html = eqB.replace(/[/+]/g, '<br>');

                const marcador = p.marcador && p.marcador !== '0-0'
                    ? p.marcador
                    : `${p.juegosA || 0} - ${p.juegosB || 0}`;

                return `
                    <tr style="background-color: ${bgInfo};">
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; font-size: ${(esTrio || esAsimetrico) ? '11px' : '13px'}; line-height: 1.4;">${eqA_html}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 20px; font-weight: 900; color: #001e3c; background: #f0f7ff; vertical-align: middle; text-align: center;">${marcador}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: left; font-weight: 600; font-size: ${(esTrio || esAsimetrico) ? '11px' : '13px'}; line-height: 1.4;">${eqB_html}</td>
                    </tr>
                `;
            }).join('');

            htmlPartidos = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; text-align: center; table-layout: fixed;">
                    <thead>
                        <tr>
                            <th style="background: #001e3c; color: white; padding: 12px; text-align: right; width: 40%;">Equipo Local</th>
                            <th style="background: #C5A059; color: white; padding: 12px; width: 20%;">Resultado</th>
                            <th style="background: #001e3c; color: white; padding: 12px; text-align: left; width: 40%;">Equipo Visitante</th>
                        </tr>
                    </thead>
                    <tbody>${filasTabla}</tbody>
                </table>
            `;
        }

        const htmlCompleto = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 30px; color: #001e3c; }
                    .header { text-align: center; border-bottom: 4px solid #001e3c; padding-bottom: 15px; margin-bottom: 25px; }
                    .main-box { display: flex; gap: 20px; margin-bottom: 30px; }
                    .card { flex: 1; background: #f9f9f9; padding: 15px; border-radius: 12px; border: 1px solid #C5A059; text-align: center; }
                    .card h3 { margin: 0; font-size: 10px; text-transform: uppercase; color: #C5A059; }
                    .card p { font-size: 22px; font-weight: bold; margin: 5px 0; }
                    .grid-especialistas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                    .section-title { border-left: 5px solid #001e3c; padding-left: 10px; margin: 30px 0 15px 0; color: #001e3c; text-transform: uppercase; font-size: 16px; font-weight: bold; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                </style>
            </head>
            <body onload="setTimeout(function(){ window.print(); }, 800)">
                <div class="header">
                    <h1 style="margin:0; font-size: 24px;">ATP MASTER TOUR PLATINUM</h1>
                    <h2 style="margin:0; color:#C5A059; font-weight:300; font-size: 18px;">INFORME DE JORNADA</h2>
                    <p style="margin: 5px 0;">Fecha: ${datos.fecha}</p>
                </div>
                <div class="main-box">
                    <div class="card"><h3>🏆 Campeón</h3><p>${datos.campeon}</p></div>
                    <div class="card"><h3>👑 MVP</h3><p>${datos.mvp}</p></div>
                </div>
                <div class="section-title">🎯 Especialistas ATP</div>
                <div class="grid-especialistas">${htmlEspecialistas}</div>
                <div class="section-title">📊 Top 5 Ranking</div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: #001e3c; color: white;">
                        <th style="padding: 8px;">Pos</th><th style="padding: 8px;">Jugador</th><th style="padding: 8px;">Puntos</th>
                    </tr></thead>
                    <tbody>
                        ${datos.ranking.map((j, i) => `<tr style="background:${i%2===0?'#fff':'#f9f9f9'}"><td style="padding:8px; text-align:center;">${i+1}</td><td style="padding:8px;">${j.nombre}</td><td style="padding:8px; text-align:center;">${j.puntosTotales} pts</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="section-title">🔥 Resultados</div>
                ${htmlPartidos}
            </body>
            </html>
        `;

        const blob = new Blob([htmlCompleto], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');

    } catch (error) {
        console.error("Error al generar el PDF:", error);
        alert("Error en PDF. La jornada se guardará.");
    }
}

// --- FUNCIÓN PARA MOSTRAR EL HISTORIAL EN CONFIGURACIÓN ---
// Aprovechamos la sección que tengas en Configuración para ver lo guardado
