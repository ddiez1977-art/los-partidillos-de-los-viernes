/* ============================================================
   ATP PLATINUM — fans/04-ticker.js
   Ticker de noticias
   ── Refactor: extraído de fans.js (líneas 501-563)
   ============================================================ */

function actualizarTickerFans() {
    const ticker = document.getElementById('ticker-text');
    if (!ticker) return;

    let textoFinal = " 🎾 ATP Platinum Master Tour — Transmisión en Vivo 🎾 ";

    const partidos = db.partidosAbiertos || [];
    if (partidos.length > 0) {
        partidos.forEach(p => {
            if (p.tipo === 'equipos3' && p.ids && p.ids.length === 3) {
                const rondaIdx = (p.rondaActual ?? 0) % 3;
                // FANS-D FIX: normalizar a String
                const [_tA, _tB, _tC] = p.ids.map(String);
                const rondas = [
                    { par: [_tA, _tB], sol: _tC },
                    { par: [_tA, _tC], sol: _tB },
                    { par: [_tB, _tC], sol: _tA }
                ];
                const cfg = rondas[rondaIdx];
                const gN = id => (db.jugadores || []).find(j => String(j.id) === String(id))?.nombre || '?';
                const pts = p.puntosAustraliana || {};
                const acumStr = p.ids.map(id => `${gN(id).split(' ')[0]}:${pts[String(id)] || 0}`).join(' ');
                textoFinal += ` 🔄 P${p.pista} Australiana R${(p.rondaActual ?? 0) + 1} · ${gN(cfg.par[0])}+${gN(cfg.par[1])} vs ${gN(cfg.sol)} · Acum: ${acumStr} ·`;
            } else {
                const gNF = id => (db.jugadores || []).find(j => String(j.id) === String(id))?.nombre?.split(' ')[0] || '?';
                let marcador;
                if ((p.gamified || p.tipo === 'gamificado') && p.puntosGamificados && p.ids) {
                    marcador = p.ids.map(id => `${gNF(id)}:${p.puntosGamificados[id] || 0}`).join(' · ');
                } else {
                    marcador = p.marcador || '0-0';
                }
                const nombre = p.nombres || 'Partido';
                const icono = p.gamified ? '🎮' : p.tipo === 'trios' ? '🔱' : p.tipo === 'asimetrico' ? '⚡' : '🎾';
                textoFinal += ` ${icono} P${p.pista}: ${nombre} [${marcador}] ·`;
            }
        });
    } else if ((db.partidosRecientes || []).length > 0) {
        textoFinal += ' ✅ Últimos resultados: ';
        // ✅ FIX BUG MENOR: db.partidosRecientes puede ser objeto de Firebase — normalizar
        const recientes = Array.isArray(db.partidosRecientes)
            ? db.partidosRecientes
            : Object.values(db.partidosRecientes || {});
        [...recientes].slice(-3).forEach(p => {
            textoFinal += ` ${p.nombres || 'Partido'} → ${p.marcador || 'Fin'} ·`;
        });
    }

    const factorVelocidad = window.innerWidth < 768 ? 0.22 : 0.15;
    const duracion = Math.max(20, textoFinal.length * factorVelocidad);

    // ✅ FIX BUG MEDIO 2: innerText en Safari puede añadir saltos de línea/espacios
    // extras, haciendo que la comparación nunca sea true y el ticker se reinicie
    // en cada update de Firebase, haciéndolo ilegible. Usar dataset es fiable.
    if (ticker.dataset.lastText === textoFinal) return;
    ticker.dataset.lastText = textoFinal;
    ticker.innerText = textoFinal;
    ticker.style.animation = 'none';
    void ticker.offsetWidth;
    ticker.style.animation = `ticker-move ${duracion}s linear infinite`;
    ticker.style.animationPlayState = 'running';
}

// 6. CONTROL DEL BOTÓN DE INSCRIPCIÓN
