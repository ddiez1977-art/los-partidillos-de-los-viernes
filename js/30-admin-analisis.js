/* ============================================================
   ATP PLATINUM — 30-admin-analisis.js
   Reset total, análisis avanzado, diagnóstico/reparación de stats, captura WhatsApp
   ── Refactor: extraído de script.js (líneas [(9510, 9913)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// ZONA ADMIN: RESET TOTAL DE LA APP
// ==========================================
// ==========================================
// ACCIÓN NUCLEAR: BORRADO TOTAL BBDD
// ==========================================
function resetAppTotal() {
    const password = prompt("🔒 INICIO DE NUEVA TEMPORADA\n\nIntroduce la contraseña de administrador:");
    if (password === null) return;

    // ✅ FIX: Nunca comparar contra texto plano en el cliente.
    // Usamos un hash simple (djb2) de la contraseña para que no sea
    // legible directamente en las DevTools o en el código fuente.
    // Para cambiar la contraseña: ejecutar hashDjb2("nueva_clave") en consola y 
    // actualizar el valor HASH_PASSWORD_RESET.
    const HASH_PASSWORD_RESET = 460183934; // 

    const hashInput = (str) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & hash; // Forzar entero 32 bits
        }
        return hash;
    };

    if (hashInput(password) !== HASH_PASSWORD_RESET) {
        return alert("❌ Contraseña incorrecta. El sistema permanece intacto.");
    }

    const confirmacion = confirm("⚠️ ¿ESTÁS SEGURO?\n\nSe borrará el historial de jornadas, puntos de ranking, y estadísticas de TODOS los jugadores.\n\nSolo se conservarán los nombres en la cantera. ¡No hay marcha atrás!");
    if (!confirmacion) return;

    try {
        // Todo el bloque interior original intacto desde aquí...
        db.historicoJornadas = [];
        db.fechaEvento       = null;
        db.partidosRecientes = [];
        db.partidosAbiertos  = [];
        db.jugadoresHoy      = [];
        db.ultimoMVP         = null;
        db.mvpIdHoy          = null;
        db.mvpIdsHoy         = [];
        db.mvpIdsJugadores    = [];
        db.mvpIdsEntrenadores = [];
        db.votosJugadoresMVP  = {};
        db.golpesGanadoresHoy = {};

        if (db.jugadores) {
            db.jugadores.forEach(j => {
                j.puntosTotales      = 0;
                j.partidosHistorial  = 0;
                j.partidosJugadosHoy = 0;
                j.rachaVictorias     = 0;
                j.rachaDerrotas      = 0;
                j.estado             = 'descansando';
                j.descansosSeguidos  = 0;
                j.pausado            = false;
                // FIX: nueva temporada -> todos vuelven a ranking (esInvitado=false)
                j.esInvitado         = false;
                j.stats = {
                    ganados: 0, perdidos: 0, totales: 0,
                    juegosFavor: 0, juegosContra: 0,
                    dobles: 0, simples: 0, gamificados: 0, trios: 0, asimetrico: 0, australiana: 0,
                    mvps: 0,
                    aces: 0, winners: 0, smashes: 0,
                    voleas: 0, dejadas: 0, passings: 0
                };
                j.statsAcumuladas = {
                    ace: 0, winner: 0, dejada: 0,
                    volea: 0, smash: 0, passing: 0
                };
                j.habilidades = { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 };
            });
        }

        saveDB();
        localStorage.removeItem('asistenciaRapida');
        localStorage.removeItem('tenisDB');

        alert("✅ ¡NUEVA TEMPORADA INICIADA!\nTodos los contadores están a cero. La aplicación se reiniciará.");
        location.reload();
    } catch (e) {
        alert("❌ Error al intentar reiniciar: " + e.message);
    }
}

// ==========================================
// MOTOR DE ESTADÍSTICAS GLOBALES (ACTUALIZADO)
// ==========================================
// ==========================================
// FUNCIÓN ÚNICA: ANÁLISIS DE RENDIMIENTO PLATINUM
// ==========================================
function renderAnalisisAvanzado() {
    const contTotales = document.getElementById('stat-total-partidos');
    const contGolpes = document.getElementById('stat-total-golpes');
    const contRecords = document.getElementById('records-historicos');
    const contGrafico = document.getElementById('grafico-rendimiento-cantera');
    if (!contTotales || !contGolpes) return;

    const jugadores = Array.isArray(db?.jugadores) ? db.jugadores.filter(j => !j.esInvitado) : [];
    if (jugadores.length === 0) {
        contTotales.innerText = "0";
        contGolpes.innerText = "0";
        if (contRecords)
            contRecords.innerHTML = `<p style="text-align:center; opacity:0.5; padding:20px;">📊 Aún no hay registros en la cantera.</p>`;
        if (contGrafico) contGrafico.innerHTML = "";
        return;
    }

    // ============================================================
    // 1. CÁLCULOS BASE
    // ============================================================
    let totalPartidos = 0;
    let totalGolpes = 0;

    const record = {
        aces:       { nombre: '---', valor: 0 },
        winners:    { nombre: '---', valor: 0 },
        mvps:       { nombre: '---', valor: 0 },
        victorias:  { nombre: '---', valor: 0 },
        puntos:     { nombre: '---', valor: 0 },
        diferencia: { nombre: '---', valor: 0 }
    };

    // ✅ FIX: Precalcular el flag de jornada activa una sola vez fuera del forEach
    // para no llamar a window.jornadaActiva en cada iteración de jugador.
    const jornadaEnCurso = window.jornadaActiva && !window.jornadaCerrada;

    jugadores.forEach(j => {
        const stats = j.stats || {};

        totalPartidos += stats.totales || 0;

        // ✅ FIX: Reemplaza el Math.max anterior.
        // stats.* es el historial permanente integrado al cerrar cada jornada.
        // Durante jornada activa los golpes de hoy aún no están en stats.*,
        // sino en golpesGanadoresHoy — los sumamos por separado.
        // statsAcumuladas queda completamente fuera: es un campo intermedio
        // que puede tener valores residuales en registros históricos antiguos.
        const sumaStatsPermanentes =
            (stats.aces     || 0) +
            (stats.winners  || 0) +
            (stats.smashes  || 0) +
            (stats.voleas   || 0) +
            (stats.dejadas  || 0) +
            (stats.passings || 0);

        let sumaGolpesHoy = 0;
        if (jornadaEnCurso) {
            const golpesHoy = (window.golpesGanadoresHoy || {})[j.id] || {};
            sumaGolpesHoy =
                (golpesHoy.ace     || 0) +
                (golpesHoy.winner  || 0) +
                (golpesHoy.smash   || 0) +
                (golpesHoy.volea   || 0) +
                (golpesHoy.dejada  || 0) +
                (golpesHoy.passing || 0);
        }

        totalGolpes += sumaStatsPermanentes + sumaGolpesHoy;

        // ✅ FIX: Récords de aces/winners usan la misma lógica:
        // stats.* (permanente) + golpesGanadoresHoy (solo si jornada activa).
        // Antes sumaban statsAcumuladas + stats.* lo que podía duplicar
        // golpes de jornadas antiguas no reseteadas.
        const golpesHoyRecords = jornadaEnCurso
            ? ((window.golpesGanadoresHoy || {})[j.id] || {})
            : {};

        const totalAces    = (stats.aces    || 0) + (golpesHoyRecords.ace    || 0);
        const totalWinners = (stats.winners || 0) + (golpesHoyRecords.winner || 0);

        if (totalAces    > record.aces.valor)    record.aces    = { nombre: j.nombre, valor: totalAces };
        if (totalWinners > record.winners.valor) record.winners = { nombre: j.nombre, valor: totalWinners };

        // Récords que solo viven en stats (no cambian con jornada activa)
        if ((stats.mvps    || 0) > record.mvps.valor)     record.mvps      = { nombre: j.nombre, valor: stats.mvps };
        if ((stats.ganados || 0) > record.victorias.valor) record.victorias = { nombre: j.nombre, valor: stats.ganados };
        if ((j.puntosTotales || 0) > record.puntos.valor)  record.puntos    = { nombre: j.nombre, valor: j.puntosTotales };

        const fav = parseInt(stats.juegosFavor)  || 0;
        const con = parseInt(stats.juegosContra) || 0;
        const dif = fav - con;
        if (dif > record.diferencia.valor && dif > 0)
            record.diferencia = { nombre: j.nombre, valor: dif };
    });

    contTotales.innerText = totalPartidos;
    contGolpes.innerText = totalGolpes;

    // ============================================================
    // 2. RÉCORDS GLOBALES
    // ============================================================
    if (contRecords) {
        const difHTML = (record.diferencia.valor > 0 && record.diferencia.nombre !== '---')
            ? `${escapeHtml(record.diferencia.nombre)} (+${record.diferencia.valor})`
            : '---';

        contRecords.innerHTML = `
            <div class="analisis-row">
                <span>🌟 REY DE LOS MVPs:</span>
                <span class="analisis-val">${record.mvps.valor > 0 ? `${escapeHtml(record.mvps.nombre)} (${record.mvps.valor})` : '---'}</span>
            </div>
            <div class="analisis-row">
                <span>📈 MÁS VICTORIAS:</span>
                <span class="analisis-val">${record.victorias.valor > 0 ? `${escapeHtml(record.victorias.nombre)} (${record.victorias.valor})` : '---'}</span>
            </div>
            <div class="analisis-row">
                <span>💰 LÍDER DE PUNTOS:</span>
                <span class="analisis-val">${record.puntos.valor > 0 ? `${escapeHtml(record.puntos.nombre)} (${record.puntos.valor})` : '---'}</span>
            </div>
            <div class="analisis-row">
                <span>🛡️ MAYOR DIF. JUEGOS:</span>
                <span class="analisis-val">${difHTML}</span>
            </div>
            <div class="analisis-row">
                <span>🚀 MÁS ACES:</span>
                <span class="analisis-val">${escapeHtml(record.aces.nombre)} (${record.aces.valor})</span>
            </div>
            <div class="analisis-row" style="border-bottom:none;">
                <span>🔥 MÁS WINNERS:</span>
                <span class="analisis-val">${escapeHtml(record.winners.nombre)} (${record.winners.valor})</span>
            </div>
        `;
    }

    // ============================================================
    // 3. GRÁFICO DE EFECTIVIDAD (Top % de victorias)
    // ============================================================
    if (contGrafico) {
        const top = jugadores
            .filter(j => (j.stats?.totales || 0) >= 3)
            .map(j => {
                const ganados  = Math.max(0, j.stats.ganados  || 0);
                const totales  = Math.max(1, j.stats.totales  || 1); // evitar /0
                // ✅ FIX: ganados puede ser > totales por datos históricos corruptos
                // (bug de doble conteo pre-fix o empates no contabilizados en totales).
                // Normalizar: efectividad máxima real = 100%.
                const ganadosSanos = Math.min(ganados, totales);
                const rate = Math.round((ganadosSanos / totales) * 100);
                const hayCorrupcion = ganados > totales;
                return { nombre: j.nombre, rate, hayCorrupcion, ganados, totales };
            })
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 5);

        if (top.length === 0) {
            contGrafico.innerHTML = `<p style="text-align:center; color:#999; font-size:0.8rem; padding:20px;">Aún no hay suficientes partidos para el análisis.</p>`;
        } else {
            let htmlBars = `<p style="font-size:0.7rem; margin-bottom:8px; opacity:0.7; text-transform:uppercase;">🔥 Top % Efectividad (mín. 3 partidos)</p>`;
            let hayAlgunaCorrpcion = false;
            top.forEach(t => {
                // ✅ FIX: la barra nunca supera 100% (overflow visual roto)
                const barWidth = Math.min(100, Math.max(0, t.rate));
                const badgeCorrupcion = t.hayCorrupcion
                    ? `<span title="Datos corregidos: ${t.ganados} victorias registradas / ${t.totales} partidos — posible doble conteo histórico"
                             style="font-size:0.6rem; color:#e67e22; margin-left:4px;">⚠️</span>`
                    : '';
                if (t.hayCorrupcion) hayAlgunaCorrpcion = true;
                htmlBars += `
                    <div style="margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; align-items:center;">
                            <span style="font-weight:bold; color:var(--atp-navy);">${escapeHtml(t.nombre)}${badgeCorrupcion}</span>
                            <span style="font-weight:900; color:var(--atp-blue);">${t.rate}%</span>
                        </div>
                        <div style="width:100%; background:#e2e8f0; height:10px; border-radius:10px; overflow:hidden; border:1px solid #cbd5e1;">
                            <div style="width:${barWidth}%; background:linear-gradient(90deg, var(--atp-blue), var(--atp-navy)); height:100%; transition:width .5s;"></div>
                        </div>
                    </div>`;
            });
            if (hayAlgunaCorrpcion) {
                htmlBars += `<p style="font-size:0.65rem; color:#e67e22; margin-top:8px; padding:6px 10px;
                                       background:rgba(230,126,34,0.08); border-radius:8px; border-left:3px solid #e67e22;">
                    ⚠️ Algunos jugadores tienen victorias registradas superiores a sus partidos totales (datos históricos).
                    Las barras se muestran corregidas al 100% máximo.
                </p>`;
            }
            contGrafico.innerHTML = htmlBars;
        }
    }

    // ✅ Hook al nuevo módulo de análisis visual avanzado.
    // renderAnalisisVisual está en js/38-analisis-visual.js y añade radar,
    // sparkline, sugerencias, termómetro y combinaciones equilibradas.
    if (typeof renderAnalisisVisual === 'function') {
        try { renderAnalisisVisual(); } catch(e) { console.warn('renderAnalisisVisual:', e); }
    }
}
// ============================================================
// 🔧 HERRAMIENTA DE DIAGNÓSTICO Y REPARACIÓN DE STATS
// ============================================================
/**
 * diagnosticarYRepararStats()
 * Detecta jugadores con datos corruptos (ganados > totales, totales < 0, etc.)
 * y ofrece reparar automáticamente igualando ganados a totales cuando sea necesario.
 * Llamada desde el botón de análisis avanzado.
 */
function diagnosticarYRepararStats() {
    const jugadores = (db.jugadores || []).filter(j => !j.esInvitado && j.stats);
    const problemas = [];

    jugadores.forEach(j => {
        const s = j.stats;
        const issues = [];
        if ((s.ganados || 0) > (s.totales || 0))
            issues.push(`ganados (${s.ganados}) > totales (${s.totales})`);
        if ((s.perdidos || 0) > (s.totales || 0))
            issues.push(`perdidos (${s.perdidos}) > totales (${s.totales})`);
        if ((s.ganados || 0) + (s.perdidos || 0) > (s.totales || 0) + 5)
            // +5 de margen: en australiana el ganador puede no contar "ganado" por empate
            issues.push(`ganados+perdidos (${(s.ganados||0)+(s.perdidos||0)}) >> totales (${s.totales})`);
        if (issues.length) problemas.push({ j, issues });
    });

    if (problemas.length === 0) {
        mostrarToastGlobal('✅ Todos los stats son consistentes. No hay datos a reparar.', 3000);
        return;
    }

    const resumen = problemas.map(p =>
        `• ${p.j.nombre}: ${p.issues.join(', ')}`
    ).join('\n');

    if (!confirm(
        `⚠️ Se encontraron ${problemas.length} jugador(es) con stats inconsistentes:\n\n${resumen}\n\n` +
        `¿Reparar automáticamente?\n` +
        `• ganados → Math.min(ganados, totales)\n` +
        `• perdidos → Math.min(perdidos, totales)\n\n` +
        `Esto NO modifica puntosTotales de ranking, solo los contadores de victorias/derrotas.`
    )) return;

    problemas.forEach(({ j }) => {
        const s = j.stats;
        const totalesSanos = Math.max(0, s.totales || 0);
        s.ganados  = Math.min(Math.max(0, s.ganados  || 0), totalesSanos);
        s.perdidos = Math.min(Math.max(0, s.perdidos || 0), totalesSanos);
    });

    saveDB();
    mostrarToastGlobal(`✅ ${problemas.length} jugador(es) reparados. Stats guardados en Firebase.`, 3500);

    // Refrescar la vista de análisis
    if (typeof renderAnalisisAvanzado === 'function') renderAnalisisAvanzado();
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
}

// CAPTURA DE PANTALLA PARA COMPARTIR
// ==========================================
// CAPTURA Y ENVÍO A WHATSAPP
// ==========================================
async function descargarCapturaAnalisis() {
    if (typeof html2canvas === 'undefined') return alert("❌ Librería no cargada.");

    const seccion = document.getElementById('analisis') || document.getElementById('sec-analisis');

if (!seccion) {
    console.error("❌ Error: No se encontró el contenedor de análisis en el HTML.");
    return alert("❌ No se encuentra la sección. Verifica que el ID en tu index.html sea id='analisis'");
}
    const btn = event?.target || document.activeElement;
    btn.innerText = "⏳ PROCESANDO...";
    
    // 1. Generamos la imagen con alta nitidez
    const canvas = await html2canvas(seccion, {
        backgroundColor: "#f4f7f6",
        scale: 3,
        useCORS: true
    });

    // 2. Descargamos la imagen (el usuario la tendrá lista para adjuntar)
    const imagen = canvas.toDataURL("image/png");
    const enlace = document.createElement('a');
    enlace.download = `ATP_Analisis_${new Date().toLocaleDateString()}.png`;
    enlace.href = imagen;
    enlace.click();

    // WA-FIX 5: construir el mensaje desde db.jugadores en lugar de
    // selectores CSS frágiles (.analisis-row:nth-child(N)) que se rompen
    // si cambia el layout del análisis.
    const _jugRanking = [...(db.jugadores || [])].filter(j => !j.esInvitado);
    const _topMVP   = [..._jugRanking].sort((a,b) => (b.stats?.mvps||0)-(a.stats?.mvps||0))[0];
    const _topWins  = [..._jugRanking].sort((a,b) => (b.stats?.ganados||0)-(a.stats?.ganados||0))[0];
    const _topPts   = [..._jugRanking].sort((a,b) => (b.puntosTotales||0)-(a.puntosTotales||0))[0];
    const _totalPartidos = _jugRanking.reduce((s,j) => s+(j.stats?.totales||0), 0);

    const mensajeWA = `🎾 *ATP MASTER TOUR - ANÁLISIS GLOBAL* 📊\n\n` +
        `👑 *Rey de los MVPs:* ${_topMVP ? _topMVP.nombre + ' (' + (_topMVP.stats?.mvps||0) + ' MVPs)' : '---'}\n` +
        `🏆 *Más Victorias:* ${_topWins ? _topWins.nombre + ' (' + (_topWins.stats?.ganados||0) + ' victorias)' : '---'}\n` +
        `📊 *Líder Ranking:* ${_topPts ? _topPts.nombre + ' — ' + (_topPts.puntosTotales||0) + ' pts' : '---'}\n` +
        `🎾 *Total partidos disputados:* ${Math.round(_totalPartidos/2)} aprox.\n\n` +
        `👇 _Adjunto la imagen con el desglose completo de la cantera._`;

    // 4. Copiamos el texto al portapapeles automáticamente
    try {
        await navigator.clipboard.writeText(mensajeWA);
        
        // WA-FIX 4: usar el mensaje rico en el link de WhatsApp,
        // no el texto genérico. El usuario pega el texto y adjunta la imagen.
        const waUrl = `https://wa.me/?text=${encodeURIComponent(mensajeWA)}`;
        
        if(confirm("✅ Imagen descargada y texto copiado.\n\nAhora se abrirá WhatsApp. Solo tienes que seleccionar el grupo, PEGAR el texto y ADJUNTAR la última imagen de tu galería/descargas.\n\n¿Abrir WhatsApp?")) {
            window.open(waUrl, '_blank');
        }
    } catch (err) {
        console.error("Error al copiar texto:", err);
    }

    btn.innerText = "📸 GENERAR IMAGEN PARA WHATSAPP";
}

