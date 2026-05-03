/* ============================================================
   ATP PLATINUM — 28-estadisticas-historicas.js
   Motor de estadísticas históricas, pausa jugador en directo, exportar JSON
   ── Refactor: extraído de script.js (líneas [(8898, 9120)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// MOTOR DE ESTADÍSTICAS HISTÓRICAS
// ==========================================
function actualizarEstadisticasJugadores() {
    if (window._estadisticasJornadaYaGuardadas) {
        console.warn("⚠️ actualizarEstadisticasJugadores() ya se ejecutó esta jornada. Ignorando llamada duplicada.");
        return;
    }
    window._estadisticasJornadaYaGuardadas = true; 

    // MVPs: soporte multi — array con fallback a string legacy
    const mvpIdsFinalesStats = Array.isArray(window.mvpIdsHoy) && window.mvpIdsHoy.length
        ? window.mvpIdsHoy.map(String)
        : (window.mvpIdHoy ? [String(window.mvpIdHoy)] : []);

    (window.jugadoresHoy || []).forEach(jHoy => {
        let perfil = db.jugadores.find(p => p.id.toString() === jHoy.id.toString());
        if (!perfil) return;

        if (!perfil.stats) {
            perfil.stats = {
                ganados: 0, perdidos: 0, totales: 0,
                dobles: 0, simples: 0, gamificados: 0, trios: 0, asimetrico: 0, australiana: 0,
                aces: 0, winners: 0, smashes: 0, voleas: 0, dejadas: 0, passings: 0,
                mvps: 0, juegosFavor: 0, juegosContra: 0
            };
        }
        if (!perfil.stats.trios) perfil.stats.trios = 0;

        // ✅ FIX BUG 1: stats.mvps NO se incrementa aquí.
        // confirmarMVPJugadores() y asignarMVPEntrenadores() ya lo incrementan
        // en tiempo real cuando el admin asigna el MVP. Hacerlo aquí también
        // lo duplicaba en cada cierre de jornada, inflando la vitrina de MVPs.

        const partidosJugadosHoy = (window.partidosFinalizadosHoy || []).filter(p =>
            // FIX-DOBLE-CONTEO: excluir partidos admin (esAdmin:true) porque
            // aplicarPuntosPartido ya les aplicó stats al registrarlos.
            // Solo iterar los partidos jugados en vivo (sin esAdmin).
            !p.esAdmin &&
            p.ids && p.ids.map(id => id.toString()).includes(jHoy.id.toString())
        );

        partidosJugadosHoy.forEach(p => {
            // ✅ FIX INVITADO-STATS: invitados participan en la sesión pero no
            // acumulan estadísticas de ranking (ganados/perdidos/totales/juegos).
            // Solo los jugadores de ranking tienen historial competitivo real.
            const esInv = !!perfil.esInvitado;

            const tipo = p.tipo
                ? p.tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                : 'individual';

            if (!esInv) {
                perfil.stats.totales = (perfil.stats.totales || 0) + 1;

                if (tipo === 'dobles') {
                    perfil.stats.dobles = (perfil.stats.dobles || 0) + 1;
                } else if (tipo === 'trios') {
                    perfil.stats.trios = (perfil.stats.trios || 0) + 1;
                } else if (tipo === 'asimetrico') {
                    perfil.stats.asimetrico = (perfil.stats.asimetrico || 0) + 1;
                } else if (tipo === 'equipos3') {
                    // ✅ FIX BUG 2: la rama de australiana estaba duplicada —
                    // la primera sólo contaba stats.australiana y terminaba;
                    // la segunda (con lógica de victorias/juegos) era código muerto
                    // porque el else-if nunca se alcanzaba. Fusionadas aquí.
                    perfil.stats.australiana = (perfil.stats.australiana || 0) + 1;
                    const pts = p.puntosAustraliana || {};
                    const maxPts = Math.max(0, ...Object.values(pts).map(Number));
                    const numMaximos = Object.values(pts).filter(v => Number(v) === maxPts).length;
                    const esEmpateAus = numMaximos > 1 && maxPts > 0;
                    const totalJuegosAus = Object.values(pts).reduce((s, v) => s + Number(v || 0), 0);
                    const misJuegosAus = Number(pts[jHoy.id.toString()] || 0);
                    const esMaximoAus  = misJuegosAus === maxPts && maxPts > 0;
                    if (totalJuegosAus > 0) {
                        perfil.stats.juegosFavor  = (perfil.stats.juegosFavor  || 0) + misJuegosAus;
                        perfil.stats.juegosContra = (perfil.stats.juegosContra || 0) + (totalJuegosAus - misJuegosAus);
                        if (!esEmpateAus) {
                            if (esMaximoAus) perfil.stats.ganados  = (perfil.stats.ganados  || 0) + 1;
                            else             perfil.stats.perdidos = (perfil.stats.perdidos || 0) + 1;
                        }
                    }
                } else if (tipo === 'gamificado' || p.gamified) {
                    perfil.stats.gamificados = (perfil.stats.gamificados || 0) + 1;
                    // ✅ Registrar ganador del gamificado en stats (para efectividad en análisis)
                    if (p.puntosGamificados && Object.keys(p.puntosGamificados).length > 0) {
                        const _allGam = Object.values(p.puntosGamificados).map(Number);
                        const _maxGam2 = Math.max(0, ..._allGam);
                        const _misGam = Number(p.puntosGamificados[jHoy.id.toString()] || 0);
                        const _numMax2 = _allGam.filter(v => v === _maxGam2).length;
                        if (_maxGam2 > 0 && _numMax2 === 1) {
                            // Solo hay un ganador claro
                            if (_misGam === _maxGam2) perfil.stats.ganados  = (perfil.stats.ganados  || 0) + 1;
                            else                       perfil.stats.perdidos = (perfil.stats.perdidos || 0) + 1;
                        }
                    }
                } else {
                    perfil.stats.simples = (perfil.stats.simples || 0) + 1;
                }

                const esCompetitivo = !p.gamified && tipo !== 'gamificado' && tipo !== 'equipos3';

                if (esCompetitivo) {
                    const idsArray = p.ids.map(id => id.toString());
                    // ✅ FIX BUG STATS: mismo parche que finalizarPartido.
                    // Sin Math.floor, en 3v3 la división da 3/2=1.5 — funciona por azar.
                    // En asimétrico 3v2 da 5/2=2.5 — el jugador en índice 2 queda como equipo B.
                    // Ahora usamos tamanoEquipoA si está guardado, con fallback a floor.
                    const _mitad = p.tamanoEquipoA != null
                        ? Number(p.tamanoEquipoA)
                        : Math.floor(idsArray.length / 2);
                    const esEquipoA = idsArray.indexOf(jHoy.id.toString()) < _mitad;
                    const jA = parseInt(p.juegosA || 0);
                    const jB = parseInt(p.juegosB || 0);
                    const misJuegos = esEquipoA ? jA : jB;
                    const susJuegos = esEquipoA ? jB : jA;

                    perfil.stats.juegosFavor  = (perfil.stats.juegosFavor  || 0) + misJuegos;
                    perfil.stats.juegosContra = (perfil.stats.juegosContra || 0) + susJuegos;

                    if (misJuegos > susJuegos) {
                        perfil.stats.ganados = (perfil.stats.ganados || 0) + 1;
                    } else if (misJuegos < susJuegos) {
                        perfil.stats.perdidos = (perfil.stats.perdidos || 0) + 1;
                    }
                }
            } // fin !esInv — stats competitivas
        });

        // ✅ FIX: Integramos golpesGanadoresHoy en stats permanentes Y limpiamos
        // statsAcumuladas para evitar doble conteo en verFicha().
        // verFicha() lee: statsAcumuladas.ace + stats.aces
        // Sin este fix: statsAcumuladas.ace tenía los golpes de hoy Y stats.aces
        // también los recibía aquí → se sumaban dos veces en verFicha().
        // ✅ FIX: String(jHoy.id) para coincidir con las claves normalizadas por modG/votarGolpe.
        // jHoy.id puede ser number si vino de Firebase; sin String() la clave no matchea
        // y los golpes del día nunca se integran en stats permanentes al cerrar jornada.
        const _idGolpesStr = String(jHoy.id);
        if (window.golpesGanadoresHoy && window.golpesGanadoresHoy[_idGolpesStr]) {
            const g = window.golpesGanadoresHoy[_idGolpesStr];

            perfil.stats.aces     = (perfil.stats.aces     || 0) + (g['ace']     || 0);
            perfil.stats.winners  = (perfil.stats.winners  || 0) + (g['winner']  || 0);
            perfil.stats.smashes  = (perfil.stats.smashes  || 0) + (g['smash']   || 0);
            perfil.stats.voleas   = (perfil.stats.voleas   || 0) + (g['volea']   || 0);
            perfil.stats.dejadas  = (perfil.stats.dejadas  || 0) + (g['dejada']  || 0);
            perfil.stats.passings = (perfil.stats.passings || 0) + (g['passing'] || 0);

            // ✅ Una vez integrados en stats, reseteamos statsAcumuladas de hoy
            // para que verFicha() no los vuelva a contar desde ahí.
            if (!perfil.statsAcumuladas) perfil.statsAcumuladas = {};
            perfil.statsAcumuladas.ace     = 0;
            perfil.statsAcumuladas.winner  = 0;
            perfil.statsAcumuladas.smash   = 0;
            perfil.statsAcumuladas.volea   = 0;
            perfil.statsAcumuladas.dejada  = 0;
            perfil.statsAcumuladas.passing = 0;
        }

        // Nivel global (lógica original intacta)
        if (perfil.habilidades) {
            const habs = Object.values(perfil.habilidades);
            const suma = habs.reduce((a, b) => a + b, 0);
            perfil.nivel = (suma / habs.length).toFixed(1);
        }
    });

    saveDB();
    console.log("📈 Sincronización completa: Stats, Ranking y Evolución Técnica guardados.");
}


// ==========================================
// PAUSAR / DESPAUSAR JUGADORES EN DIRECTO
// ==========================================
function togglePausaJugador(id) {
    const j = window.jugadoresHoy.find(x => x.id.toString() === id.toString());
    if (j) {
        j.pausado = !j.pausado;
        saveDB();
        renderPresentes(); // Recarga la lista para mostrar el cambio
        
        if (j.pausado) {
            console.log(`⏸️ ${j.nombre} se ha ido o está pausado.`);
        } else {
            console.log(`▶️ ${j.nombre} vuelve a estar disponible.`);
        }
    }
}

// ==========================================
// BACKUP: EXPORTAR BASE DE DATOS COMPLETA
// ==========================================
function exportarHistorialJSON() {
    // 1. Comprobar si existe la base de datos
    if (!db) {
        return alert("⚠️ No hay base de datos para exportar.");
    }

    // 2. Convertir TODA la BBDD a formato texto
    const datosTexto = JSON.stringify(db, null, 2);
    
    // 3. Crear el archivo descargable
    const blob = new Blob([datosTexto], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const enlaceDescarga = document.createElement("a");
    enlaceDescarga.href = url;
    
    // Nombre del archivo con la fecha (ej: ATP_Backup_Completo_2024-05-12.json)
    const fechaFormateada = new Date().toISOString().split('T')[0];
    enlaceDescarga.download = `ATP_Backup_Completo_${fechaFormateada}.json`;
    
    document.body.appendChild(enlaceDescarga);
    enlaceDescarga.click(); 
    
    // 4. Limpieza
    document.body.removeChild(enlaceDescarga);
    URL.revokeObjectURL(url);
    
    alert("✅ Copia de seguridad COMPLETA descargada con éxito.");
}

