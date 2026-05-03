/* ============================================================
   ATP PLATINUM — 31-hub-navegacion.js
   Navegación HUB: toggle jugador hoy, showSection, actualizaciones por pestaña, tablón, ciclo de noticias, acceso
   ── Refactor: extraído de script.js (líneas [(9914, 10343)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function toggleJugadorHoy(id, isChecked) {
    const idStr = id.toString();
    const jugador = db.jugadores.find(j => j.id.toString() === idStr);
    
    if (!jugador) return;

    if (isChecked) {
        // 1. INSERCIÓN SEGURA
        if (!window.jugadoresHoy.some(h => h.id.toString() === idStr)) {
            // Clonamos para independizar los datos de la sesión de los de la base de datos
            window.jugadoresHoy.push({ 
                ...jugador, 
                pausado: false, 
                estado: 'disponible', // 🛡️ Crucial: V1 y V2 solo leen jugadores 'disponibles'
                descansosSeguidos: 0,
                partidosJugadosHoy: 0,
                perdioUltimo: false // 🛡️ Al entrar nuevo, no tiene prioridad de venganza
            });
            console.log(`➕ ${jugador.nombre} añadido a la jornada.`);
        }
    } else {
        // 2. SEGURIDAD: Bloqueo si está en pista
        if (typeof estaJugando === 'function' && estaJugando(idStr)) {
            alert(`⚠️ No puedes quitar a ${jugador.nombre} porque está jugando un partido.`);
            
            // Re-marcar el checkbox visualmente si existe para evitar desincronización
            const chk = document.querySelector(`input[type="checkbox"][onchange*="${idStr}"]`);
            if (chk) chk.checked = true;
            return;
        }
        
        // 3. ELIMINACIÓN
        window.jugadoresHoy = window.jugadoresHoy.filter(h => h.id.toString() !== idStr);
        console.log(`➖ ${jugador.nombre} fuera de la jornada.`);
    }
    
    // 4. PERSISTENCIA Y REFRESCO
    saveDB();
    
    // Actualizamos las burbujas de jugadores presentes
    if (typeof renderPresentes === 'function') renderPresentes();
    // ✅ Actualizar paneles Hitos/Votos
    if (typeof renderVotos === 'function') renderVotos();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    
    // Sincronizamos la TV (por si los jugadores están mirando la lista de espera)
    if (typeof sincronizarTV === 'function') sincronizarTV();
    
    // Actualizamos el contador visual en el HUB si existe
    const contador = document.getElementById('count-presentes');
    if (contador) contador.innerText = window.jugadoresHoy.length;

    console.log(`✅ Estado: ${window.jugadoresHoy.length} jugadores en el club.`);
}


/**
 * ==========================================
 * LÓGICA PLATINUM: HUB, PARALLAX Y NOTICIAS
 * ==========================================
 */

// 2. NAVEGACIÓN
/**
 * showSection — RENDERER PURO. Su único trabajo es:
 *   1. Ocultar el HUB y mostrar la nav superior.
 *   2. Ocultar todas las .tab-content.
 *   3. Mostrar la sección destino.
 *   4. Disparar las actualizaciones específicas de esa sección.
 *
 * NO valida permisos ni jornada. Esa lógica vive en navegarA().
 * Los onclick de los botones nunca deben llamar showSection() directamente
 * — siempre deben pasar por navegarA() (o sus alias accederSistema*).
 *
 * Esto resuelve el bug de listas de validación duplicadas e inconsistentes:
 *   Antes:
 *     - showSection comprobaba [jornada,hitos-votos,analisis,control-pistas]
 *     - accederSistema comprobaba [jornada,hitos-votos,sec-mvp,analisis]
 *   Ahora la única lista vive en navegarA() y showSection no comprueba nada.
 */
function showSection(id) {
    const cleanId = id.replace('sec-', '').replace('sec_', '');

    console.log("📂 [renderer] mostrando sección:", cleanId);

    // 1. Ocultar HUB, mostrar nav
    const hub = document.getElementById('pantalla-inicio-hub');
    const navPrincipal = document.querySelector('nav');
    if (hub) hub.style.display = 'none';
    if (navPrincipal) navPrincipal.style.display = 'flex';

    // 2. Ocultar todas las secciones
    document.querySelectorAll('.tab-content').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });

    // 3. Limpiar contexto de partido en golpes si el usuario navega fuera de hitos-votos
    if (cleanId !== 'hitos-votos' && window._golpesContextoPartido) {
        window._golpesContextoPartido = null;
        const _ctxBanner = document.getElementById('golpes-partido-banner');
        if (_ctxBanner) _ctxBanner.innerHTML = '';
    }

    // 4. Mostrar la sección destino
    let target = document.getElementById(cleanId) || document.getElementById('sec-' + cleanId);
    if (!target) {
        console.warn(`[renderer] Sección ${cleanId} no encontrada, fallback a inicio`);
        target = document.getElementById('inicio');
    }

    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
        window.scrollTo(0, 0);
    }

    // 5. Ejecutar actualizaciones específicas de la sección
    if (typeof ejecutarActualizacionesPestaña === 'function') {
        ejecutarActualizacionesPestaña(cleanId);
    }
}

function ejecutarActualizacionesPestaña(id) {
    const cleanId = id.replace('sec-', '').replace('sec_', '');
    console.log(`📡 Actualizando datos para sección: ${cleanId}`);

    switch (cleanId) {
        case 'jornada':
            if (typeof renderPresentes === 'function') renderPresentes();
            if (typeof actualizarInterfazManual === 'function') actualizarInterfazManual();
            if (typeof renderPistas === 'function') renderPistas();
            if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
            if (typeof renderResultadosHoy === 'function') renderResultadosHoy();
            if (typeof renderHistorialHoy === 'function') renderHistorialHoy();
            if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();
            if (typeof generarCajasPistas === 'function') generarCajasPistas();
            // ✅ FIX TIMER CONGELADO: garantizar que el ticker corre al entrar en PISTA
            if (typeof iniciarTimerPartidos === 'function') iniciarTimerPartidos();
            break;

        case 'control-pistas':
            if (typeof renderControlPistas === 'function') renderControlPistas();
            // ✅ FIX TIMER CONGELADO: garantizar que el ticker corre en Control Pistas
            if (typeof iniciarTimerPartidos === 'function') iniciarTimerPartidos();
            break;

        case 'ranking':
            if (typeof renderRanking === 'function') renderRanking();
            if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
            break;

        case 'hitos-votos':
            if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
            break;

        case 'bbdd-jugadores':
            if (typeof renderCantera === 'function') renderCantera();
            break;

        case 'historial':
            if (typeof renderHistoricoGeneral === 'function') renderHistoricoGeneral();
            break;

        case 'mvp':          // ← importante: acepta tanto 'mvp' como 'sec-mvp'
        case 'sec-mvp':
            if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
            break;

        case 'analisis':
            if (typeof renderAnalisisAvanzado === 'function') renderAnalisisAvanzado();
            break;

        case 'inicio':
            if (typeof renderPresentes === 'function') renderPresentes();
            if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
            break;
    }
}


// 1. Efecto Parallax Sutil
document.addEventListener('mousemove', function(e) {
    var bg = document.getElementById('parallax-bg');
    var hub = document.getElementById('pantalla-inicio-hub');
    if (!bg || !hub || hub.style.display === 'none') return;

    var x = (window.innerWidth / 2 - e.pageX) / 30;
    var y = (window.innerHeight / 2 - e.pageY) / 30;

    bg.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(1.1)';
});

// 2. Generador de Datos Curiosos Dinámicos
function actualizarTablonAnuncios() {
    var cont = document.getElementById('tablon-contenido');
    if (!cont || !db || !db.jugadores || db.jugadores.length === 0) return;

    var jugadores = db.jugadores;
    var curiosidades = [];
    var jornadaEnCurso = window.jornadaActiva && !window.jornadaCerrada;

    // Función auxiliar para no repetir el patrón stats + golpesHoy en cada cálculo
    var mapaGolpesHoy = { aces: 'ace', winners: 'winner', smashes: 'smash', voleas: 'volea', dejadas: 'dejada', passings: 'passing' };
    var getGolpe = function(jugador, campo) {
        var permanente = (jugador.stats && jugador.stats[campo]) || 0;
        var claveHoy = mapaGolpesHoy[campo];
        // ✅ FIX: String(jugador.id) para coincidir con la clave normalizada por modG
        var hoy = jornadaEnCurso && claveHoy
            ? (((window.golpesGanadoresHoy || {})[String(jugador.id)] || {})[claveHoy] || 0)
            : 0;
        return permanente + hoy;
    };

    var mejorSacador = [...jugadores].sort(function(a, b) {
        return getGolpe(b, 'aces') - getGolpe(a, 'aces');
    })[0];

    var acesLider = mejorSacador ? getGolpe(mejorSacador, 'aces') : 0;
    if (mejorSacador && acesLider > 0) {
        curiosidades.push("🚀 <b>" + mejorSacador.nombre + "</b> es el terror del servicio con " + acesLider + " aces.");
    }

    var efectivo = [...jugadores]
        .filter(function(j) { return (j.stats && j.stats.totales || 0) >= 3; })
        .sort(function(a, b) {
            // ✅ FIX: normalizar ganados para el sort (evitar ganados > totales en el ranking)
            const rA = Math.min(a.stats.ganados || 0, a.stats.totales || 1) / (a.stats.totales || 1);
            const rB = Math.min(b.stats.ganados || 0, b.stats.totales || 1) / (b.stats.totales || 1);
            return rB - rA;
        })[0];

    if (efectivo) {
        // ✅ FIX: cap al 100% — ganados puede ser > totales por datos históricos
        const _ganSanos = Math.min(efectivo.stats.ganados || 0, efectivo.stats.totales || 1);
        var rate = Math.min(100, Math.round((_ganSanos / (efectivo.stats.totales || 1)) * 100));
        curiosidades.push("📈 ¡Imbatible! <b>" + escapeHtml(efectivo.nombre) + "</b> tiene una efectividad del " + rate + "%.");
    }

    var liderRanking = [...jugadores]
        .filter(function(j) { return (j.puntosTotales || 0) > 0; })
        .sort(function(a, b) { return (b.puntosTotales || 0) - (a.puntosTotales || 0); })[0];

    if (liderRanking) {
        curiosidades.push("👑 <b>" + liderRanking.nombre + "</b> lidera el ranking con " + liderRanking.puntosTotales + " puntos.");
    }

    var mejorWinner = [...jugadores].sort(function(a, b) {
        return getGolpe(b, 'winners') - getGolpe(a, 'winners');
    })[0];

    var winnersLider = mejorWinner ? getGolpe(mejorWinner, 'winners') : 0;
    if (mejorWinner && winnersLider > 0) {
        curiosidades.push("🔥 <b>" + mejorWinner.nombre + "</b> acumula " + winnersLider + " winners. Puro espectáculo.");
    }

    curiosidades.push("👥 Actualmente hay <b>" + jugadores.length + "</b> jugadores en la cantera Platinum.");

    var seleccionadas = curiosidades.sort(function() { return 0.5 - Math.random(); }).slice(0, 3);

    cont.innerHTML = seleccionadas.map(function(c) {
        return '<div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 15px; border-left: 3px solid #ccff00; animation: fadeIn 0.5s ease;">' +
               '<p style="margin:0; font-size: 0.95rem; color: rgba(255,255,255,0.9); line-height: 1.4;">' + c + '</p></div>';
    }).join('');
}

// 3. Control del Ciclo de Noticias
var intervaloTablon; 

function iniciarCicloNoticias() {
    if (intervaloTablon) clearInterval(intervaloTablon);
    actualizarTablonAnuncios();
    intervaloTablon = setInterval(function() {
        var cont = document.getElementById('tablon-contenido');
        if (cont) {
            cont.style.opacity = "0";
            cont.style.transform = "translateY(-10px)";
            setTimeout(function() {
                actualizarTablonAnuncios();
                cont.style.opacity = "1";
                cont.style.transform = "translateY(0)";
            }, 500);
        }
    }, 8000);
}



// 5. VOLVER AL HUB (REPARADO GLOBAL)
window.volverAlHub = function() {
    console.log("🏠 Regresando al HUB Platinum...");

    // 1. REACTIVAR EL CANDADO: Ahora permitimos que el Hub se muestre
    modoHubActivo = true;

    // ✅ FIX BUG BANNER VACÍO: al volver al HUB queremos ver el estado actual
    // real, no un mensaje "JORNADA REQUERIDA" o vacío que quedó pegado.
    // Limpiamos el flag _mostrandoErrorJornada y su timeout pendiente para
    // que verificarEstadoHub() de abajo pueda pintar el banner correcto.
    clearTimeout(window._errorJornadaClearTimer);
    window._errorJornadaClearTimer = null;
    window._mostrandoErrorJornada = false;

    const hub = document.getElementById('pantalla-inicio-hub');
    const navPrincipal = document.querySelector('nav');
    const header = document.querySelector('header');

    // 2. LIMPIAR SECCIONES COLGANTES (Bug #5: showSection deja .tab-content
    //    visibles. Si volvemos al HUB sin limpiar, al entrar a otra sección
    //    convive un instante con la anterior y se ve doble pintado).
    document.querySelectorAll('.tab-content').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });

    if (hub) {
        // 3. RESETEAR ESTILOS: Quitamos el display:none !important
        hub.style.removeProperty('display');
        hub.style.display = 'flex';
        hub.style.opacity = '1';
        hub.style.pointerEvents = 'auto';

        // 4. LIMPIEZA DE ESTRUCTURA APP
        if (navPrincipal) navPrincipal.style.display = 'none';
        if (header) header.style.display = 'none';

        // 5. REINICIAR SERVICIOS DEL HUB. Antes podían acumular setIntervals
        //    en cada vuelta al HUB. Ahora paramos el ciclo viejo antes
        //    de iniciar uno nuevo (Roce #10).
        // ✅ FIX BUG "banner desaparece": forzar=true para garantizar repintado
        // del estado real, sobreescribiendo cualquier banner temporal de carga.
        if (typeof verificarEstadoHub === 'function') verificarEstadoHub(true);
        if (window.intervaloTablon) {
            clearInterval(window.intervaloTablon);
            window.intervaloTablon = null;
        }
        if (typeof iniciarCicloNoticias === 'function') iniciarCicloNoticias();

        window.scrollTo(0, 0);
    }
};


// ==========================================
// 2. EL MONITOR: VERIFICAR ESTADO HUB
// ==========================================
function verificarEstadoHub(forzar = false) {
    // Si el usuario ya entró a la App, el monitor no debe tocar el display del Hub
    if (modoHubActivo === false) return;

    const alertBox = document.getElementById('hub-status-alert');
    if (!alertBox) return;

    // ✅ FIX BUG MEDIO 1: ISO slice(0,10) — comparación consistente entre locales
    const fechaActual = new Date().toISOString().slice(0, 10);
    const jornadaIniciada = (db && db.fechaEvento === fechaActual);

    // ✅ FIX BUG BANNER VACÍO: si la jornada está REALMENTE activa (db.fechaEvento=hoy),
    // pintamos el banner verde sin importar el flag _mostrandoErrorJornada.
    // El flag protegía un mensaje temporal "JORNADA REQUERIDA" durante 6s, pero si
    // mientras tanto el usuario inicia jornada (estado real cambió), el flag dejaba
    // el banner rojo congelado en pantalla. Estado real > flag temporal.
    if (jornadaIniciada) {
        window._mostrandoErrorJornada = false;
        clearTimeout(window._errorJornadaClearTimer);
        window._errorJornadaClearTimer = null;
        clearTimeout(window._cargandoClearTimer);
        window._cargandoClearTimer = null;
    } else if (window._mostrandoErrorJornada && !forzar) {
        // ✅ FIX BUG "banner desaparece tras refrescar":
        // Antes este return abortaba INCLUSO si el listener Firebase nos llamaba
        // con datos frescos. Si "Verificando permisos..." o "Sincronizando..."
        // habían pintado el banner antes y dejaron el flag a true, el listener
        // Firebase no podía actualizar el banner aunque trajera el estado real.
        // Resultado: banner quedaba congelado en "Sincronizando..." o vacío.
        // Ahora con forzar=true (pasado desde el listener Firebase) ignoramos
        // el flag y repintamos el estado real. Cualquier mensaje temporal
        // queda sobreescrito por el estado actual de la jornada.
        return;
    }

    // IMPORTANTE: Aseguramos que el Hub sea visible y el modal de apertura NO
    const hub = document.getElementById('pantalla-inicio-hub');
    const pApertura = document.getElementById('pantalla-apertura');
    if (hub) hub.style.display = 'flex';
    if (pApertura) pApertura.style.display = 'none';

    if (!jornadaIniciada) {
        // 👇 AQUÍ ESTÁ LA MAGIA: Ahora es un botón real con guard de auth 👇
        alertBox.innerHTML = `
            <div onclick="iniciarJornadaConAuth()" style="background: rgba(197, 160, 89, 0.15); color: #C5A059; padding: 15px; border-radius: 12px; text-align: center; border: 1px solid rgba(197, 160, 89, 0.5); cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.2); animation: pulse 2s infinite;">
                <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; opacity: 0.8;">🏆 Sistema en reposo</div>
                <b style="font-size: 1.2rem;">▶️ PULSA AQUÍ PARA INICIAR JORNADA</b>
            </div>
        `;
    } else {
        // La jornada ya está activa, se queda en verde normal
        alertBox.innerHTML = `
            <div style="background: rgba(204, 255, 0, 0.1); color: #ccff00; padding: 12px; border-radius: 12px; text-align: center; border: 1px solid rgba(204, 255, 0, 0.5);">
                <b>🟢 JORNADA ACTIVA (${fechaActual})</b>
            </div>
        `;
    }
}

// ==========================================
// 3. INICIAR JORNADA CON GUARD DE AUTH
// ==========================================
/**
 * Roce #7: antes había un onclick="if(rolUsuario==='admin'||rolUsuario==='arbitro'){iniciarJornada()}else{...}"
 * embebido en HTML. Lo extraemos a una función con un nombre claro.
 */
window.iniciarJornadaConAuth = function() {
    if (window.rolUsuario === 'admin' || window.rolUsuario === 'arbitro') {
        // ✅ FIX BUG BANNER VACÍO: si veníamos del banner rojo "JORNADA REQUERIDA"
        // el flag _mostrandoErrorJornada estaba a true con un timeout de 6s.
        // Si el usuario reacciona rápido (pulsa el banner para iniciar antes
        // de que pasen los 6s), iniciarJornada() arranca todo OK pero al
        // volver al HUB verificarEstadoHub() se sale por "if(_mostrandoErrorJornada)
        // return" y deja el banner rojo congelado o vacío. Limpiamos aquí
        // el flag y el timeout pendiente para que el render normal vuelva ya.
        clearTimeout(window._errorJornadaClearTimer);
        window._errorJornadaClearTimer = null;
        window._mostrandoErrorJornada = false;

        if (typeof iniciarJornada === 'function') iniciarJornada();
    } else {
        alert('⛔ Solo el árbitro o administrador puede iniciar la jornada.');
    }
};


// ==========================================
// 1. NAVEGACIÓN UNIFICADA
// ==========================================
/**
 * navegarA — ÚNICA función de navegación con validación de permisos.
 *
 * Esta es la función central que toda la app debe usar para cambiar de
 * sección. Centraliza toda la lógica de:
 *   - Validación de jornada activa.
 *   - Manejo del estado "todavía no sé si hay jornada" (Firebase tarda).
 *   - Mostrar el banner adecuado en el HUB cuando algo falla.
 *   - Llamar al renderer (showSection) cuando todo está OK.
 *
 * Las validaciones de auth/rol viven en accederSistemaConAuth (auth-acceso.js)
 * que envuelve a esta función. Esta función asume que el usuario YA pasó la
 * validación de permisos.
 *
 * Lista única y autoritativa de secciones que requieren jornada activa.
 */
const _SECCIONES_REQUIEREN_JORNADA = ['jornada', 'hitos-votos', 'sec-mvp', 'control-pistas', 'analisis'];

window.navegarA = function(id) {
    console.log("🧭 [navegarA] destino:", id);

    const cleanId = id.replace('sec-', '').replace('sec_', '');
    const requiereJornada = _SECCIONES_REQUIEREN_JORNADA.includes(id) ||
                            _SECCIONES_REQUIEREN_JORNADA.includes('sec-' + cleanId);

    if (requiereJornada) {
        // Diferenciamos 3 estados:
        //   1. jornadaActiva === true   → entra
        //   2. jornadaActiva === false  → bloquea, banner JORNADA REQUERIDA
        //   3. jornadaActiva === undef  → Firebase aún no ha respondido,
        //                                  mostramos un mensaje suave y esperamos
        //                                  un poco antes de bloquear (race condition fix)
        if (window.jornadaActiva === true) {
            // OK, sigue
        } else if (window.jornadaActiva === false) {
            mostrarBannerJornadaRequerida();
            modoHubActivo = true;
            mostrarHubSinNavegar();
            return;
        } else {
            // jornadaActiva === undefined → estado de carga
            console.log("⏳ [navegarA] estado de jornada aún no conocido, esperando...");
            mostrarBannerCargando();
            modoHubActivo = true;
            mostrarHubSinNavegar();
            // Reintentar tras 800ms (suficiente para que Firebase responda)
            setTimeout(() => {
                if (window.jornadaActiva === true) {
                    navegarA(id);
                } else {
                    mostrarBannerJornadaRequerida();
                }
            }, 800);
            return;
        }
    }

    // Todo OK: ocultar HUB y dejar paso al renderer
    modoHubActivo = false;
    const hub = document.getElementById('pantalla-inicio-hub');
    if (hub) hub.style.display = 'none';
    showSection(id);
};

// Helper: muestra solo el HUB sin navegar a una sección
function mostrarHubSinNavegar() {
    const hub = document.getElementById('pantalla-inicio-hub');
    const navPrincipal = document.querySelector('nav');
    const header = document.querySelector('header');
    if (hub) {
        hub.style.removeProperty('display');
        hub.style.display = 'flex';
        hub.style.opacity = '1';
        hub.style.pointerEvents = 'auto';
    }
    if (navPrincipal) navPrincipal.style.display = 'none';
    if (header) header.style.display = 'none';
    document.querySelectorAll('.tab-content').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });
}

function mostrarBannerJornadaRequerida() {
    const alertBox = document.getElementById('hub-status-alert');
    if (!alertBox) return;
    // Marcar flag para que verificarEstadoHub no pise este mensaje
    window._mostrandoErrorJornada = true;
    alertBox.innerHTML = `
        <div onclick="iniciarJornadaConAuth()" style="background:#ff4d4d;color:white;padding:15px;border-radius:10px;cursor:pointer;font-weight:bold;animation:pulse 2s infinite;text-align:center;">
            ⚠️ JORNADA REQUERIDA. PULSA AQUÍ PARA INICIAR.
        </div>`;
    // Auto-clear del flag tras 6s para que el ciclo normal vuelva
    clearTimeout(window._errorJornadaClearTimer);
    window._errorJornadaClearTimer = setTimeout(() => {
        window._mostrandoErrorJornada = false;
        if (typeof verificarEstadoHub === 'function') verificarEstadoHub();
    }, 6000);
}

function mostrarBannerCargando() {
    const alertBox = document.getElementById('hub-status-alert');
    if (!alertBox) return;
    window._mostrandoErrorJornada = true;
    alertBox.innerHTML = `
        <div style="background:rgba(0,212,255,0.15);color:#00d4ff;padding:15px;border-radius:10px;text-align:center;border:1px solid rgba(0,212,255,0.4);">
            <b>⏳ Sincronizando con el servidor...</b>
            <div style="font-size:0.78rem;opacity:0.85;margin-top:6px;">Espera un momento mientras se carga el estado de la jornada</div>
        </div>`;

    // ✅ FIX BUG "banner desaparece al refrescar":
    // Antes este flag se quedaba a true PEGADO sin auto-clear. El siguiente
    // verificarEstadoHub() abortaba por la guard `if (_mostrandoErrorJornada) return`,
    // dejando el banner pegado en "Sincronizando..." aunque la jornada ya estuviese
    // activa. Solo al volver al HUB (que limpia el flag explícitamente) se
    // recuperaba el estado verde correcto.
    //
    // Ahora auto-clear tras 3s con re-evaluación: cuando el flag expire,
    // verificarEstadoHub vuelve a ejecutarse y pinta el estado real (verde
    // si jornada activa, dorado si no).
    clearTimeout(window._cargandoClearTimer);
    window._cargandoClearTimer = setTimeout(() => {
        window._mostrandoErrorJornada = false;
        if (typeof verificarEstadoHub === 'function') verificarEstadoHub();
    }, 3000);
}

// ── Compatibilidad: aliases para no romper los onclick existentes en HTML ──
//
// Antes había dos funciones (accederSistema y accederSistemaConAuth). Las
// dejamos como aliases que apuntan a la nueva navegarA(), de modo que todos
// los onclick="accederSistema('xxx')" del HTML siguen funcionando sin cambio.
//
// La validación de auth/rol está en accederSistemaConAuth que vive en
// auth-acceso.js (porque depende de la instancia de auth de Firebase).
window.accederSistema = navegarA;

function editarPartidoActivo(idPartido) {
    // ✅ FIX: String() en ambos lados — mismo patrón que menuEdicionRapida
    const partido = window.partidosAbiertos.find(p => String(p.id) === String(idPartido));
    if (!partido) return alert("❌ Partido no encontrado.");

    // 1. Pedir nueva pista (ejemplo rápido por prompt, puedes usar modal)
    const nuevaPista = prompt(`Editar Pista (Actual: ${partido.pista}):`, partido.pista);
    
    if (nuevaPista !== null) {
        partido.pista = nuevaPista;
        
        // 2. Si es un error de nombres (solo visual para el historial)
        const nuevoNombre = prompt(`Editar nombres/título:`, partido.nombres);
        if (nuevoNombre) partido.nombres = nuevoNombre;

        // 3. Persistencia y Refresco
        saveDB();
        if (typeof renderPistas === 'function') renderPistas();
        if (typeof sincronizarTV === 'function') sincronizarTV();
        
        console.log(`✏️ Partido ${idPartido} editado: Pista ${partido.pista}`);
    }
}

// Alias seguro: redirige a la versión mejorada
function cambiarJugadorEnPartido(idPartido, idViejo, idNuevo) {
    // 🛡️ Delegamos a ejecutarCambioJugador que tiene todas las validaciones
    ejecutarCambioJugador(idPartido, idViejo, idNuevo);
}

