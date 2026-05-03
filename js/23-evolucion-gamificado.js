/* ============================================================
   ATP PLATINUM — 23-evolucion-gamificado.js
   Evolución de habilidades, votar golpe, sincronizar, finalizar gamificado
   ── Refactor: extraído de script.js (líneas [(7400, 7787)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function evolucionarHabilidades(jugadorId, golpeId) {
    const j = db.jugadores.find(x => String(x.id) === String(jugadorId));
    if (!j) return;
    
    // 1. Inicialización de seguridad
    if (!j.habilidades) j.habilidades = { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 };

    // 2. Mapa de progresión técnica
    const mapa = { 
        'ace': 'Saque', 
        'winner': 'Derecha', 
        'dejada': 'Mental', 
        'volea': 'Volea', 
        'smash': 'Volea', 
        'passing': 'Reves' 
    };
    
    const skill = mapa[golpeId];

    // 3. Progresión incremental (Tope en 10.0)
    if (skill && j.habilidades[skill] < 10) {
        // Subida de 0.1 por cada golpe ganador registrado
        j.habilidades[skill] = parseFloat((j.habilidades[skill] + 0.1).toFixed(1));
        
        // 🌟 RE-CÁLCULO DEL NIVEL GLOBAL (El "Peso" del jugador en el club)
        // Esto asegura que la evolución técnica afecte a los emparejamientos de la V2
        const habsArray = Object.values(j.habilidades);
        const suma = habsArray.reduce((acc, val) => acc + val, 0);
        j.nivel = (suma / habsArray.length).toFixed(1);

        console.log(`✨ Evolución: ${j.nombre} ha mejorado su ${skill} a ${j.habilidades[skill]} (Nivel Global: ${j.nivel})`);
    }
}

// Llama a esta función dentro de tu función de "votar golpe"
function votarGolpe(jid, gid, esResta = false) {
    const j = db.jugadores.find(x => x.id.toString() === jid.toString());
    if (!j) return;

    // 1. INICIALIZACIÓN DE SEGURIDAD (Blindaje de Habilidades)
    if (!j.habilidades) j.habilidades = { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 };

    const mapa = { 
        ace: 'Saque', 
        winner: 'Derecha', 
        volea: 'Volea', 
        smash: 'Volea', 
        passing: 'Reves', 
        dejada: 'Mental' 
    };
    
    const skill = mapa[gid];
    
    // 2. EVOLUCIÓN TÉCNICA (0.1 puntos por cada voto)
    if (skill) {
    const keyControl = `_evolucion_${jid}_${skill}_hoy`;
    const evolucionHoy = window[keyControl] || 0;
    const limiteDiario = 0.5;
    let valorActual = parseFloat(j.habilidades[skill]) || 5;

    if (esResta) {
        j.habilidades[skill] = parseFloat(Math.max(1, valorActual - 0.1).toFixed(1));
        window[keyControl] = Math.max(0, evolucionHoy - 0.1);
    } else {
        if (evolucionHoy < limiteDiario) {
            j.habilidades[skill] = parseFloat(Math.min(10, valorActual + 0.1).toFixed(1));
            window[keyControl] = evolucionHoy + 0.1;
        }
    }

    // Recálculo DENTRO del if
    const habsArray = Object.values(j.habilidades);
    const suma = habsArray.reduce((acc, val) => acc + val, 0);
    j.nivel = (suma / habsArray.length).toFixed(1);
}   // ← único cierre del if(skill)

    // 3. REGISTRO DE MÉRITOS DIARIOS (Para TV y Especialistas)
    // ✅ FIX: String(jid) para consistencia con modG — misma clave normalizada
    const jidStr = String(jid);
    if (!window.golpesGanadoresHoy[jidStr]) {
        window.golpesGanadoresHoy[jidStr] = { ace:0, dejada:0, volea:0, winner:0, smash:0, passing:0 };
    }
    
    if (esResta) {
        if (window.golpesGanadoresHoy[jidStr][gid] > 0) window.golpesGanadoresHoy[jidStr][gid]--;
    } else {
        window.golpesGanadoresHoy[jidStr][gid]++;
    }

    // 4. PERSISTENCIA Y REFRESCO DINÁMICO
    saveDB(); 
    
    // 🚀 Actualización inmediata de todas las vistas
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas(); 
    if (typeof renderVotos === 'function') renderVotos();
    if (typeof renderRanking === 'function') renderRanking(); 
    
    // Sincronización con la pantalla del club (Modo TV)
    if (typeof sincronizarTV === 'function') sincronizarTV();
    
    console.log(`✨ Voto registrado: ${j.nombre} | Golpe: ${gid}${skill ? ` | Nuevo Nivel: ${j.nivel}` : ''}`);
}


function sincronizarTodo() {
    saveDB();
    // ✅ FIX: usar window.tvChannel en lugar de la constante tvChannel local
    if (typeof window.tvChannel !== 'undefined') {
        window.tvChannel.postMessage({
            action: 'UPDATE_DATA',
            partidos: window.partidosAbiertos || [],
            jugadores: db.jugadores
        });
    }
}

function finalizarGamificado() {
    // 1. Verificación: ¿Hay alguien presente hoy?
    if (!window.jugadoresHoy || window.jugadoresHoy.length === 0) {
        alert("⚠️ No hay jugadores presentes. Agrega jugadores primero.");
        return;
    }

    // 2. Confirmación
    if (!confirm(`¿Sumar +1 punto de experiencia a los ${window.jugadoresHoy.length} jugadores presentes hoy?`)) {
        return;
    }

    // 3. Reparto de puntos con Blindaje de ID
    window.jugadoresHoy.forEach(p => {
        const j = db.jugadores.find(x => String(x.id) === String(p.id));
        if (j) {
            // ✅ Invitados participan en la clase pero no acumulan puntos de ranking
            if (!j.esInvitado) j.puntosTotales = (j.puntosTotales || 0) + 1;
            if (j.habilidades) {
                const habs = Object.values(j.habilidades);
                const suma = habs.reduce((a, b) => a + b, 0);
                j.nivel = (suma / habs.length).toFixed(1);
            }
        }
    });

    // 4. Registrar en el historial de hoy
    if (!window.partidosFinalizadosHoy) window.partidosFinalizadosHoy = [];

    window.partidosFinalizadosHoy.push({
        id: Date.now().toString(),
        tipo: 'gamificado',
        gamified: true,
        nombres: `Sesión de Entrenamiento (${window.jugadoresHoy.length} asistentes)`,
        // ✅ FIX: Añadido campo marcador. Sin él, renderHistorialHoy(),
        // cerrarJornada() y generarPDFInforme() muestran "undefined" o "0-0"
        // al leer p.marcador, ya que resultado no es el campo que leen.
        marcador: 'ÉXITO 🏆',
        resultado: 'ÉXITO 🏆', // se mantiene por compatibilidad con código legacy
        fin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pista: '-',
        ids: window.jugadoresHoy.map(j => j.id.toString())
    });

    // 5. Efecto visual en TV (Celebración General)
    if (typeof window.tvChannel !== 'undefined') {
        window.tvChannel.postMessage({
            action: 'CELEBRACION_MVP',
            nombre: "LEVEL UP GENERAL 🎮",
            subtitulo: "Todos los presentes suman +1 punto"
        });
    }

    // 6. Guardado y sincronización
    saveDB();
    if (typeof sincronizarTV === 'function') sincronizarTV();

    // 7. Refrescar interfaz
    if (typeof renderRanking === 'function') renderRanking();
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderHistorialHoy === 'function') renderHistorialHoy();

    // 8. Mensaje final
    alert("🎮 ¡Puntos de entrenamiento repartidos!\n\nSe ha premiado la constancia de todo el grupo.");

    console.log(`✅ Gamificado finalizado - ${window.jugadoresHoy.length} jugadores con +1 punto.`);
}

// Variable global para almacenar los planes calculados y evitar errores de comillas en el HTML
window.planesTemporales = [];


window.cargarSugerenciaEnPista = function(index, botonElemento) {
    // =========================================================
    // 🛡️ PASO 0: BLOQUEO ESTRICTO ATP PLATINUM
    // =========================================================
    // 🛡️ PASO 0: BLOQUEO ESTRICTO ATP PLATINUM
    // ✅ FIX BUG V1: db.fechaEvento puede estar en formato antiguo (toLocaleDateString)
    // o nuevo (ISO slice). Aceptamos cualquier valor truthy — lo que importa es que
    // exista una jornada. window.jornadaActiva es el flag definitivo.
    // =========================================================
    const jornadaValida = db.fechaEvento && !window.jornadaCerrada;
    const jornadaActivaFlag = window.jornadaActiva && !window.jornadaCerrada;
    if (!jornadaValida && !jornadaActivaFlag) {
        alert("🚫 SISTEMA BLOQUEADO: No hay una jornada activa.\n\nPor favor, inicia el evento desde el HUB antes de lanzar partidos.");
        if (typeof volverAlHub === 'function') volverAlHub();
        return;
    }

    const sugerencias = window.planesTemporales[index];
    if (!sugerencias || sugerencias.length === 0) {
        alert("⚠️ No hay partidos sugeridos en este bloque. Pulsa primero GENERAR PLAN.");
        return;
    }

    // 1. OBTENER ESTADO ACTUAL (Físico y Lógico)
    // Usar el número de pistas del club (plan-pistas-totales) como total físico.
    // Si no hay pistas activas marcadas, usar el total del club igualmente
    // para que V1 pueda lanzar aunque no se hayan marcado cajas.
    const totalActual = parseInt(document.getElementById('plan-pistas-totales')?.value) || 2;
    const ocupadas = window.partidosAbiertos.length;
    const libres = totalActual - ocupadas;

    if (libres <= 0) {
        alert("⚠️ No hay pistas libres físicas. Finaliza un partido primero.");
        return;
    }

    const pistasEnUso = window.partidosAbiertos.map(p => parseInt(p.pista));

    let huecosPistas = [];
    for (let i = 1; i <= totalActual; i++) {
        if (!pistasEnUso.includes(i)) huecosPistas.push(i);
    }

    let partidosCargadosCount = 0;
    let jugadoresEnConflicto = new Set();
    // ✅ FIX: contador para garantizar IDs únicos dentro del mismo bloque.
    // Date.now() puede ser idéntico en todas las iteraciones del for..of síncrono.
    let _idxPartidoEnBloque = 0;

    // 2. PROCESAR SUGERENCIAS
    // ✅ FIX: Cambiado forEach por for...of para poder hacer break cuando
    // se agotan los huecos. Con forEach no hay forma de salir del bucle
    // antes de tiempo — se seguían procesando sugerencias aunque ya no
    // hubiera pistas libres, solo para terminar saltándolas todas.
    for (const partidoPlanificado of sugerencias) {

        // ✅ FIX: Salida temprana si ya no quedan huecos disponibles.
        // Con forEach esto era imposible — el bucle completaba todas las
        // iteraciones aunque partidosCargadosCount >= huecosPistas.length.
        if (partidosCargadosCount >= huecosPistas.length) break;

        // Releemos idsJugandoAhora en cada iteración para capturar
        // jugadores añadidos en iteraciones anteriores y cambios de otros dispositivos.
        const idsJugandoAhora = (window.partidosAbiertos || [])
            .flatMap(p => p.ids.map(id => id.toString()));

        const conflicto = partidoPlanificado.ids.some(id =>
            idsJugandoAhora.includes(id.toString())
        );

        if (conflicto) {
            partidoPlanificado.ids.forEach(id => {
                if (idsJugandoAhora.includes(id.toString())) {
                    const j = db.jugadores.find(x => x.id.toString() === id.toString());
                    if (j) jugadoresEnConflicto.add(j.nombre);
                }
            });
            continue; // ✅ FIX: 'continue' en lugar de 'return' — con forEach
                      // el return solo saltaba la iteración actual, igual que
                      // continue, pero era semánticamente confuso. Aquí es explícito.
        }

        // Preferir la pista sugerida por el plan si sigue libre; si no, usar el siguiente hueco
        let numPista;
        if (partidoPlanificado.pistaSugerida != null) {
            const sug = Number(partidoPlanificado.pistaSugerida);
            numPista = huecosPistas.includes(sug) ? sug : huecosPistas[partidosCargadosCount];
        } else {
            numPista = huecosPistas[partidosCargadosCount];
        }

        // Guard de pista ocupada por otro dispositivo entre el cálculo de huecos y ahora
        const pistaYaOcupadaAhora = window.partidosAbiertos.some(
            p => String(p.pista) === String(numPista)
        );
        if (pistaYaOcupadaAhora) {
            console.warn(`⚠️ Pista ${numPista} ocupada por otro dispositivo durante el lanzamiento. Omitiendo.`);
            continue;
        }

        const nombresFresh = partidoPlanificado.ids.map(id => {
            const j = db.jugadores.find(x => x.id.toString() === id.toString());
            return j ? j.nombre : "???";
        });

        const tieneVenganza = partidoPlanificado.nombres &&
            partidoPlanificado.nombres.includes("🔥");

        // Usar helper para construir nombres correctamente para cualquier modo
        const { eqA: _eqA, eqB: _eqB } = resolverNombresEquipos(
            { ...partidoPlanificado },
            id => db.jugadores.find(x => x.id.toString() === id.toString())?.nombre || "???"
        );
        let textoDisplay = _eqB ? `${_eqA} vs ${_eqB}` : _eqA;

        // 3. INSERCIÓN EN PARTIDOS ABIERTOS
        window.partidosAbiertos.push({
            id: 'p' + Date.now().toString(36) + '_' + (_idxPartidoEnBloque++) + '_' + Math.random().toString(36).substr(2, 4),
            pista: numPista.toString(),
            tipo: partidoPlanificado.tipo,
            ids: partidoPlanificado.ids,
            nombres: tieneVenganza ? `🔥 ${textoDisplay} 🔥` : textoDisplay,
            marcador: "0-0",
            inicio: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            // ✅ NUEVO: timestamp de inicio para el timer por partido
            tiempoInicio: Date.now(),
            timestamp: Date.now(),
            gamified: partidoPlanificado.tipo === 'gamificado',
            puntosGamificados: {},
            juegosA: 0,
            juegosB: 0,
            esVenganza: tieneVenganza,
            p1: partidoPlanificado.ids[0],
            p2: partidoPlanificado.ids[1],
            p3: partidoPlanificado.ids[2] || null,
            p4: partidoPlanificado.ids[3] || null,
            p5: partidoPlanificado.ids[4] || null,
            p6: partidoPlanificado.ids[5] || null,
            // ✅ FIX Bug 4: persistir tamanoEquipoA para que finalizarPartido
            // y resolverModoPartido calculen el corte correcto en asimétrico
            tamanoEquipoA: partidoPlanificado.tamanoEquipoA ?? null,
            // ✅ NUEVO Australiana: estado de rondas y acumulado individual
            ...(partidoPlanificado.tipo === 'equipos3' && partidoPlanificado.ids.length === 3 ? {
                rondaActual: 0,
                puntosAustraliana: {
                    [partidoPlanificado.ids[0]]: 0,
                    [partidoPlanificado.ids[1]]: 0,
                    [partidoPlanificado.ids[2]]: 0
                },
                juegosSoloAustraliana: {
                    [partidoPlanificado.ids[0]]: 0,
                    [partidoPlanificado.ids[1]]: 0,
                    [partidoPlanificado.ids[2]]: 0
                }
            } : {})
        });

        // 4. BLOQUEO DE ESTADO
        partidoPlanificado.ids.forEach(id => {
            const jHoy = window.jugadoresHoy.find(x => x.id.toString() === id.toString());
            if (jHoy) {
                jHoy.estado = 'jugando';
                jHoy.descansosSeguidos = 0;
            }
        });

        partidosCargadosCount++;
    }

    // 5. FEEDBACK, PERSISTENCIA Y REFRESCO UI
    if (jugadoresEnConflicto.size > 0) {
        alert(`⚠️ Algunos partidos se omitieron. Jugadores ya ocupados: ${Array.from(jugadoresEnConflicto).join(", ")}`);
    }

    if (partidosCargadosCount > 0) {
        if (botonElemento) {
            botonElemento.style.background = "#28a745";
            botonElemento.style.color = "white";
            botonElemento.innerHTML = `✅ ${partidosCargadosCount} PISTAS LANZADAS`;
            botonElemento.disabled = true;
        }

        saveDB();
        renderPistas();
        renderPresentes();

        if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();
        // ✅ FIX: actualizarVistaPistas() no se llamaba aquí, dejando
        // #contenedor-pistas-jornada sin actualizar hasta el próximo sync Firebase.
        if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
        if (typeof sincronizarTV === 'function') sincronizarTV();
        if (typeof actualizarTablonHub === 'function') actualizarTablonHub();

        showSection('jornada');
    } else {
        alert("🚫 No se pudo cargar ningún partido. Todos los jugadores sugeridos ya están ocupados o las pistas se han llenado manualmente.");
    }
};

