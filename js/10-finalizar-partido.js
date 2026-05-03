/* ============================================================
   ATP PLATINUM — 10-finalizar-partido.js
   Finalizar partido (núcleo gamificado/cierre), preselección individual, puntos gamificados
   ── Refactor: extraído de script.js (líneas [(3597, 4147)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function finalizarPartido(index) {
    const partidoOriginal = window.partidosAbiertos[index];
    if (!partidoOriginal) return alert("❌ Partido no encontrado.");

    // ✅ FIX BUG CRÍTICO 1: Guard anti-doble-finalización.
    // Sin esto, un doble tap en móvil ejecuta finalizarPartido() dos veces sobre
    // el mismo objeto — los puntos se suman dos veces al ranking y el partido
    // aparece duplicado en el historial. El flag se elimina al eliminar el partido
    // del array (splice abajo), así no persiste en Firebase.
    if (partidoOriginal._finalizando) return;
    partidoOriginal._finalizando = true;

    const partido = JSON.parse(JSON.stringify(partidoOriginal));

    // Reconstrucción de nombres usando helper centralizado
    if (!partido.nombres || String(partido.nombres).includes("undefined") || partido.nombres === "") {
        const { eqA, eqB } = resolverNombresEquipos(partido);
        partido.nombres = eqB ? `${eqA} vs ${eqB}` : eqA;
    }

    let resultadoFinal = "";

    if (partido.gamified || partido.tipo === 'gamificado') {
        let puntosMarcador = [];
        const todosLosPuntos = partido.ids.map(id =>
            (partido.puntosGamificados && partido.puntosGamificados[id]) || 0
        );
        const maxPtsJuego = Math.max(0, ...todosLosPuntos);

        // Pre-calcular ranking pts para mostrar en el confirm
        const _numMaxGam = todosLosPuntos.filter(v => v === maxPtsJuego).length;
        const _esEmpateGam = _numMaxGam > 1 && maxPtsJuego > 0;

        const desglose = partido.ids.map(id => {
            const j = db.jugadores.find(x => String(x.id) === String(id));
            const pts = (partido.puntosGamificados && partido.puntosGamificados[id]) || 0;
            let rk;
            if (maxPtsJuego === 0) rk = 1;
            else if (_esEmpateGam && pts === maxPtsJuego) rk = 2; // Empate en el máximo
            else if (pts === maxPtsJuego) rk = 3;
            else if (pts === 0) rk = 0;
            else { rk = Math.max(1, Math.round((pts / maxPtsJuego) * 3)); if (rk >= 3) rk = 2; }
            return `${j?.nombre || '???'}: ${pts}pts juego → +${rk}pts ranking`;
        }).join('\n');

        if (!confirm(`🎮 Finalizar entrenamiento\n\n${desglose}\n\n¿Confirmar?`)) {
            partidoOriginal._finalizando = false;
            return;
        }

        partido.ids.forEach((id, idx) => {
            const j = db.jugadores.find(x => String(x.id) === String(id));
            const jHoy = window.jugadoresHoy.find(x => String(x.id) === String(id));
            const puntosJuego = todosLosPuntos[idx];
            puntosMarcador.push(puntosJuego);

            if (j) {
                // ✅ NUEVO: Conversión proporcional al ranking estándar (max = 3 pts).
                // Antes: los puntos brutos del juego se sumaban directamente al ranking
                // (ej: ganar 7 pts en el juego → +7 al ranking), inflando artificialmente
                // la clasificación respecto al resto de modos (máximo 3 pts por partido).
                // Ahora: si el máximo del juego son 7 pts, el que tiene 7 → +3pts,
                // el que tiene 4 → +round(4/7*3)=2pts, el que tiene 1 → +0pts (mínimo 1 si jugó).
                let ptsRanking;
                if (maxPtsJuego === 0) {
                    ptsRanking = 1;
                } else if (_esEmpateGam && puntosJuego === maxPtsJuego) {
                    ptsRanking = 2; // Empate en el máximo → como empate estándar
                } else if (puntosJuego === maxPtsJuego) {
                    ptsRanking = 3;
                } else if (puntosJuego === 0) {
                    ptsRanking = 0;
                } else {
                    ptsRanking = Math.max(1, Math.round((puntosJuego / maxPtsJuego) * 3));
                    if (ptsRanking >= 3) ptsRanking = 2;
                }

                // ✅ Invitados participan en el partido pero no acumulan puntos de ranking
                if (!j.esInvitado) {
                    j.puntosTotales = (j.puntosTotales || 0) + ptsRanking;
                }
                if (jHoy) {
                    jHoy.estado = 'descansando';
                    jHoy.descansosSeguidos = 0;
                    // ✅ FIX BUG 6: los gamificados no generan lógica de venganza.
                    // Sin este reset, perdioUltimo conservaba su valor anterior
                    // y podía activar un partido de venganza fantasma.
                    jHoy.perdioUltimo = false;
                }
            }
        });
        resultadoFinal = "🎮 " + puntosMarcador.join("-");

    } else {
        const jA = parseInt(partido.juegosA) || 0;
        const jB = parseInt(partido.juegosB) || 0;

        // ── Tie-break: incluir puntos en el resultado final ──────────
        const tbTexto = partido.tiebreak
            ? ` (TB ${partido.tbPuntosA || 0}-${partido.tbPuntosB || 0})`
            : '';

        if (!confirm(`🏁 Finalizar: ${partido.nombres}\nResultado: ${jA}-${jB}${tbTexto}`)) {
            partidoOriginal._finalizando = false;
            return;
        }
        resultadoFinal = `${jA}-${jB}${tbTexto}`;

        // Para el ranking: si hay tie-break, el ganador es quien ganó el TB
        const tbA = partido.tbPuntosA || 0;
        const tbB = partido.tbPuntosB || 0;
        const estadoTb = partido.tiebreak ? calcularEstadoTiebreak(tbA, tbB) : null;

        // Determinar ganador considerando tie-break
        let ganaA, esEmpate, marcadorVacio;
        if (estadoTb && estadoTb.ganador) {
            // Hay ganador claro en TB → lo usa independientemente de jA/jB
            ganaA        = estadoTb.ganador === 'A';
            esEmpate     = false;
            marcadorVacio = false;
        } else if (partido.tiebreak && jA === 0 && jB === 0) {
            // ✅ FIX TIE-BREAK SOLO: partido jugado solo a TB sin ganador declarado aún.
            // jA=0, jB=0 → ganaA = false → equipo B "gana" falsamente (false===false=true).
            // Tratamos como empate si hay puntos TB, o como vacío si no hay nada.
            if (tbA > 0 || tbB > 0) {
                // Hay puntos pero sin ganador: quien lleva más puntos gana provisionalmente
                if (tbA !== tbB) {
                    ganaA        = tbA > tbB;
                    esEmpate     = false;
                    marcadorVacio = false;
                } else {
                    ganaA        = false;
                    esEmpate     = true;
                    marcadorVacio = false;
                }
            } else {
                ganaA        = false;
                esEmpate     = false;
                marcadorVacio = true;
            }
        } else {
            ganaA        = jA > jB;
            esEmpate     = jA === jB && (jA > 0 || jB > 0);
            marcadorVacio = jA === 0 && jB === 0 && (!partido.tiebreak || (tbA === 0 && tbB === 0));
        }

        // ✅ FIX equipos3 (Australiana): lógica de puntuación completamente diferente.
        // Los puntos de ranking se calculan desde puntosAustraliana (juegos acumulados
        // individualmente en todas las rondas), no desde juegosA/juegosB del binario.
        const esEquipos3 = partido.tipo === 'equipos3';

        if (esEquipos3 && partido.ids.length === 3) {
            // Registrar la ronda en curso si quedó sin rotar
            const [idA, idB, idC] = partido.ids.map(String);
            const rondas = [
                { pareja: [idA, idB], solo: idC },
                { pareja: [idA, idC], solo: idB },
                { pareja: [idB, idC], solo: idA }
            ];
            const rondaFinal = (partido.rondaActual ?? 0) % 3;
            const cfgFinal = rondas[rondaFinal];

            if (!partido.puntosAustraliana) partido.puntosAustraliana = { [idA]: 0, [idB]: 0, [idC]: 0 };
            // Incluir el marcador de la ronda en curso si no es 0-0
            if (jA > 0 || jB > 0) {
                cfgFinal.pareja.forEach(id => {
                    partido.puntosAustraliana[id] = (partido.puntosAustraliana[id] || 0) + jA;
                });
                partido.puntosAustraliana[cfgFinal.solo] = (partido.puntosAustraliana[cfgFinal.solo] || 0) + jB;
            }

            const pts = partido.puntosAustraliana;
            const maxPts = Math.max(pts[idA] || 0, pts[idB] || 0, pts[idC] || 0);
            const totalJuegos = Object.values(pts).reduce((s, v) => s + (v || 0), 0);

            partido.ids.forEach(id => {
                const j = db.jugadores.find(x => String(x.id) === String(id));
                const jHoy = (window.jugadoresHoy || []).find(x => String(x.id) === String(id));
                if (!j) return;

                const misJuegos = pts[String(id)] || 0;
                const esMaximo  = misJuegos === maxPts && maxPts > 0;
                // Empate: varios comparten el máximo
                const numMaximos = Object.values(pts).filter(v => v === maxPts).length;
                const esEmpateAus = numMaximos > 1;

                // ✅ Bonus David vs Goliat en australiana:
                // Condiciones: único ganador (no empate) + ganó más juegos siendo solo que como pareja.
                // Primero intentamos usar juegosSoloAustraliana (si se registraron).
                // Fallback: si el ganador coincide con el solo de la última ronda activa.
                const soloAcum = partido.juegosSoloAustraliana || {};
                const juegosDeSolo = Number(soloAcum[id] || 0);
                const juegosDePareja = Math.max(0, misJuegos - juegosDeSolo);
                const haySoloData = Object.values(soloAcum).some(v => Number(v) > 0);
                let _ganadorEsSolo;
                if (haySoloData) {
                    // Dato explícito: ganó más como solo que como pareja
                    _ganadorEsSolo = esMaximo && !esEmpateAus && juegosDeSolo > juegosDePareja;
                } else {
                    // Fallback: si el ganador es el solo de la última ronda activa
                    _ganadorEsSolo = esMaximo && !esEmpateAus
                        && String(cfgFinal.solo) === String(id);
                }
                const bonusSolo = _ganadorEsSolo ? 1 : 0;

                // Puntos de ranking: +3 ganador (+1 bonus si ganó siendo solo), +2 empate, +1 participación
                // ✅ Invitados no acumulan puntos en australiana
                if (totalJuegos > 0 && !j.esInvitado) {
                    if (esEmpateAus && esMaximo)    j.puntosTotales = (j.puntosTotales || 0) + 2;
                    else if (esMaximo)               j.puntosTotales = (j.puntosTotales || 0) + 3 + bonusSolo;
                    else                             j.puntosTotales = (j.puntosTotales || 0) + 1;
                }

                if (jHoy) {
                    jHoy.estado = 'descansando';
                    jHoy.descansosSeguidos = 0;
                    // En australiana solo el ganador claro activa venganza para los demás
                    jHoy.perdioUltimo = totalJuegos > 0 && !esMaximo && !esEmpateAus;
                }

                // Rachas: solo si hay un ganador claro y el jugador es de ranking
                // ✅ FIX-RACHA-INV: invitados no acumulan rachas (no compiten por ranking)
                if (totalJuegos > 0 && !esEmpateAus && !j.esInvitado) {
                    if (esMaximo) {
                        j.rachaVictorias = (j.rachaVictorias || 0) + 1;
                        j.rachaDerrotas = 0;
                    } else {
                        j.rachaDerrotas = (j.rachaDerrotas || 0) + 1;
                        j.rachaVictorias = 0;
                    }
                }
            });

            // Construir marcador legible para el historial
            const gN = id => db.jugadores.find(x => String(x.id) === id)?.nombre || id;
            resultadoFinal = partido.ids.map(id => `${gN(id)}:${pts[id] || 0}`).join(' · ');

            window.puntosPartidoYaAplicados = true;

            // ✅ Verificar venganza australiana: si era partido de venganza y hay ganador claro
            if (partido.esVenganza && totalJuegos > 0 && typeof verificarVenganza === 'function') {
                // Construimos un objeto compatible: ganadores = los que tienen maxPts
                const idsGanadoresAus = partido.ids.filter(id => (pts[String(id)] || 0) === maxPts && maxPts > 0);
                const numMaxAus = idsGanadoresAus.length;
                if (numMaxAus === 1) { // solo si hay ganador único
                    idsGanadoresAus.forEach(idG => {
                        const jHoyG = window.jugadoresHoy.find(j => j.id.toString() === idG.toString());
                        if (jHoyG && jHoyG.perdioUltimo) {
                            if (!window.logVenganzasTV) window.logVenganzasTV = [];
                            window.logVenganzasTV.push(`🔥 ¡VENGANZA! ${jHoyG.nombre} ha recuperado el honor.`);
                            jHoyG.perdioUltimo = false;
                            if (typeof actualizarMarquesinaTV === 'function')
                                actualizarMarquesinaTV(`🔥 ¡VENGANZA! ${jHoyG.nombre} ha recuperado el honor.`);
                        }
                    });
                }
            }

            window.partidosFinalizadosHoy.push({
                ...partido,
                marcador: resultadoFinal,
                fin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            window.partidosAbiertos.splice(index, 1);
            saveDB();
            if (typeof renderHistorialHoy === 'function') renderHistorialHoy();
            if (typeof renderResultadosHoy === 'function') renderResultadosHoy();
            if (typeof renderPistas === 'function') renderPistas();
            if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
            if (typeof renderPresentes === 'function') renderPresentes();
            if (typeof renderRanking === 'function') renderRanking();
            if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();
            if (typeof sincronizarTV === 'function') sincronizarTV();
            console.log(`✅ Australiana finalizada: ${resultadoFinal}`);
            return; // ← salida temprana, no ejecutar el bloque estándar
        }

        const _mitadEquipo = partido.tamanoEquipoA != null
            ? Number(partido.tamanoEquipoA)
            : Math.floor(partido.ids.length / 2);

        // ✅ NUEVO: Bonus "David vs Goliat" — equipo más pequeño que gana recibe +1pt extra.
        // Aplica cuando los equipos son de tamaño diferente (asimétrico 2v1, 3v2, etc.)
        const _tamA = _mitadEquipo;
        const _tamB = partido.ids.length - _mitadEquipo;
        const _hayDesequilibrio = _tamA !== _tamB;
        // El equipo más pequeño: si A es menor, A es el pequeño; si B es menor, B
        const _equipoPequenoEsA = _tamA < _tamB;

        // ✅ FIX BUG VENGANZA: capturar perdioUltimo ANTES de que el bucle
        // forEach pise el valor. verificarVenganza() necesita leer el flag
        // ORIGINAL (¿el ganador venía con hambre de venganza?) — si lo hace
        // después del bucle, ya está limpio y nunca se pinta el log.
        if (partido.esVenganza && typeof verificarVenganza === 'function') {
            verificarVenganza({ ...partido, juegosA: jA, juegosB: jB });
        }

        partido.ids.forEach((id, i) => {
            const j = db.jugadores.find(x => String(x.id) === String(id));
            const jHoy = (window.jugadoresHoy || []).find(x => String(x.id) === String(id));
            if (!j) return;

            const esEquipoA = i < _mitadEquipo;
            const haGanado = esEquipoA === ganaA;

            let ptosBase = haGanado ? 3 : (esEmpate ? 2 : 1);

            // Bonus David vs Goliat: +1pt si ganaste siendo del equipo más pequeño
            if (_hayDesequilibrio && haGanado && !esEmpate && !marcadorVacio) {
                const esEquipoPequeno = esEquipoA ? _equipoPequenoEsA : !_equipoPequenoEsA;
                if (esEquipoPequeno) ptosBase += 1; // +1pt bonus por vencer en desventaja
            }

            // ✅ Invitados no acumulan puntos en asimétrico/tríos
            if (!j.esInvitado) {
                j.puntosTotales = (j.puntosTotales || 0) + ptosBase;
            }

            // Stats de tríos (lógica original intacta)
            // ✅ FIX: Eliminar este bloque.
// actualizarEstadisticasJugadores() ya gestiona stats.trios al cerrar jornada.
// if (haGanado && (partido.tipo === 'trios' || partido.ids.length === 6)) {
//     if (!j.stats) j.stats = {};
//     j.stats.trios = (j.stats.trios || 0) + 1;
// }

            if (jHoy) {
                jHoy.estado = 'descansando';
                jHoy.descansosSeguidos = 0;
                // ✅ FIX: Con marcador 0-0 nadie pierde — no activar venganza.
                // Antes: marcadorVacio → esEmpate=false → perdioUltimo=true para todos.
                // Ahora: marcadorVacio fuerza perdioUltimo=false en todos los casos.
                jHoy.perdioUltimo = !marcadorVacio && !haGanado && !esEmpate;
            }

            // ✅ FIX-RACHA-INV: invitados no acumulan rachas (no compiten por ranking)
            if (!esEmpate && !marcadorVacio && !j.esInvitado) {
                if (haGanado) {
                    j.rachaVictorias = (j.rachaVictorias || 0) + 1;
                    j.rachaDerrotas = 0;
                } else {
                    j.rachaDerrotas = (j.rachaDerrotas || 0) + 1;
                    j.rachaVictorias = 0;
                }
            }
        });
    }

    // BUG 1 FIX: el flag se establece ANTES de push/splice para que si saveDB()
    // falla, la bandera refleje que los puntos sí se aplicaron en memoria
    // (aunque no persistan en la nube). Se revierte solo si saveDB() lanza.
    window.puntosPartidoYaAplicados = true;

    window.partidosFinalizadosHoy.push({
        ...partido,
        marcador: resultadoFinal,
        fin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    window.partidosAbiertos.splice(index, 1);
    try {
        saveDB();
    } catch(e) {
        console.error('Error guardando partido finalizado:', e);
    }

    if (typeof renderHistorialHoy === 'function') renderHistorialHoy();
    if (typeof renderResultadosHoy === 'function') renderResultadosHoy();
    if (typeof renderPistas === 'function') renderPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderRanking === 'function') renderRanking();
    if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();
    if (typeof sincronizarTV === 'function') sincronizarTV();

    console.log(`✅ Finalizado con éxito: ${partido.nombres}`);
}


function agregarAJuegoIndividual() {
    const selector = document.getElementById('selector-multi-gamificado');
    if (!selector) return;
    
    const id = selector.value;
    if (!id) return;
    
    // 🛡️ Blindaje Anti-Duplicados y Estricto de IDs
    if (!window.preseleccionGamificado) window.preseleccionGamificado = [];
    
    const idStr = id.toString();
    if (!window.preseleccionGamificado.includes(idStr)) {
        window.preseleccionGamificado.push(idStr);
        
        // ✨ Mejora de UX: Limpiar el selector tras añadir para facilitar la siguiente selección
        selector.value = ""; 
        
        // Refrescamos la UI para que aparezcan los "tags" de los elegidos
        if (typeof actualizarInterfazManual === 'function') {
            actualizarInterfazManual();
        }
    }
}

function quitarDePreseleccion(id) {
    const idStr = id.toString();
    
    // Filtramos para eliminar (Mantenemos tu lógica original exacta)
    if (window.preseleccionGamificado) {
        window.preseleccionGamificado = window.preseleccionGamificado.filter(x => x.toString() !== idStr);
    }
    
    // Refrescamos para quitar el tag visualmente
    if (typeof actualizarInterfazManual === 'function') {
        actualizarInterfazManual();
    }
}

// --- LÓGICA DE PARTIDOS Y TV ---

//function equilibrarEquipos() {
 //   const ids = ['m-a1', 'm-a2', 'm-b1', 'm-b2'].map(id => document.getElementById(id).value).filter(v => v !== "");
 //   
 //   if (ids.length !== 4) return alert("Selecciona 4 jugadores primero.");
//
 //   const jugadores = ids.map(id => db.jugadores.find(j => j.id == id));
 //   
    // Función de poder con PROTECCIÓN contra nulos
 //   const power = (j) => {
 //       if (!j || !j.habilidades) return 0; // Si el jugador no existe, su poder es 0
 //       const habs = Object.values(j.habilidades);
//        const media = habs.reduce((a, b) => a + b, 0) / habs.length;
//        return media + ((j.puntosTotales || 0) * 0.1);
//    };
//    
//    const combis = [
//        { p1: [jugadores[0], jugadores[1]], p2: [jugadores[2], jugadores[3]] },
//        { p1: [jugadores[0], jugadores[2]], p2: [jugadores[1], jugadores[3]] },
//        { p1: [jugadores[0], jugadores[3]], p2: [jugadores[1], jugadores[2]] }
//    ];
//
//    const mejor = combis.sort((a, b) => {
//        const diffA = Math.abs((power(a.p1[0]) + power(a.p1[1])) - (power(a.p2[0]) + power(a.p2[1])));
//        const diffB = Math.abs((power(b.p1[0]) + power(b.p1[1])) - (power(b.p2[0]) + power(b.p2[1])));
//        return diffA - diffB;
//    })[0];
//
//    document.getElementById('m-a1').value = mejor.p1[0].id;
 //   document.getElementById('m-a2').value = mejor.p1[1].id;
 //   document.getElementById('m-b1').value = mejor.p2[0].id;
 //   document.getElementById('m-b2').value = mejor.p2[1].id;
//    
 //   alert("⚖️ Parejas equilibradas por nivel.");
//}

//function ajustarM(partidoId, equipo, puntos) {
//    const p = partidosAbiertos.find(x => x.id === partidoId);
 //   if (p) {
 //       p.marcador[equipo] = Math.max(0, p.marcador[equipo] + puntos);
  //      renderAbiertos();
  //  }
//}

// Función para cambiar los puntos de un jugador específico en modo gamificado
function cambiarPuntoGamificado(indexPartido, idJugador, cantidad) {
    // 1. OBTENCIÓN SEGURA DEL PARTIDO
    const partido = window.partidosAbiertos[indexPartido];
    if (!partido) {
        console.error("❌ No se encontró el partido en el índice:", indexPartido);
        return;
    }

    // 2. ASEGURAR ESTRUCTURA (Evita errores si el objeto es nuevo)
    if (!partido.puntosGamificados) {
        partido.puntosGamificados = {};
    }

    // Normalizamos el ID a string para que la llave sea siempre consistente (Anti-duplicados)
    const idStr = idJugador.toString();

    // 3. ACTUALIZACIÓN DE PUNTUACIÓN (Límite mínimo 0)
    const puntosActuales = parseInt(partido.puntosGamificados[idStr]) || 0;
    const nuevosPuntos = Math.max(0, puntosActuales + cantidad);
    
    // Si el resultado no cambia (ej. restar cuando ya es 0), salimos para ahorrar recursos
    if (puntosActuales === nuevosPuntos && cantidad < 0) return;

    partido.puntosGamificados[idStr] = nuevosPuntos;

    // 4. PERSISTENCIA Y REFRESCO DE INTERFAZ LOCAL
    saveDB(); // ☁️ Sincronización inmediata con Firebase
    
    if (typeof renderPistas === 'function') {
        renderPistas();
    }
    if (typeof actualizarVistaPistas === 'function') {
        actualizarVistaPistas();
    }
    if (typeof renderControlPistas === 'function') {
        renderControlPistas();
    }
    // Esto permite que los alumnos vean cómo suben sus puntos en la pantalla gigante al instante
    if (typeof sincronizarTV === 'function') {
        sincronizarTV();
    } else if (typeof tvChannel !== 'undefined' && tvChannel !== null) {
        try {
            // Fallback robusto: enviamos el Top 10 actualizado para que la TV brille
            const rankingActualizado = [...db.jugadores]
                .sort((a, b) => (b.puntosTotales || 0) - (a.puntosTotales || 0))
                .slice(0, 10);

            tvChannel.postMessage({ 
                action: 'UPDATE_DATA', 
                partidos: window.partidosAbiertos,
                ranking: rankingActualizado
            });
        } catch (e) {
            console.warn("⚠️ Error en postMessage a TV:", e);
        }
    }
}
//function renderAbiertos() {
 //   const container = document.getElementById('partidos-abiertos-container');
 //   if(!container) return;
 //   container.innerHTML = partidosAbiertos.map(p => {
 //       if(p.tipo === 'gamificado') {
 //           return `<div class="card" style="border-left:5px solid var(--atp-tennis);">
 //               <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
 //                   <b>🎮 GAMIFICACIÓN</b> <button onclick="finalizarPartido(${p.id})" style="border:none; background:none; cursor:pointer; font-size:1.5rem;">🏁</button>
 //               </div>
 //               ${p.ids.map(id => `
 //                   <div style="display:flex; justify-content:space-between; margin-bottom:5px; background:#f9f9f9; padding:8px; border-radius:5px;">
//                        <span>${db.jugadores.find(x=>x.id==id).nombre}</span>
//                        <div><b style="font-size:1.2rem; color:var(--atp-blue);">${p.marcadores[id]}</b> <button onclick="sumarGam(${p.id},'${id}')" style="margin-left:10px; padding:2px 8px;">+</button></div>
//                    </div>`).join('')}
//            </div>`;
//        } else {
//            const nA = p.ids.slice(0, p.mid).map(id => db.jugadores.find(x=>x.id==id).nombre).join(' + ');
//            const nB = p.ids.slice(p.mid).map(id => db.jugadores.find(x=>x.id==id).nombre).join(' + ');
//            return `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:5px solid var(--atp-blue);">
//                <div style="flex:1; font-size:0.8rem; font-weight:bold;">${nA}</div>
//                <div style="background:var(--atp-navy); color:white; padding:10px; border-radius:15px; margin:0 10px; display:flex; align-items:center; gap:10px;">
//                    <button onclick="sumarP(${p.id},'A')" style="background:var(--atp-gold); border:none; border-radius:4px; padding:2px 6px; cursor:pointer;">+</button> 
//                    <b style="font-size:1.2rem; min-width:40px; text-align:center;">${p.marcador.A}-${p.marcador.B}</b> 
 //                   <button onclick="sumarP(${p.id},'B')" style="background:var(--atp-gold); border:none; border-radius:4px; padding:2px 6px; cursor:pointer;">+</button>
//                </div>
//                <div style="flex:1; text-align:right; font-size:0.8rem; font-weight:bold;">${nB}</div>
//                <button onclick="finalizarPartido(${p.id})" style="margin-left:10px; border:none; background:none; cursor:pointer; font-size:1.5rem;">🏁</button>
//            </div>`;
//        }
//    }).join('');
//    
//    if (typeof tvChannel !== 'undefined') tvChannel.postMessage({ action: 'UPDATE_DATA', partidos: partidosAbiertos, jugadores: db.jugadores });
//}


