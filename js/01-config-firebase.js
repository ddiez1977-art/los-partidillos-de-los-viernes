/* ============================================================
   ATP PLATINUM — 01-config-firebase.js
   Configuración Firebase, globales, saveDB, listener, helpers básicos
   ── Refactor: extraído de script.js (líneas [(1, 569)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// 1. VARIABLES GLOBALES (UNIFICADAS Y SEGURAS)
// ==========================================
// ==========================================
// 1. CONFIGURACIÓN FIREBASE Y GLOBALES
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCd45h83axpDzPQOJqf61FmiqHfXXtGb8M",
  authDomain: "los-partidillos-de-los-viernes.firebaseapp.com",
  databaseURL: "https://los-partidillos-de-los-viernes-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "los-partidillos-de-los-viernes",
  storageBucket: "los-partidillos-de-los-viernes.firebasestorage.app",
  messagingSenderId: "561411700558",
  appId: "1:561411700558:web:fbaf92d3f170a2f5dc901f"
};

// Inicializar Firebase (guard contra doble inicialización en recargas parciales)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Variables Globales Estructurales
const TOTAL_PISTAS_MAX = 8; 
let modoHubActivo = true;
let isFirstLoad = true; // 👈 Nos avisará cuando Firebase termine de descargar los datos

// La BBDD ahora nace vacía. Se llenará en 0.1 segundos desde la nube.
var db = { 
    jugadores: [], 
    historicoJornadas: [], 
    jugadoresHoy: [], 
    partidosAbiertos: [], 
    partidosRecientes: [],
    fechaEvento: null,
    mvpIdHoy: null,
    mvpIdsHoy: [],
    // ✅ MVP dual — jugadores (votos verbales) y entrenadores (selección directa)
    mvpIdsJugadores: [],
    mvpIdsEntrenadores: [],
    votosJugadoresMVP: {},
    golpesGanadoresHoy: {}
};

// === GLOBALES OFICIALES (Vacías hasta que Firebase hable) ===
window.jugadoresHoy = [];
window.partidosAbiertos = [];
window.partidosFinalizadosHoy = [];
window.mvpIdHoy = null;
window.mvpIdsHoy = [];
// ✅ MVP dual
window.mvpIdsJugadores    = [];
window.mvpIdsEntrenadores = [];
window.votosJugadoresMVP  = {};
window.golpesGanadoresHoy = {};
window.planesTemporales = []; 
window.preseleccionGamificado = [];
// Asistencia rápida se puede quedar local porque es solo comodidad visual de cada dispositivo
window.asistenciaRapida = JSON.parse(localStorage.getItem('asistenciaRapida')) || [];

// Cronómetro y Memoria
let timeLeft = 900; // 15 minutos
let countdown = null;
let isRunning = false;

// ✅ FIX: eliminado const tvChannel = new BroadcastChannel('atp_tv_sync') que estaba aquí.
// Se creaba un segundo canal con el mismo nombre al llegar isFirstLoad (línea ~286),
// dejando dos BroadcastChannel simultáneos activos — memory leak y mensajes duplicados.
// Todo el código usa window.tvChannel exclusivamente; este era un residuo sin uso.

// ==========================================
// GUARDADO BLINDADO
// ==========================================
const saveDB = () => {
    // ==========================================
    // 0. ESCUDO ANTI-NEGATIVOS, SANEAMIENTO Y ANTI-NaN
    // ==========================================
    if (db.jugadores) {
        db.jugadores.forEach(j => {
            // 1. Asegurar existencia de la estructura base
            if (!j.stats) {
                j.stats = { 
                    ganados: 0, perdidos: 0, totales: 0, 
                    juegosFavor: 0, juegosContra: 0, 
                    simples: 0, dobles: 0, gamificados: 0, trios: 0,
                    asimetrico: 0, australiana: 0
                };
            }

            // ✨ BLINDAJE ESPECÍFICO PARA TRÍOS
            if (!j.stats.trios || isNaN(j.stats.trios)) j.stats.trios = 0;
            if (isNaN(j.victoriasTrios)) j.victoriasTrios = 0;
            // ✅ Blindaje asimétrico y australiana
            if (!j.stats.asimetrico || isNaN(j.stats.asimetrico)) j.stats.asimetrico = 0;
            if (!j.stats.australiana || isNaN(j.stats.australiana)) j.stats.australiana = 0;

            // 2. LIMPIEZA RADICAL: Si es NaN o valor corrupto (< -900), reset a 0
            if (isNaN(j.stats.juegosFavor)  || j.stats.juegosFavor  < -900) j.stats.juegosFavor  = 0;
            if (isNaN(j.stats.juegosContra) || j.stats.juegosContra < -900) j.stats.juegosContra = 0;
            if (isNaN(j.puntosTotales)      || j.puntosTotales < 0)         j.puntosTotales       = 0;

            // 3. BLINDAJE PARA FIREBASE (Evita cuelgues al cerrar jornada)
            if (isNaN(j.stats.simples))     j.stats.simples     = 0;
            if (isNaN(j.stats.dobles))      j.stats.dobles      = 0;
            if (isNaN(j.stats.gamificados)) j.stats.gamificados = 0;
            if (isNaN(j.stats.trios))       j.stats.trios       = 0; // ✅ NUEVO
            // ✅ Blindaje completo para todos los campos stats
            const _statsNum = ['ganados','perdidos','totales','mvps',
                               'aces','winners','smashes','voleas','dejadas','passings'];
            _statsNum.forEach(k => {
                if (!j.stats[k] || isNaN(j.stats[k])) j.stats[k] = 0;
                j.stats[k] = Math.max(0, Number(j.stats[k]));
            });

            // 4. Forzar que sean números puros (Reparar strings accidentales)
            j.stats.juegosFavor  = Number(j.stats.juegosFavor);
            j.stats.juegosContra = Number(j.stats.juegosContra);
            j.stats.simples      = Number(j.stats.simples);
            j.stats.dobles       = Number(j.stats.dobles);
            j.stats.gamificados  = Number(j.stats.gamificados);
            j.stats.trios        = Number(j.stats.trios);
            // ✅ FIX: asimetrico y australiana estaban blindados contra NaN arriba pero
            // no se forzaban a Number() aquí — podían quedar como strings si Firebase
            // los deserializaba como texto, rompiendo la suma += en partidas futuras.
            j.stats.asimetrico   = Number(j.stats.asimetrico   || 0);
            j.stats.australiana  = Number(j.stats.australiana  || 0);
            j.puntosTotales      = Number(j.puntosTotales);
        });
    }

    // ==========================================
    // 1. CLONACIÓN PROFUNDA (Memoria a BBDD)
    // ==========================================
    db.jugadoresHoy      = JSON.parse(JSON.stringify(window.jugadoresHoy || []));
    db.partidosAbiertos  = JSON.parse(JSON.stringify(window.partidosAbiertos || []));
    db.partidosRecientes = JSON.parse(JSON.stringify(window.partidosFinalizadosHoy || []));
    db.golpesGanadoresHoy = JSON.parse(JSON.stringify(window.golpesGanadoresHoy || {}));

    // ==========================================
    // 2. PERSISTENCIA DEL MVP
    // ==========================================
    if (window.mvpIdHoy !== undefined && window.mvpIdHoy !== null) {
        db.mvpIdHoy = window.mvpIdHoy;
    } else {
        db.mvpIdHoy = null; 
    }
    // Sync array multi-MVP
    db.mvpIdsHoy = Array.isArray(window.mvpIdsHoy) ? [...window.mvpIdsHoy] : [];
    // ✅ MVP dual
    db.mvpIdsJugadores    = Array.isArray(window.mvpIdsJugadores)    ? [...window.mvpIdsJugadores]    : [];
    db.mvpIdsEntrenadores = Array.isArray(window.mvpIdsEntrenadores) ? [...window.mvpIdsEntrenadores] : [];
    db.votosJugadoresMVP  = window.votosJugadoresMVP ? { ...window.votosJugadoresMVP } : {};
    
    // ==========================================
    // 3. GUARDADO FÍSICO Y NUBE (Doble Seguridad)
    // ==========================================
    localStorage.setItem('asistenciaRapida', JSON.stringify(window.asistenciaRapida || []));
    
    if (typeof database !== 'undefined') {
        // ✅ FIX RACE CONDITION FIREBASE (mejorado): Usamos contador en lugar de booleano.
        // Con booleano, si dos saveDB() se lanzan en rápida sucesión (ej: +marcador + render),
        // el primero en resolver pone la bandera a false aunque el segundo sigue en vuelo,
        // dejando una ventana donde el listener acepta el echo del segundo .set().
        // Con contador: _guardandoDB > 0 significa "hay al menos un .set() en vuelo".
        if (!window._guardandoDB) window._guardandoDB = 0;
        window._guardandoDB++;
        // ✅ FIX NJ-PERSIST: retornamos la Promise para que njArchivarJornada
        // pueda esperar la confirmación real de Firebase antes de limpiar el formulario.
        return database.ref('torneoPlatinum').set(db)
            .then(() => {
                window._guardandoDB = Math.max(0, window._guardandoDB - 1);
                console.log(`☁️ DB Saneada y subida a la nube - ${new Date().toLocaleTimeString()}`);
                // ==========================================
                // 4. SINCRONIZACIÓN CON TV Y REFRESCO DE VISTAS
                // ✅ FIX BUG ALTO 1: este bloque estaba DESPUÉS del return — código
                // inalcanzable. Movido dentro del .then() para que se ejecute
                // tras confirmar el guardado en Firebase.
                // ==========================================
                const hubVisible = document.getElementById('pantalla-inicio-hub')?.style.display !== 'none';
                if (hubVisible && typeof verificarEstadoHub === 'function') verificarEstadoHub();
                // Solo renderizar análisis si la pestaña está activa
                const seccionAnalisis = document.getElementById('analisis');
                if (seccionAnalisis && seccionAnalisis.classList.contains('active')) {
                    if (typeof renderAnalisisAvanzado === 'function') renderAnalisisAvanzado();
                }
            })
            .catch(err => {
                window._guardandoDB = Math.max(0, window._guardandoDB - 1);
                console.error("❌ Error de red con Firebase. Guardando en LocalStorage temporalmente:", err);
                localStorage.setItem('tenisDB', JSON.stringify(db)); 
            });
    } else {
        console.warn("⚠️ Firebase no detectado. Guardado clásico activado.");
        localStorage.setItem('tenisDB', JSON.stringify(db));
        return Promise.resolve();
    }
};

// ==========================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ==========================================
// ==========================================
// ESCUCHADOR EN TIEMPO REAL FIREBASE (Sustituye al DOMContentLoaded)
// ==========================================
database.ref('torneoPlatinum').on('value', (snapshot) => {
    // ✅ FIX RACE CONDITION: Si hay un .set() nuestro en vuelo, ignoramos este trigger.
    // El .on('value') se dispara por TODOS los cambios — incluso los que hacemos nosotros.
    // Sin esta bandera, el listener sobreescribe window.partidosAbiertos con los datos
    // que vienen de la nube justo después de que saveDB() haya actualizado la memoria local,
    // deshaciendo el estado correcto si Firebase tarda en devolver el nuevo valor.
    if (window._guardandoDB > 0) {
        console.log("🔒 Listener Firebase ignorado (guardado propio en vuelo).");
        return;
    }

    // ✅ FIX RACE CONDITION NJ: Tras un guardado de jornada admin, Firebase puede
    // disparar el listener con una versión parcialmente propagada (sin el nuevo
    // historicoJornadas). Bloqueamos el listener durante 3 segundos adicionales
    // tras cualquier guardado admin reciente.
    if (window._njGuardadoReciente && Date.now() - window._njGuardadoReciente < 3000) {
        console.log("🔒 Listener Firebase ignorado (guardado admin reciente, grace period).");
        return;
    }

    const data = snapshot.val();
    
    // 1. Cargamos los datos de la nube
    db = data || {};

    console.log("🚀 Datos recibidos de Firebase:", data); // Log de datos

    // 🛡️ SINCRONIZACIÓN DE ESTADO DE JORNADA (Auto-detección)
    // ✅ FIX BUG MEDIO 1: toLocaleDateString() varía por locale del dispositivo
    // ("25/4/2026" en ES, "4/25/2026" en US). Si el admin guarda desde un locale
    // distinto al del listener, la comparación falla y los partidos se borran como
    // "huérfanos" aunque sean del día correcto. Usamos ISO slice(0,10) siempre.
    const hoy = new Date().toISOString().slice(0, 10); // "2026-04-25"

    // ✅ FIX BUG "jornada activa a veces no aparece":
    // Si la sesión actual ya marcó la jornada como activa para hoy
    // (window._jornadaIniciadaSesion = hoy), no la pisamos a false aunque
    // db.fechaEvento aún no haya llegado en este snapshot. Esto evita el race
    // condition: iniciarJornada() pone window.jornadaActiva=true y dispara
    // saveDB(); pero entre el momento que devuelve y que Firebase confirma,
    // un listener tardío con un snapshot anterior podía pisar a false y bloquear
    // la navegación con "JORNADA REQUERIDA" en pantalla.
    const sesionLaInició = (window._jornadaIniciadaSesion === hoy);
    if (db.fechaEvento === hoy) {
        window.jornadaActiva = true;
    } else if (sesionLaInició) {
        // El snapshot llegó vacío/desfasado pero esta sesión iniciaste hoy:
        // mantenemos el estado local. Cuando Firebase devuelva el dato real,
        // este listener volverá a confirmarlo.
        console.log("🛡️ Listener: jornadaActiva preservada por flag de sesión");
        window.jornadaActiva = true;
    } else {
        window.jornadaActiva = false;
    }
    window.jornadaCerrada = (db.fechaEvento && db.fechaEvento !== hoy);

    // 🛡️ EL ESCUDO ANTI-UNDEFINED (Soluciona los errores .find y .filter)
    // ✅ FIX BUG ALTO 2: el patrón `|| []` NO protege contra objetos de Firebase.
    // Firebase serializa arrays como objetos {0:..,1:..} cuando hay muchos elementos
    // o tras reconexión. Un objeto truthy no activa el `||` y todos los .find/.filter
    // posteriores fallan silenciosamente. Usamos Array.isArray + Object.values.
    const _toArr = v => Array.isArray(v) ? v : Object.values(v || {});
    db.jugadores          = _toArr(db.jugadores);
    db.historicoJornadas  = _toArr(db.historicoJornadas);
    db.jugadoresHoy       = _toArr(db.jugadoresHoy);
    db.partidosAbiertos   = _toArr(db.partidosAbiertos);
    db.partidosRecientes  = _toArr(db.partidosRecientes);
    db.convocatoriaActiva = _toArr(db.convocatoriaActiva);
    db.convocatoriaAbierta = db.convocatoriaAbierta || false;

    // ✅ FIX BUG "renderizado silenciosamente roto":
    // SANEAMIENTO PROPIEDADES MÍNIMAS POR JUGADOR — al cargar desde Firebase,
    // algunos jugadores antiguos pueden tener:
    //   - nombre = undefined / null / no existir (rompía .sort con localeCompare)
    //   - id     = numérico mientras el código asume string (roturas en .find)
    //   - estructura faltante general
    // Antes esto reventaba renderListaConvocatoria, renderRanking, sortBBDD...
    // funciones críticas explotaban silenciosamente y la UI se quedaba vacía o
    // con placeholders. Saneamos UNA vez aquí en lugar de blindar 20 funciones.
    db.jugadores = db.jugadores
        .filter(j => j && typeof j === 'object')
        .map(j => {
            j.id     = String(j.id ?? '');
            j.nombre = (typeof j.nombre === 'string' && j.nombre.trim())
                ? j.nombre
                : '(Sin nombre)';
            return j;
        });
    db.jugadoresHoy = db.jugadoresHoy
        .filter(j => j && typeof j === 'object')
        .map(j => {
            j.id     = String(j.id ?? '');
            j.nombre = (typeof j.nombre === 'string' && j.nombre.trim())
                ? j.nombre
                : '(Sin nombre)';
            return j;
        });
    // convocatoriaActiva debe ser array de strings (IDs)
    db.convocatoriaActiva = db.convocatoriaActiva.map(x => String(x));

    // ✅ FIX BUG PISTAS: restaurar estado de cajas desde Firebase
    db.pistasEstado = (db.pistasEstado && typeof db.pistasEstado === 'object') ? db.pistasEstado : {};
    if (Object.keys(db.pistasEstado).length > 0 && typeof generarCajasPistas === 'function') {
        generarCajasPistas();
    }

    // 2. Sincronizar variables globales de memoria
    window.jugadoresHoy = db.jugadoresHoy;
    window.partidosAbiertos = db.partidosAbiertos;
    window.partidosFinalizadosHoy = db.partidosRecientes;
    // ✅ Restaurar golpes del día tras reload
    window.golpesGanadoresHoy = (db.golpesGanadoresHoy && typeof db.golpesGanadoresHoy === 'object')
        ? { ...db.golpesGanadoresHoy } : {};
    window.mvpIdHoy = db.mvpIdHoy || null;
    // Multi-MVP: si existe el array lo usamos, si solo hay mvpIdHoy lo convertimos
    window.mvpIdsHoy = Array.isArray(db.mvpIdsHoy) && db.mvpIdsHoy.length
        ? db.mvpIdsHoy.map(String)
        : (db.mvpIdHoy ? [String(db.mvpIdHoy)] : []);
    // ✅ MVP dual
    window.mvpIdsJugadores    = Array.isArray(db.mvpIdsJugadores)    ? db.mvpIdsJugadores.map(String)    : [];
    window.mvpIdsEntrenadores = Array.isArray(db.mvpIdsEntrenadores) ? db.mvpIdsEntrenadores.map(String) : [];
    window.votosJugadoresMVP  = (db.votosJugadoresMVP && typeof db.votosJugadoresMVP === 'object')
        ? { ...db.votosJugadoresMVP } : {};
    // votosDe: mapa votanteId → candidatoId, usado por el panel de votación en pista
    if (!db.votosDe || typeof db.votosDe !== 'object') db.votosDe = {};

    // ✅ LIMPIEZA DE PARTIDOS HUÉRFANOS DE JORNADA ANTERIOR
    // Condiciones de seguridad ANTES de limpiar:
    // 1. Que haya una fecha de evento guardada (no es jornada nueva o vacía)
    // 2. Que esa fecha sea claramente de un día DIFERENTE a hoy
    // 3. Que realmente haya partidos abiertos que limpiar
    // ✅ Ahora usa hoy en lugar de hoyVerif (misma lógica, sin duplicado)
    const hayFechaAnterior = db.fechaEvento && db.fechaEvento !== hoy;

     if (hayFechaAnterior) {
        if (window.partidosAbiertos && window.partidosAbiertos.length > 0) {
            console.warn(`🧹 Partidos huérfanos detectados (jornada: ${db.fechaEvento}, hoy: ${hoy}). Limpiando en memoria...`);
            window.partidosAbiertos = [];
            db.partidosAbiertos = [];
        }
        if (window.partidosFinalizadosHoy && window.partidosFinalizadosHoy.length > 0) {
            console.warn(`🧹 Resultados de jornada anterior limpiados en memoria.`);
            window.partidosFinalizadosHoy = [];
            db.partidosRecientes = [];
        }
    }

    // CASO SEPARADO: Sin ninguna jornada activa (fecha null)
    // Solo limpiamos partidos abiertos, los finalizados pueden ser del histórico
    if (!db.fechaEvento) {
        if (window.partidosAbiertos && window.partidosAbiertos.length > 0) {
            console.warn(`🧹 Partidos abiertos sin jornada activa. Limpiando en memoria...`);
            window.partidosAbiertos = [];
            db.partidosAbiertos = [];
        }
    }

    if (isFirstLoad) {
        console.log("☁️ BBDD Nube Conectada. Iniciando ATP Platinum v.2026...");
        isFirstLoad = false;

        window.tvChannel = new BroadcastChannel('atp_tv_sync');
        window.tvChannel.onmessage = (event) => {
            if (event.data && event.data.action === 'REQUEST_DATA') {
                if (typeof sincronizarTV === 'function') sincronizarTV();
            }
        };

        // 2. INTERFAZ Y COMPONENTES — restaurar config de pistas del club
        const pistasInput = document.getElementById('plan-pistas-totales');
        const savedPistasClub = localStorage.getItem('atp_pistas_club');
        if (pistasInput) {
            if (savedPistasClub) pistasInput.value = savedPistasClub;
            window.TOTAL_PISTAS_MAX = parseInt(pistasInput.value) || 8;
            // ✅ FIX BUG PERMISSION_DENIED: el path /torneoPlatinum/numPistasClub
            // hereda escritura de torneoPlatinum: admins y árbitros pueden.
            // Antes intentábamos escribirlo en CADA carga de página (incluso para
            // usuarios sin rol), lo que provocaba un WARNING ruidoso
            // "permission_denied" en consola. Ahora solo si tienes rol activo.
            if (typeof database !== 'undefined' &&
                (window.rolUsuario === 'admin' || window.rolUsuario === 'arbitro')) {
                database.ref('torneoPlatinum/numPistasClub').set(window.TOTAL_PISTAS_MAX)
                    .catch(() => {});
            }
        }

        // ✅ FIX: Rellenar fecha en el header — solo para display, no comparación con DB
        const fechaEl = document.getElementById('fecha-actual-display');
        if (fechaEl) fechaEl.innerText = new Date().toLocaleDateString();

        if (typeof generarCajasPistas === 'function')          generarCajasPistas();
        if (typeof actualizarInterfazManual === 'function')     actualizarInterfazManual();
        if (typeof actualizarContadoresPistas === 'function')   actualizarContadoresPistas();
        if (typeof renderPresentes === 'function')              renderPresentes();
        // ✅ FIX BUG MENOR: renderRankingEspecialistas estaba duplicada (aquí y línea ~340).
        // Eliminada esta primera llamada — se ejecuta una sola vez más abajo con el resto.
        if (typeof actualizarSugerenciasBBDD === 'function')    actualizarSugerenciasBBDD();
        // En isFirstLoad, sustituir las dos líneas sueltas:
//   if (typeof renderPistas === 'function') renderPistas();
// Por:

const contP = document.getElementById('partidos-abiertos-container');
const contA = document.getElementById('contenedor-pistas-jornada');
if (contP && typeof renderPistas === 'function') renderPistas();
if (contA && typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
        if (typeof renderAnalisisAvanzado === 'function')       renderAnalisisAvanzado();
        if (typeof renderRanking === 'function')                renderRanking();
        if (typeof renderRankingEspecialistas === 'function')   renderRankingEspecialistas();
        if (typeof renderHistoricoGeneral === 'function')       renderHistoricoGeneral();
        if (typeof renderListaConvocatoria === 'function')      renderListaConvocatoria();
        if (typeof actualizarBadgeConvocatoria === 'function')  actualizarBadgeConvocatoria();
        if (typeof actualizarContadorConvocatoriaHub === 'function') actualizarContadorConvocatoriaHub();
        if (typeof renderHistorialHoy === 'function')           renderHistorialHoy();
        if (typeof renderResultadosHoy === 'function')          renderResultadosHoy();
        if (typeof renderGolpesGanadores === 'function')        renderGolpesGanadores();
        if (typeof renderSeccionMVP === 'function')             renderSeccionMVP();
        if (typeof actualizarTicker === 'function')             actualizarTicker();
        // ✅ FIX BUG PROPAGACIÓN PISTAS: cuando otro dispositivo cambia
        // db.pistasEstado (admin marca pista nueva en otro tablet, p.ej.),
        // el snapshot llega aquí. Repoblar el selector y badge para que
        // los cambios se vean inmediatamente.
        if (typeof poblarSelectPistaManual === 'function') {
            try { poblarSelectPistaManual(); } catch(e) {}
        }
        if (typeof actualizarBadgePistas === 'function') {
            try { actualizarBadgePistas(); } catch(e) {}
        }

        // ✅ FIX ticker interval (ya aplicado en doc 3, se mantiene)
        if (window._tickerInterval) clearInterval(window._tickerInterval);
        window._tickerInterval = setInterval(() => {
            if (typeof actualizarTicker === 'function') actualizarTicker();
        }, 20000);

        // ✅ FIX BUG MEDIO 2: esta llamada carecía del guard !window._timerPartidosInterval.
        // Si iniciarTimerPartidos() no setea _timerPartidosInterval antes de que el bloque
        // else (updates en tiempo real) evalúe el guard, se crean dos intervalos simultáneos
        // que actualizan los timers el doble de rápido. Añadimos el mismo guard aquí.
        if (typeof iniciarTimerPartidos === 'function' && !window._timerPartidosInterval) {
            iniciarTimerPartidos();
        }


        // 3. EVENTOS DE TECLADO
        const inputNuevo = document.getElementById('input-nuevo-asistente');
        if (inputNuevo) {
            inputNuevo.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); 
                    crearYAgregarJugador();
                }
            });
        }

        // 4. CONTROL MAESTRO DEL HUB
        const hub = document.getElementById('pantalla-inicio-hub');
        const navPrincipal = document.querySelector('nav'); 
        const pApertura = document.getElementById('pantalla-apertura'); 
        
        if (hub) {
            hub.style.display = 'flex';
            hub.style.opacity = '1';
            if (navPrincipal) navPrincipal.style.display = 'none';
            if (pApertura) pApertura.style.display = 'none'; 
            
            if (typeof actualizarTablonAnuncios === 'function') actualizarTablonAnuncios();
            if (typeof iniciarCicloNoticias === 'function') iniciarCicloNoticias();
            // ✅ FIX BUG "banner desaparece tras refrescar": forzar=true para que
            // verificarEstadoHub ignore cualquier flag temporal y repinte siempre
            // el estado real ahora que tenemos los datos frescos del servidor.
            if (typeof verificarEstadoHub === 'function') verificarEstadoHub(true);
            // ✅ FIX: Inicializar widget de estado del HUB al arrancar
            if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
        } else {
            if (typeof showSection === 'function') showSection('inicio');
        }
        
                
        console.log(`✅ Centro de Mando Platinum Activo y Sincronizado en la Nube`);

    } else {
        // --- 🔄 ACTUALIZACIÓN EN TIEMPO REAL (Alguien tocó algo desde otro dispositivo) ---
        console.log("🔄 Datos modificados en la nube. Refrescando pantallas...");
        
        // Si alguien se apunta desde la web, refrescamos la lista de la pestaña Inicio
        const seccionInicio = document.getElementById('inicio');
        if (seccionInicio && seccionInicio.classList.contains('active')) {
            if (typeof renderListaConvocatoria === 'function') renderListaConvocatoria();
        }
        
        // Si alguien nuevo se registra, refrescamos la pestaña de Cantera
        const seccionCantera = document.getElementById('bbdd-jugadores');
        if (seccionCantera && seccionCantera.classList.contains('active')) {
        if (typeof renderCantera === 'function') renderCantera();
}
        // ✅ NUEVO: refresco de la pestaña de control de pistas en tiempo real
        const seccionControl = document.getElementById('control-pistas');
        if (seccionControl && seccionControl.classList.contains('active')) {
            if (typeof renderControlPistas === 'function') renderControlPistas();
        }
        
        // Refrescamos todo lo visual general para que se vea el cambio al instante
        if (typeof generarCajasPistas === 'function') generarCajasPistas();
        if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();
        if (typeof renderPistas === 'function') renderPistas();
        if (typeof renderPresentes === 'function') renderPresentes();
        if (typeof renderRanking === 'function') renderRanking();
        if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
        if (typeof actualizarTicker === 'function') actualizarTicker();
        if (typeof verificarEstadoHub === 'function') verificarEstadoHub(true); 
        if (typeof renderAnalisisAvanzado === 'function') renderAnalisisAvanzado();
        // 🚀 AÑADE ESTO: Refresco vital del Hub en tiempo real
        if (typeof actualizarBadgeConvocatoria === 'function') actualizarBadgeConvocatoria();
        if (typeof actualizarContadorConvocatoriaHub === 'function') actualizarContadorConvocatoriaHub();
        // ✅ AÑADIDOS: historial y vista alternativa de pistas
        if (typeof renderHistorialHoy === 'function')           renderHistorialHoy();
        if (typeof renderResultadosHoy === 'function')          renderResultadosHoy();
        if (typeof actualizarVistaPistas === 'function')        actualizarVistaPistas();
        if (typeof renderHistoricoGeneral === 'function')       renderHistoricoGeneral();
        if (typeof renderGolpesGanadores === 'function')        renderGolpesGanadores();
        if (typeof renderSeccionMVP === 'function')             renderSeccionMVP();
        // Sincronizar TV si está abierta en este dispositivo
        if (typeof sincronizarTV === 'function') sincronizarTV();
        // ✅ FIX: Sincronizar widget de estado del HUB en tiempo real
        if (typeof actualizarTablonHub === 'function')   actualizarTablonHub();
        // ✅ FIX: No reiniciar el timer en cada update de Firebase — causaba un salto
        // visual de ~1s cada vez que otro dispositivo hacía cualquier cambio.
        // Solo iniciarlo si no está corriendo todavía.
        if (typeof iniciarTimerPartidos === 'function' && !window._timerPartidosInterval) {
            iniciarTimerPartidos();
        }
    }
});

// ==========================================
// HELPER: ESCAPE HTML (Anti-XSS)
// ✅ FIX XSS: usado en todos los innerHTML que interpolan nombres de jugadores.
// Sin esto, un nombre como '<img src=x onerror=alert(1)>' se ejecuta en el DOM.
// ==========================================
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const CATEGORIAS_GOLPES = [
    { id: 'ace', label: '🚀 ACE', color: '#002855' },
    { id: 'dejada', label: '🧤 DEJADA', color: '#C5A059' },
    { id: 'volea', label: '🎾 VOLEA', color: '#0056b3' },
    { id: 'winner', label: '🔥 WINNER', color: '#d9534f' },
    { id: 'smash', label: '💥 SMASH', color: '#333' },
    { id: 'passing', label: '🎯 PASSING', color: '#28a745' }
];


// ==========================================
// HELPER CENTRALIZADO DE MODO DE PARTIDO
// ==========================================
// Una única función que resuelve icono, etiqueta, separador y corte de equipo
// para cualquier tipo de partido. Todos los renders (TV, WhatsApp, PDF, historial,
// fans, ficha) deben llamar a esto en lugar de replicar la lógica inline.
function resolverModoPartido(p) {
    if (!p) return { icono: '🎾', etiqueta: 'PARTIDO', separador: '/', esGamificado: false, esTrio: false, esAsimetrico: false, mitadEquipo: 1 };

    const tipoNorm = p.tipo
        ? p.tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : '';

    const esGamificado = !!(p.gamified || tipoNorm === 'gamificado');
    const esAsimetrico = tipoNorm === 'asimetrico';
    const esTrio = !esGamificado && !esAsimetrico && (
        tipoNorm === 'trios' ||
        (Array.isArray(p.ids) && p.ids.length === 6)
    );
    const esDobles   = !esGamificado && !esAsimetrico && !esTrio && (tipoNorm === 'dobles' || (Array.isArray(p.ids) && p.ids.length === 4));
    const esEquipos3 = !esGamificado && tipoNorm === 'equipos3';

    // Corte entre equipo A y B
    let mitadEquipo;
    if (esAsimetrico && p.tamanoEquipoA != null) {
        mitadEquipo = Number(p.tamanoEquipoA);
    } else if (Array.isArray(p.ids)) {
        mitadEquipo = Math.floor(p.ids.length / 2);
    } else {
        mitadEquipo = 1;
    }

    let icono, etiqueta, separador;
    if (esGamificado)      { icono = '🎮'; etiqueta = 'GAMIFICADO'; separador = ' · '; }
    else if (esAsimetrico) { icono = '⚡'; etiqueta = `ASIMÉTRICO (${mitadEquipo}v${(p.ids?.length || 0) - mitadEquipo})`; separador = '+'; }
    else if (esTrio)       { icono = '🔱'; etiqueta = 'TRÍOS';        separador = '+'; }
    else if (esEquipos3)   { icono = '🔄'; etiqueta = 'EQUIPOS 3';    separador = '/'; }
    else if (esDobles)     { icono = '🎾'; etiqueta = 'DOBLES';       separador = '/'; }
    else                   { icono = '🤺'; etiqueta = 'INDIVIDUAL';   separador = ' vs '; }

    return { icono, etiqueta, separador, esGamificado, esTrio, esAsimetrico, esDobles, esEquipos3, mitadEquipo };
}

// Helper: construye los strings "Equipo A" / "Equipo B" para cualquier modo
function resolverNombresEquipos(p, buscarNombreFn) {
    const { esGamificado, esAsimetrico, esTrio, esDobles, esEquipos3, mitadEquipo, separador } = resolverModoPartido(p);
    const ids = p.ids || [];
    const n = id => buscarNombreFn ? buscarNombreFn(id) : (db.jugadores.find(x => String(x.id) === String(id))?.nombre || '???');

    if (esGamificado) {
        return { eqA: ids.map(n).join(' · '), eqB: '' };
    }
    if (esEquipos3 && ids.length === 3) {
        // ✅ Australiana: mostrar la configuración de la ronda actual si está disponible
        const rondaIdx = (p.rondaActual ?? 0) % 3;
        const rondas = [
            { par: [ids[0], ids[1]], sol: ids[2] },
            { par: [ids[0], ids[2]], sol: ids[1] },
            { par: [ids[1], ids[2]], sol: ids[0] }
        ];
        const cfg = rondas[rondaIdx];
        return {
            eqA: cfg.par.map(n).join(' + '),
            eqB: n(cfg.sol)
        };
    }
    const idsA = ids.slice(0, mitadEquipo);
    const idsB = ids.slice(mitadEquipo);
    return {
        eqA: idsA.map(n).join(separador) || '???',
        eqB: idsB.map(n).join(separador) || '???'
    };
}

// Esta función NO debe hacer nada sola al cargar, solo la llamaremos si hace falta
