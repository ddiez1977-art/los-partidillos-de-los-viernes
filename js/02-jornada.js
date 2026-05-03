/* ============================================================
   ATP PLATINUM — 02-jornada.js
   Gestión de jornada (iniciar/verificar/cerrar pistas), vista de pistas, sugerencias
   ── Refactor: extraído de script.js (líneas [(570, 923)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// GESTIÓN DE JORNADA (SANEADA)
// ==========================================

function verificarJornada() {
    // ⚠️ DEPRECADA: La detección de jornada la gestiona el listener de Firebase.
    // Esta función se mantiene solo como consulta de solo lectura para
    // compatibilidad con llamadas legacy del HTML.
    // NO llama a saveDB() para evitar conflictos con el listener.
    const pApertura = document.getElementById('pantalla-apertura');
    if (!pApertura) return;

    // ✅ FIX BUG MEDIO 1 (mismo fix que el listener): usar ISO para consistencia entre locales
    const fechaActual = new Date().toISOString().slice(0, 10);
    const jornadaActivaHoy = db.fechaEvento === fechaActual;

    if (jornadaActivaHoy) {
        pApertura.style.display = 'none';
        console.log("🔓 Jornada activa para hoy: " + db.fechaEvento);
        if (typeof actualizarContadorConvocatoriaHub === 'function') {
            actualizarContadorConvocatoriaHub();
        }
    } else {
        const textoFecha = document.getElementById('fecha-apertura-texto');
        if (textoFecha) textoFecha.innerText = fechaActual;
        pApertura.style.display = 'flex';
        console.log("🔒 Sistema bloqueado: Esperando inicio de jornada.");
        // ✅ Sin saveDB() — la limpieza de jornada antigua la gestiona
        // exclusivamente el listener de Firebase para evitar bucles.
    }
}


function iniciarJornada() {
    // ✅ FIX BUG MEDIO 1: ISO slice(0,10) para consistencia entre locales de dispositivo
    const fechaActual = new Date().toISOString().slice(0, 10);

    // 1. Confirmación de seguridad
    if (!confirm(`🎾 ¿Iniciar jornada para hoy (${fechaActual})?\n\nEsto reseteará las pistas y cargará automáticamente a los jugadores confirmados.`)) return;

    // --- 🛡️ ACTIVACIÓN DEL SISTEMA ---
    window.jornadaActiva = true;
    window.jornadaCerrada = false;
    // ✅ Flag de sesión: el listener Firebase respetará jornadaActiva=true
    // mientras esta sesión la haya iniciado para HOY, evitando que un snapshot
    // tardío con db.fechaEvento aún no propagado pise el estado a false y
    // bloquee la navegación con "JORNADA REQUERIDA".
    window._jornadaIniciadaSesion = fechaActual;

    // 2. Limpieza Radical (Mesa Limpia)
    db.fechaEvento = fechaActual;
    window.jugadoresHoy = [];
    db.jugadoresHoy = [];

    window.partidosAbiertos = [];
    db.partidosAbiertos = [];

    // ✅ FIX: Resetear también partidosFinalizadosHoy y db.partidosRecientes.
    // Sin esto, si se iniciaba una nueva jornada sin haber cerrado correctamente
    // la anterior, el historial del día anterior permanecía visible en
    // renderHistorialHoy() y se archivaba en el histórico al cerrar la nueva jornada.
    window.partidosFinalizadosHoy = [];
    db.partidosRecientes = [];

    window.planesTemporales = [];
    window.mvpIdHoy = null;
    window.mvpIdsHoy = [];
    db.mvpIdHoy = null;
    db.mvpIdsHoy = [];
    // ✅ MVP dual
    window.mvpIdsJugadores = []; window.mvpIdsEntrenadores = []; window.votosJugadoresMVP = {};
    db.mvpIdsJugadores = [];     db.mvpIdsEntrenadores = [];     db.votosJugadoresMVP = {};
    db.votosDe = {};
    window.logVenganzasTV = [];
    window.golpesGanadoresHoy = {};
    db.golpesGanadoresHoy = {};
    window._estadisticasJornadaYaGuardadas = false;
    window._mvpPuntosYaAplicadosHoy = false; // reset flag sistema live MVP
    // ✅ Reset UI de golpes
    if (typeof window._jugadorGolpesSeleccionado !== 'undefined') window._jugadorGolpesSeleccionado = null;

    // Limpiar caps de evolución diaria de habilidades
    Object.keys(window).forEach(k => {
        if (k.startsWith('_evolucion_')) delete window[k];
    });

    // 3. 🌟 CARGA INTELIGENTE DESDE CONVOCATORIA
    if (db.convocatoriaActiva && db.convocatoriaActiva.length > 0) {
        db.convocatoriaActiva.forEach(idStr => {
            const jugadorBD = db.jugadores.find(j => String(j.id) === idStr);
            if (jugadorBD) {
                const jugadorParaHoy = {
                    ...jugadorBD,
                    estado: 'disponible',
                    descansosSeguidos: 0,
                    partidosJugadosHoy: 0,
                    pausado: false,
                    perdioUltimo: false
                };
                window.jugadoresHoy.push(jugadorParaHoy);
                db.jugadoresHoy.push(jugadorParaHoy);
            }
        });
    }

    // 4. Saneo de Cantera (Filtro Anti-Corrupción)
    if (db.jugadores) {
        db.jugadores.forEach(j => {
            if (!j.stats) j.stats = { ganados: 0, perdidos: 0, totales: 0, juegosFavor: 0, juegosContra: 0 };
            j.puntosTotales = isNaN(j.puntosTotales) || j.puntosTotales < 0 ? 0 : j.puntosTotales;
            j.estado = 'descansando';
            j.pausado = false;
            // ✅ FIX BUG ALTO 3: perdioUltimo se propagaba de jornada a jornada
            // porque se guardaba en db.jugadores al finalizar un partido.
            // Al iniciar nueva jornada, reseteamos el flag en la cantera para que
            // ningún jugador entre con deuda de venganza de la sesión anterior.
            j.perdioUltimo = false;
        });
    }

    // 🔒 5. CIERRE AUTOMÁTICO DE PORTAL (Firebase)
    if (typeof database !== 'undefined') {
        // ✅ FIX BUG MEDIO: Firebase write sin .catch — si falla, el portal externo
        // queda abierto aunque la jornada ya haya arrancado.
        database.ref('torneoPlatinum/convocatoriaAbierta').set(false)
            .catch(err => console.error('⚠️ Error cerrando portal en Firebase:', err));
    }
    db.convocatoriaAbierta = false;

    // 6. Persistencia y Sincronización
    saveDB();

    // 7. Transición Estética (Fade Out de la pantalla negra)
    const pApertura = document.getElementById('pantalla-apertura');
    if (pApertura) {
        pApertura.style.transition = "opacity 0.5s ease";
        pApertura.style.opacity = "0";
        setTimeout(() => {
            pApertura.style.display = 'none';
            pApertura.style.opacity = "1";
        }, 500);
    }

    // 8. Refresco de Vistas
    if (typeof actualizarContadorConvocatoriaHub === 'function') actualizarContadorConvocatoriaHub();
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof renderHistorialHoy === 'function') renderHistorialHoy();
    if (typeof sincronizarTV === 'function') sincronizarTV();

    // SCRIPT-D FIX: actualizar el badge #count-presentes del HUB inmediatamente.
    // renderPresentes() actualiza la lista pero no el contador del hub.
    const _cntPresentes = document.getElementById('count-presentes');
    if (_cntPresentes) _cntPresentes.innerText = window.jugadoresHoy.length;

    // 9. Salto a la Acción
    setTimeout(() => {
        if (typeof accederSistema === 'function') {
            accederSistema('jornada');
            if (window.jugadoresHoy.length === 0) {
                alert("⚠️ Convocatoria vacía. Añade jugadores manualmente en el panel.");
            } else {
                console.log(`🚀 Jornada iniciada con ${window.jugadoresHoy.length} jugadores.`);
            }
        }
    }, 300);
}

function actualizarVistaPistas() {
    const contenedor = document.getElementById('contenedor-pistas-jornada');
    if (!contenedor) return;

    // ✅ FIX DUPLICACIÓN: renderPistas() ya muestra los partidos activos en
    // #partidos-abiertos-container (misma sección #jornada). Si ese contenedor
    // existe y tiene partidos renderizados, vaciamos #contenedor-pistas-jornada
    // para evitar mostrar dos listas del mismo partido en la misma pantalla.
    const contPrincipal = document.getElementById('partidos-abiertos-container');
    if (contPrincipal && contPrincipal.children.length > 0) {
        contenedor.innerHTML = "";
        return;
    }

    contenedor.innerHTML = "";

    const partidos = window.partidosAbiertos || [];

    if (partidos.length === 0) {
        contenedor.innerHTML = `
            <div class="no-partidos" style="text-align:center; padding:40px; color:#666; font-style:italic; border:2px dashed #ccc; border-radius:10px;">
                <p>📭 No hay partidos activos.</p>
                <small>Usa el Planificador para asignar pistas.</small>
            </div>`;
        return;
    }

    const limiteMins = parseInt(document.getElementById('plan-duracion')?.value) || 15;
    const limiteMs = limiteMins * 60 * 1000;

    partidos.forEach((partido, index) => {
        let nombresHTML = "";

        const modo = resolverModoPartido(partido);
        const esTrio       = modo.esTrio;
        const esAsimetrico = modo.esAsimetrico;

        if (partido.nombres) {
            // ✅ Australiana: reconstruir el texto de la ronda activa en lugar del nombre inicial
            if (partido.tipo === 'equipos3' && partido.ids && partido.ids.length === 3) {
                const [idA, idB, idC] = partido.ids.map(String);
                const rondaIdx = (partido.rondaActual ?? 0) % 3;
                const rondas = [
                    { par: [idA, idB], sol: idC },
                    { par: [idA, idC], sol: idB },
                    { par: [idB, idC], sol: idA }
                ];
                const cfg = rondas[rondaIdx];
                const gN  = id => db.jugadores.find(j => String(j.id) === id)?.nombre || '???';
                nombresHTML = `R${(partido.rondaActual ?? 0) + 1}: ${cfg.par.map(gN).join('+')} vs ${gN(cfg.sol)}`;
            } else {
                nombresHTML = partido.nombres.includes("🔥")
                    ? `<span style="color:var(--atp-gold); font-weight:900;">${partido.nombres}</span>`
                    : partido.nombres;
            }
        } else if (partido.ids) {
            const { eqA, eqB } = resolverNombresEquipos(partido);
            nombresHTML = eqB ? `${eqA} vs ${eqB}` : eqA;
        } else {
            nombresHTML = "Sin jugadores";
        }

        const card = document.createElement('div');
        card.className = 'card-pista-activa';

        let colorHeader = 'var(--atp-navy)';
        let textoHeader = `PISTA ${partido.pista || (index + 1)}`;
        let bordeEspecial = "";

        if (partido.esVenganza) {
            colorHeader = 'var(--atp-gold)';
            textoHeader += ' 🔥 VENGANZA';
            bordeEspecial = 'border: 2px solid var(--atp-gold); box-shadow: 0 0 10px rgba(255,215,0,0.3);';
        } else if (partido.gamified) {
            colorHeader = '#00d4ff';
            textoHeader += ' 🎮 GAMIFICADO';
        } else if (esAsimetrico) {
            colorHeader = '#ff6b35';
            textoHeader += ` ⚡ ${modo.etiqueta}`;
        } else if (esTrio) {
            colorHeader = '#C5A059';
            textoHeader += ' 🔱 TRÍO';
        } else if (partido.tipo === 'equipos3') {
            colorHeader = '#a78bfa';
            textoHeader += ' 🔄 AUSTRALIANA';
        }

        card.style.cssText = `position:relative; margin-bottom:15px; ${bordeEspecial}`;

        const partidoId = partido.id;

        // ✅ NUEVO: bloque timer para vista compacta
        let timerCompactoHTML = '';
        if (partido.tiempoInicio) {
            // ✅ FIX BUG 4: si el timer está pausado tiempoInicio es negativo
            // (almacena -elapsed). Sin este check el elapsed era Date.now()-(-x)
            // dando un número enorme y rompiendo la barra de progreso.
            const elapsed = partido.tiempoInicio < 0
                ? -partido.tiempoInicio
                : Date.now() - partido.tiempoInicio;
            const excedido = elapsed > limiteMs;
            const pct = Math.min(100, (elapsed / limiteMs) * 100).toFixed(1);
            const mins = Math.floor(elapsed / 60000).toString().padStart(2, '0');
            const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
            timerCompactoHTML = `
                <div style="display:flex; align-items:center; gap:8px; margin-top:8px; padding:6px 8px; background:#f8f9fa; border-radius:6px;">
                    <span data-partido-timer="${partido.tiempoInicio}"
                          style="font-family:monospace; font-size:0.9rem; font-weight:900;
                                 color:${excedido ? '#d9534f' : '#C5A059'};">
                        ${mins}:${secs}
                    </span>
                    <div style="flex:1; background:#e9ecef; height:4px; border-radius:4px; overflow:hidden;">
                        <div data-timer-bar
                             style="width:${pct}%; height:100%;
                                    background:${excedido ? '#d9534f' : '#C5A059'};">
                        </div>
                    </div>
                    ${excedido ? `<span style="font-size:0.55rem; color:#d9534f; font-weight:bold;">¡Tiempo!</span>` : ''}
                </div>`;
        }

        card.innerHTML = `
            <div class="pista-header" style="background:${colorHeader}; color:${(partido.esVenganza || partido.gamified) ? 'black' : 'white'}; font-weight:900; padding:5px 10px; border-radius:5px 5px 0 0; font-size:0.7rem; text-transform:uppercase; letter-spacing:1px;">
                ${textoHeader}
            </div>
            <div class="pista-body" style="padding:15px; background:white; border:1px solid #ddd; border-top:none; border-radius:0 0 5px 5px;">
                <div class="pista-jugadores" style="font-weight:bold; color:var(--atp-navy); margin-bottom:8px; font-size:${esTrio ? '0.8rem' : '0.9rem'}; line-height:1.2;">
                    ${nombresHTML}
                </div>
                ${timerCompactoHTML}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:0.7rem; color:#888;">🕒 ${partido.inicio || '--:--'}</span>
                        <span style="font-size:0.6rem; color:#aaa; text-transform:uppercase;">${partido.tipo || 'partido'}</span>
                    </div>
                    <div style="font-size:1rem; font-weight:900; color:var(--atp-navy); font-family:monospace; letter-spacing:1px;">
                        ${partido.gamified
                            ? '🎮 ' + (partido.ids || []).map(id => {
                                const pts = (partido.puntosGamificados && partido.puntosGamificados[id]) || 0;
                                return pts;
                              }).join('-')
                            : partido.tipo === 'equipos3'
                                ? (partido.marcador || '–')
                                : (partido.marcador || '0-0')
                        }
                    </div>
                    <button onclick="finalizarPartidoPorId('${partidoId}')" class="btn-terminar"
                        style="background:#d9534f; color:white; border:none; padding:6px 15px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:0.75rem; transition:0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        Terminar
                    </button>
                </div>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

function actualizarSugerenciasBusqueda() {
    const dl = document.getElementById('lista-nombres-cantera');
    if (!dl) return;

    // Solo mostramos los que NO están ya presentes hoy
    // ✅ FIX: String() para evitar discrepancias de tipo number vs string en IDs
    const sugerencias = db.jugadores.filter(j => 
        !window.jugadoresHoy.some(h => String(h.id) === String(j.id))
    );

    dl.innerHTML = sugerencias.map(j => `<option value="${escapeHtml(j.nombre)}">`).join('');
}

// Llama a esta función dentro de renderPresentes() para que se mantenga actualizada
// o cada vez que alguien entre en la pestaña de Pista.



// Usamos 'var' o declaración de función directa para evitar errores de duplicidad
/**
 * Comprueba si un jugador está actualmente jugando en alguna pista
 * Se usa en actualizarInterfazManual() para filtrar disponibles
 */
function estaJugando(id) {
    if (!id) return false;
    const idStr = id.toString();
    return window.partidosAbiertos.some(p => 
        Array.isArray(p.ids) && p.ids.map(String).includes(idStr)
    );
}

// ACTUALIZADO: Función de sincronización (sin 'const' para evitar el SyntaxError)

