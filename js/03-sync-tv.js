/* ============================================================
   ATP PLATINUM — 03-sync-tv.js
   Sincronización TV, contadores de pistas, alta de jugadores
   ── Refactor: extraído de script.js (líneas [(924, 1190)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// SINCRONIZACIÓN CENTRAL CON LA TV (llamarla siempre después de cambios)
// ==========================================
function sincronizarTV() {
    // 1. Ranking Top 10
    const ranking = [...(db.jugadores || [])]
        .filter(j => (j.puntosTotales || 0) > 0)
        .sort((a, b) => (b.puntosTotales || 0) - (a.puntosTotales || 0))
        .slice(0, 10);
    const rankingData = ranking.length > 0
        ? ranking
        : [{ nombre: "Esperando resultados...", puntosTotales: 0 }];

    // 2. Especialistas
    const especialistas = CATEGORIAS_GOLPES.map(cat => {
        let mejor = { nombre: '---', valor: 0 };
        const golpesHoy = window.golpesGanadoresHoy || {};

        Object.keys(golpesHoy).forEach(idJugador => {
            const valorActual = golpesHoy[idJugador][cat.id] || 0;
            if (valorActual > mejor.valor && valorActual > 0) {
                let j = db.jugadores.find(x => x.id.toString() === idJugador.toString());
                if (!j && window.jugadoresHoy) {
                    j = window.jugadoresHoy.find(x => x.id.toString() === idJugador.toString());
                }
                if (j && j.nombre) {
                    mejor = { nombre: j.nombre, valor: valorActual };
                }
            }
        });
        return { label: cat.label, nombre: mejor.nombre, valor: mejor.valor };
    });

    // 3. MVP(s) — soporte multi
    const mvpIdsActivos = Array.isArray(window.mvpIdsHoy) && window.mvpIdsHoy.length
        ? window.mvpIdsHoy
        : (window.mvpIdHoy ? [String(window.mvpIdHoy)] : []);
    const nombresMVP = mvpIdsActivos
        .map(id => db.jugadores.find(j => j.id.toString() === id.toString())?.nombre)
        .filter(Boolean).join(', ');
    const jugadorMVP = null; // legacy — usamos nombresMVP directamente

    // 4. Partidos — usar helper centralizado para todos los modos
    const partidosTV = (window.partidosAbiertos || []).map(p => {
        const modo = resolverModoPartido(p);
        const esAus = p.tipo === 'equipos3' && p.ids && p.ids.length === 3;

        // ✅ Australiana: construir marcador compacto y nombres de ronda para TV
        let marcadorTV = p.marcador || "0-0";
        let nombresTV  = p.nombres || "Partido en curso";

        // ✅ Gamificado: construir marcador live desde puntosGamificados
        if ((p.gamified || p.tipo === 'gamificado') && p.puntosGamificados && p.ids) {
            const gN2 = id => db.jugadores.find(j => String(j.id) === String(id))?.nombre?.split(' ')[0] || '???';
            marcadorTV = '🎮 ' + p.ids.map(id => `${gN2(id)}:${p.puntosGamificados[id] || 0}`).join(' · ');
        }
        if (esAus) {
            const [idA, idB, idC] = p.ids.map(String);
            const rondaIdx = (p.rondaActual ?? 0) % 3;
            const rondas   = [
                { par: [idA, idB], sol: idC },
                { par: [idA, idC], sol: idB },
                { par: [idB, idC], sol: idA }
            ];
            const cfg = rondas[rondaIdx];
            const gN  = id => db.jugadores.find(j => String(j.id) === id)?.nombre || '???';
            const pts = p.puntosAustraliana || { [idA]: 0, [idB]: 0, [idC]: 0 };
            // Nombre: configuración ronda activa
            nombresTV = `R${(p.rondaActual ?? 0) + 1}: ${cfg.par.map(gN).join('+')} vs ${gN(cfg.sol)}`;
            // Marcador TV: acumulados individuales en formato compacto
            marcadorTV = p.ids.map(id => `${gN(id).split(' ')[0]}:${pts[id] || 0}`).join(' ');
        }

        return {
            pista: p.pista,
            nombres: nombresTV,
            marcador: marcadorTV,
            tipo: p.tipo || 'normal',
            esTrio: modo.esTrio,
            esAsimetrico: modo.esAsimetrico,
            esAustraliana: esAus,
            etiquetaModo: esAus ? `AUSTRALIANA R${(p.rondaActual ?? 0) + 1}` : modo.etiqueta,
            iconoModo: esAus ? '🔄' : modo.icono,
            gamified: p.gamified,
            esVenganza: p.esVenganza || false,
            puntosGamificados: p.puntosGamificados || {},
            // Australiana: marcador de la ronda en curso separado del acumulado
            marcadorRonda: esAus ? `${p.juegosA || 0}-${p.juegosB || 0}` : null
        };
    });

    // ✅ FIX: Truncar logVenganzasTV a las últimas 5 entradas.
    // Sin este truncado el array crece sin límite durante la jornada,
    // aumentando el payload de cada postMessage y del localStorage.
    // Lo truncamos aquí, en el punto de envío, en lugar de en verificarVenganza()
    // para no perder entradas que otras funciones puedan necesitar leer antes
    // de que lleguen a sincronizarTV().
    const venganzasParaTV = (window.logVenganzasTV || []).slice(-5);

    // 5. Leer el timer desde el DOM una sola vez con fallback seguro
    // ✅ FIX: Si los elementos del timer no existen (TV abierta antes que el HUB),
    // el fallback "15:00" era incorrecto — mejor enviar el tiempo actual
    // del cronómetro calculado desde timeLeft si está disponible.
    let tiempoActual;
    const minElem = document.getElementById('minutes');
    const secElem = document.getElementById('seconds');
    if (minElem && secElem) {
        tiempoActual = `${minElem.innerText}:${secElem.innerText}`;
    } else if (typeof timeLeft !== 'undefined') {
        const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const secs = (timeLeft % 60).toString().padStart(2, '0');
        tiempoActual = `${mins}:${secs}`;
    } else {
        tiempoActual = "15:00";
    }

    // 6. Empaquetado
    const data = {
        action: 'UPDATE_DATA',
        partidos: partidosTV,
        ranking: rankingData,
        especialistas: especialistas,
        mvp: nombresMVP || null,
        venganzasCumplidas: venganzasParaTV,
        time: tiempoActual
    };

    // 7. Envío dual
    if (window.tvChannel) {
        window.tvChannel.postMessage(data);
    }

    // ✅ FIX: try/catch en localStorage por si está lleno o en modo privado.
    // Sin esto, un QuotaExceededError silencioso podía romper la sincronización
    // sin ningún aviso en consola.
    try {
        localStorage.setItem('tv_data_sync', JSON.stringify({ datos: data, ts: Date.now() }));
    } catch (e) {
        console.warn("⚠️ localStorage lleno o no disponible. Sincronización TV solo por BroadcastChannel.", e);
    }

    console.log("📺 Sincronización TV Exitosa: Soporte Trío y Venganza Activo.");
}

function actualizarContadoresPistas() {
    // 🛡️ PASO 1: SINCRONIZACIÓN ESTRUCTURAL
    // Priorizamos el valor del input de configuración si existe, si no, la global
    const inputTotal = document.getElementById('plan-pistas-totales');
    const total = inputTotal ? parseInt(inputTotal.value) : (window.TOTAL_PISTAS_MAX || 2);
    
    const ocupadas = window.partidosAbiertos ? window.partidosAbiertos.length : 0;
    
    // BLINDAJE: Asegura que el cálculo sea siempre un número positivo
    const libres = Math.max(0, total - ocupadas);
  
    const badge = document.getElementById('pistas-libres-badge');
    if (badge) {
        // ✅ FIX BUG ASIGNACIÓN MANUAL: usar getPistasDisponiblesJornada (pistas
        // realmente activadas/reservadas para esta jornada) en lugar de
        // getPistasDelClub (todas las físicas del club).
        let nLibres, nTotales;
        if (typeof getPistasLibres === 'function' && typeof getPistasDisponiblesJornada === 'function') {
            nLibres  = getPistasLibres().length;
            nTotales = getPistasDisponiblesJornada().length;
        } else {
            // Fallback: cálculo equivalente sin depender del archivo 27
            const ocupadasPistas = new Set((window.partidosAbiertos || []).map(p => String(p.pista)));
            nTotales = total;
            nLibres  = Math.max(0, total - ocupadasPistas.size);
        }
        // Formato visual de alta gama
        badge.innerText = `Pistas Libres: ${nLibres} / ${nTotales}`;
        
        // 🎨 LÓGICA DE ALERTA VISUAL
        if (libres === 0) {
            badge.style.color = 'var(--atp-gold)';
            badge.style.animation = 'pulse 1.5s infinite';
            badge.style.fontWeight = '900';
        } else if (libres === 1) {
            // Aviso de "Última pista" para gestionar bien el quórum
            badge.style.color = '#ffcc00';
            badge.style.animation = '';
        } else {
            badge.style.color = 'white';
            badge.style.animation = '';
            badge.style.fontWeight = 'normal';
        }
    }

    // 🔗 DEPENDENCIA: Sincronizar con el HUB si el badge del menú existe
    const badgeHub = document.getElementById('hub-pistas-count');
    if (badgeHub) badgeHub.innerText = libres;
}
// 2. FUNCIÓN PARA CREAR JUGADOR NUEVO DESDE EL MODAL
function crearYAgregarJugador() {
    const input = document.getElementById('input-nuevo-asistente');
    if (!input) return;
    const nombre = input.value.trim();
    
    if (nombre === "") return alert("Por favor, introduce un nombre válido.");

    const nombreNorm = nombre.toLowerCase();

    // Búsqueda inteligente en la BBDD
    const jugadorExistente = db.jugadores.find(j => j.nombre.toLowerCase() === nombreNorm);

    if (jugadorExistente) {
        const yaEstaHoy = window.jugadoresHoy.some(h => h.id.toString() === jugadorExistente.id.toString());
        
        if (yaEstaHoy) {
            alert(`"${jugadorExistente.nombre}" ya está en la lista de hoy.`);
            input.value = '';
            return;
        }

        // Rescatar de la BBDD y añadir a hoy con estados iniciales limpios
        window.jugadoresHoy.push({
            ...jugadorExistente,
            pausado: false,
            estado: 'disponible',
            descansosSeguidos: 0,
            perdioUltimo: false
        });

    } else {
        // Validación de similitudes para evitar duplicados
        const similares = db.jugadores.filter(j => {
            const jName = j.nombre.toLowerCase();
            return (jName.includes(nombreNorm) || nombreNorm.includes(jName)) && nombreNorm.length > 2;
        });

        if (similares.length > 0) {
            const nombresSim = similares.map(j => j.nombre).join(', ');
            if (!confirm(`⚠️ SIMILITUD DETECTADA:\n👉 ${nombresSim}\n\n¿Crear "${nombre}" de todas formas?`)) return;
        }

        // ✅ FIX: stats completo incluyendo trios
        const nuevoJugador = {
            id: Date.now().toString(),
            nombre: nombre,
            nivel: "5.0",
            esInvitado: false,   // ✅ Jugadores invitados/lúdicos no computan en ranking
            puntosTotales: 0,
            habilidades: { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 },
            statsAcumuladas: { ace: 0, winner: 0, dejada: 0, volea: 0, smash: 0, passing: 0 },
            stats: { 
                ganados: 0, perdidos: 0, totales: 0, mvps: 0,
                dobles: 0, simples: 0, gamificados: 0, trios: 0, asimetrico: 0, australiana: 0,
                juegosFavor: 0, juegosContra: 0,
                aces: 0, winners: 0, smashes: 0, voleas: 0, dejadas: 0, passings: 0
            }
        };

        db.jugadores.push(nuevoJugador);
        
        window.jugadoresHoy.push({ 
            ...nuevoJugador, 
            pausado: false, 
            estado: 'disponible',
            descansosSeguidos: 0,
            perdioUltimo: false 
        });
    }

    // Persistencia
    saveDB();
    input.value = '';

    // Refresco de interfaz en tiempo real
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof filtrarAsistencia === 'function') filtrarAsistencia();
    if (typeof actualizarSugerenciasBBDD === 'function') actualizarSugerenciasBBDD();
    if (typeof renderCantera === 'function') renderCantera();
    if (typeof sincronizarTV === 'function') sincronizarTV();

    console.log(`👤 Jugador ${nombre} integrado en el sistema y disponible para rotación.`);
}

