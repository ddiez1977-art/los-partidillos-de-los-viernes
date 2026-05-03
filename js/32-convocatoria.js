/* ============================================================
   ATP PLATINUM — 32-convocatoria.js
   Convocatoria y pre-inscripción (módulo completo)
   ── Refactor: extraído de script.js (líneas [(10344, 10713)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// MÓDULO DE CONVOCATORIA Y PRE-INSCRIPCIÓN
// ==========================================

function lanzarMensajeConvocatoria() {
    const fechaJornada = prompt("🎾 ¿Para qué día es la convocatoria? (Ej: Viernes 15, Mañana, etc.)", "Este Viernes");
    if (!fechaJornada) return;
    // WA-FIX 1: preguntar también la hora de inicio para incluirla en el mensaje
    const horaInicio = prompt("⏰ ¿A qué hora empieza? (Ej: 18:00, 19:30 — deja vacío para omitir)", "");

    // 🔗 ENLACES DEL CLUB
    const urlInscripcion = "https://los-partidillos-de-los-viernes.netlify.app/inscripciones/inscripciones.html";
    const urlLivePortal  = "https://los-partidillos-de-los-viernes.netlify.app/fans/fans.html";

    // Leer datos ANTES de vaciar la convocatoria (el reset pone lista a [])
    const _numPistasClub = parseInt(document.getElementById('plan-pistas-totales')?.value) || window.TOTAL_PISTAS_MAX || 2;

    // 1. ABRIMOS EL CANDADO en Firebase (portal abierto)
    database.ref('torneoPlatinum/convocatoriaAbierta').set(true)
        .catch(err => console.error('⚠️ Error abriendo convocatoria:', err));
    database.ref('torneoPlatinum/convocatoriaActiva').set([])
        .catch(err => console.error('⚠️ Error vaciando convocatoria:', err));

    // Actualización visual instantánea
    db.convocatoriaAbierta = true;
    db.convocatoriaActiva  = [];
    if (typeof actualizarBadgeConvocatoria === 'function') actualizarBadgeConvocatoria();
    if (typeof renderListaConvocatoria === 'function')     renderListaConvocatoria();
    if (typeof actualizarContadorConvocatoriaHub === 'function') actualizarContadorConvocatoriaHub();

    let mensaje = `🎾 *CONVOCATORIA ATP MASTER TOUR* 🎾\n`;
    mensaje += `📅 *Fecha:* ${fechaJornada.toUpperCase()}\n`;
    if (horaInicio && horaInicio.trim()) {
        mensaje += `⏰ *Hora de inicio:* ${horaInicio.trim()}\n`;
    }
    mensaje += `🏟️ *Pistas disponibles:* ${_numPistasClub}\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━\n\n`;
    mensaje += `¡Se abre la lista para la próxima jornada! 🏆\n\n`;

    mensaje += `👇 *1. CONFIRMA TU ASISTENCIA AQUÍ:*\n`;
    mensaje += `${urlInscripcion}\n\n`;
    mensaje += `📋 *¿Cómo apuntarse?*\n`;
    mensaje += `➡️ Entra al enlace, busca tu nombre y pulsa *＋ APUNTARME*.\n`;
    mensaje += `➡️ Si no apareces en la lista, escribe tu nombre abajo del todo y pulsa *+*.\n`;
    mensaje += `➡️ Si ya estás apuntado, el botón cambiará a *✅ APUNTADO*.\n`;
    mensaje += `➡️ Por defecto entras como *🏆 RANKING*. Si vienes de lúdico, pulsa *👨‍👧 INVITADO* junto a tu nombre.\n`;
    mensaje += `⚠️ _Nadie está apuntado por defecto — hay que confirmarse._\n\n`;

    mensaje += `🏟️ *2. ¿HAS RESERVADO UNA PISTA? (Para padres/reservadores)*\n`;
    mensaje += `_En el mismo enlace, pestaña_ *"🏟️ Pistas reservadas"*_:_\n`;
    mensaje += `➡️ Selecciona la pista del club en el desplegable.\n`;
    mensaje += `➡️ Indica la hora de inicio (y fin si la sabes).\n`;
    mensaje += `➡️ Escribe tu nombre y pulsa *✅ Añadir esta reserva*.\n`;
    mensaje += `➡️ Puedes añadir varias pistas seguidas — el nombre se recuerda.\n`;
    mensaje += `_El admin lo verá en tiempo real para cuadrar los emparejamientos._ 👀\n\n`;

    mensaje += `📺 *3. RANKING Y PARTIDOS EN DIRECTO:*\n`;
    mensaje += `_Consulta la clasificación y los últimos resultados:_\n`;
    mensaje += `${urlLivePortal}\n\n`;

    mensaje += `━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `👉 *¡Confirmad cuanto antes para cuadrar pistas!*`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(waUrl, '_blank');
}

// ESTA ES LA FUNCIÓN QUE LLAMA EL BOTÓN ROJO EN TU HTML
function limpiarConvocatoriaUI() {
    if (confirm("⚠️ ¿Preparar NUEVA convocatoria?\n\nSe vaciará la lista de apuntados. Los jugadores deberán confirmarse ellos mismos desde el portal cuando reciban el WhatsApp.")) {

        // Opt-in: lista vacía — nadie apuntado por defecto
        db.convocatoriaActiva = [];

        // Guardamos en Firebase: lista vacía y portal cerrado
        // ✅ FIX BUG MEDIO: writes sin .catch
        database.ref('torneoPlatinum/convocatoriaActiva').set([])
            .catch(err => console.error('⚠️ Error limpiando convocatoria:', err));
        database.ref('torneoPlatinum/convocatoriaAbierta').set(false)
            .catch(err => console.error('⚠️ Error cerrando convocatoria:', err));

        // Actualización visual instantánea
        db.convocatoriaAbierta = false;
        actualizarBadgeConvocatoria();
        renderListaConvocatoria();

        alert("✅ Convocatoria preparada. La lista está vacía. El portal se abrirá cuando lances el WhatsApp.");
    }
}

// ESTA ES LA FUNCIÓN QUE LLAMA EL BOTÓN AZUL "CARGAR" EN TU HTML
function renderListaConvocatoria() {
    const contenedor = document.getElementById('lista-convocatoria-ui');
    if (!contenedor) return;

    // ✅ FIX BUG "CARGAR CONVOCATORIA no hace nada":
    // Antes, si algún jugador tenía nombre=undefined/null o no existía la propiedad,
    // el .sort() interno lanzaba "Cannot read properties of undefined (reading
    // 'localeCompare')" y reventaba toda la función SIN pintar nada — el placeholder
    // original se quedaba y al usuario le parecía que el botón "no responde".
    //
    // También blindaje contra db.jugadores serializado por Firebase como objeto
    // {0:..,1:..} en vez de array (pasa con muchos elementos o tras reconexión).

    // 1. Normalizar a array (Firebase a veces serializa arrays como objetos)
    let lista = Array.isArray(db.jugadores)
        ? db.jugadores
        : Object.values(db.jugadores || {});

    // 2. Filtrar nulls y blindar nombre
    lista = lista
        .filter(j => j && typeof j === 'object')
        .map(j => ({
            ...j,
            id: String(j.id ?? ''),
            nombre: typeof j.nombre === 'string' && j.nombre.trim()
                ? j.nombre
                : '(Sin nombre)'
        }));

    if (lista.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; color:#999; font-size: 0.8rem;">La cantera está vacía.</p>';
        return;
    }

    const listaOrdenada = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre));
    db.convocatoriaActiva = Array.isArray(db.convocatoriaActiva)
        ? db.convocatoriaActiva
        : Object.values(db.convocatoriaActiva || {});

    const jugadoresRanking  = listaOrdenada.filter(j => !j.esInvitado);
    const jugadoresInvitado = listaOrdenada.filter(j =>  j.esInvitado);

    function htmlFila(j) {
        const estaConfirmado = db.convocatoriaActiva.includes(String(j.id));
        const colorFondoRow = estaConfirmado ? (j.esInvitado ? '#fffbeb' : '#f0fff4') : '#fff';
        const borderColor   = estaConfirmado ? (j.esInvitado ? '#fcd34d' : '#c3e6cb') : '#eee';
        const colorBtn = estaConfirmado
            ? (j.esInvitado ? 'background:#f59e0b; color:white; border:none;'
                            : 'background:#28a745; color:white; border:none;')
            : 'background:#f1f3f5; color:#495057; border:1px solid #dee2e6;';
        const textoBtn = estaConfirmado ? '✅ APUNTADO' : '＋ APUNTARME';
        const badgeInv = j.esInvitado
            ? '<span style="font-size:0.6rem;background:rgba(245,158,11,0.15);border:1px solid #f59e0b;color:#92400e;border-radius:6px;padding:1px 6px;margin-left:6px;font-weight:800;letter-spacing:0.3px;">👨\u200d👧 INVITADO</span>'
            : '';
        // Escapar nombre para evitar inyección HTML
        const nombreEscapado = String(j.nombre || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;
                    border:1px solid ${borderColor};border-radius:8px;background:${colorFondoRow};margin-bottom:4px;
                    ${j.esInvitado ? 'border-left:3px solid #f59e0b;' : ''}">
            <span style="font-weight:700;font-size:0.85rem;color:${estaConfirmado ? (j.esInvitado ? '#92400e' : '#155724') : '#495057'};display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
                ${nombreEscapado}${badgeInv}
            </span>
            <button onclick="toggleYRenderizar('${j.id}', ${!estaConfirmado})"
                    style="padding:8px 12px;border-radius:6px;font-weight:bold;font-size:0.7rem;cursor:pointer;flex-shrink:0;margin-left:8px;${colorBtn}">
                ${textoBtn}
            </button>
        </div>`;
    }

    let html = '';
    if (jugadoresRanking.length > 0) html += jugadoresRanking.map(htmlFila).join('');
    if (jugadoresInvitado.length > 0) {
        html += `<div style="margin:12px 0 6px;padding:6px 10px;background:rgba(245,158,11,0.08);
                     border-radius:8px;border:1px dashed #f59e0b;">
                    <span style="font-size:0.65rem;font-weight:900;color:#92400e;letter-spacing:1px;
                                 text-transform:uppercase;">👨\u200d👧 Participantes invitados — no computan en ranking</span>
                 </div>`;
        html += jugadoresInvitado.map(htmlFila).join('');
    }
    contenedor.innerHTML = html;
}

// Auxiliares necesarias
function toggleYRenderizar(id, estadoNuevo) {
    if (!db.convocatoriaActiva) db.convocatoriaActiva = [];
    const idStr = String(id);

    if (estadoNuevo) {
        if (!db.convocatoriaActiva.includes(idStr)) db.convocatoriaActiva.push(idStr);
    } else {
        db.convocatoriaActiva = db.convocatoriaActiva.filter(i => i !== idStr);
    }

    // ✅ FIX BUG MEDIO: write sin .catch — si falla, estado local y Firebase quedan inconsistentes
    database.ref('torneoPlatinum/convocatoriaActiva').set(db.convocatoriaActiva)
        .catch(err => console.error('⚠️ Error actualizando convocatoria:', err));
    renderListaConvocatoria(); 
    
    // 🚀 CORRECCIÓN: Avisar al Hub de que el número ha cambiado
    if (typeof actualizarContadorConvocatoriaHub === 'function') {
        actualizarContadorConvocatoriaHub();
    }
}

function actualizarBadgeConvocatoria() {
    const badge = document.getElementById('badge-estado-convocatoria');
    if (!badge) return;
    const estaAbierta = db.convocatoriaAbierta === true;
    
    badge.innerHTML = estaAbierta ? '🟢 ABIERTA' : '🔒 CERRADA';
    badge.style.background = estaAbierta ? '#d4edda' : '#f8d7da';
    badge.style.color = estaAbierta ? '#155724' : '#721c24';
    badge.style.border = `1px solid ${estaAbierta ? '#c3e6cb' : '#f5c6cb'}`;
}

// ── PISTAS RESERVADAS (panel admin) ─────────────────────────────────────────
// Lee torneoPlatinum/pistasReservadas en tiempo real y muestra en el panel
// de convocatoria del admin. Completamente independiente de la convocatoria.
(function iniciarListenerPistasReservadas() {
    if (typeof database === 'undefined') return;
    database.ref('torneoPlatinum/pistasReservadas').on('value', (snap) => {
        const data = snap.val();
        let pistas = [];
        if (Array.isArray(data)) pistas = data.filter(Boolean);
        else if (data && typeof data === 'object') pistas = Object.values(data).filter(Boolean);
        renderAdminPistasReservadas(pistas);
    });
})();

function renderAdminPistasReservadas(pistas) {
    const wrapper = document.getElementById('admin-pistas-reservadas');
    const lista   = document.getElementById('admin-pistas-lista');
    if (!wrapper || !lista) return;

    const reservadas = pistas.filter(p => p && p.reservadoPor)
        .sort((a,b) => Number(a.numero) - Number(b.numero));

    if (!reservadas.length) {
        wrapper.style.display = 'none';
        return;
    }

    wrapper.style.display = 'block';

    let html = '';
    reservadas.forEach(p => {
        const ts = p.ts
            ? new Date(p.ts).toLocaleTimeString('es', {hour:'2-digit', minute:'2-digit'})
            : '';
        html += `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                    border-radius:8px; background:rgba(204,255,0,0.05);
                    border:1px solid rgba(204,255,0,0.2); margin-bottom:6px;">
            <span style="font-weight:900; color:var(--atp-gold); font-size:0.85rem; min-width:28px; text-align:center;">
                P${escapeHtml(String(p.numero))}
            </span>
            <span style="font-weight:800; color:var(--atp-navy); font-size:0.82rem; flex:1;">
                ${escapeHtml(p.hora || '—')}
            </span>
            <span style="font-size:0.72rem; color:#888;">
                👤 ${escapeHtml(p.reservadoPor)}${ts ? ' · ' + ts : ''}
            </span>
        </div>`;
    });
    lista.innerHTML = html;
}

function limpiarPistasReservadas() {
    if (!confirm('¿Borrar todas las reservas de pistas?')) return;
    if (typeof database !== 'undefined') {
        database.ref('torneoPlatinum/pistasReservadas').set([])
            .catch(err => console.error('Error borrando pistas:', err));
    }
}

// ESTA ES LA FUNCIÓN QUE FALTABA (La que soluciona el error de index.html:139)
function llevarConvocatoriaAPista() {
    // 1. 🛑 CONTROL DE PISTAS ACTIVAS
    if (window.partidosAbiertos && window.partidosAbiertos.length > 0) {
        return alert("⚠️ ACCIÓN DENEGADA: Hay partidos en curso. Finaliza todos los partidos antes de realizar un volcado masivo de convocatoria.");
    }

    // 2. 🛑 CONTROL DE JORNADA YA INICIADA
    if (db.fechaEvento || window.jornadaActiva) {
        const respuesta = confirm("📢 La jornada ya está INICIADA.\n\nHacer esto sobrescribirá la lista actual de presentes. Si solo quieres añadir a alguien nuevo, usa el botón '+ PASAR LISTA' en la sección de Pistas.\n\n¿Quieres SOBRESCRIBIR la lista actual de todos modos?");
        if (!respuesta) return;
    }

    // 3. OBTENER CONFIRMADOS DE LA CONVOCATORIA
    const confirmadosIDs = db.convocatoriaActiva || [];
    if (confirmadosIDs.length === 0) {
        return alert("⚠️ No hay nadie seleccionado en la convocatoria activa.");
    }

    // 4. PREPARACIÓN DE VARIABLES
    window.jugadoresHoy = [];
    window.partidosFinalizadosHoy = []; 
    window.golpesGanadoresHoy = {};
    window.mvpIdHoy = null;
    window.mvpIdsHoy = [];
    // ✅ MVP dual
    window.mvpIdsJugadores = []; window.mvpIdsEntrenadores = []; window.votosJugadoresMVP = {};
    db.mvpIdsJugadores = [];     db.mvpIdsEntrenadores = [];     db.votosJugadoresMVP = {};
    db.votosDe = {};
    // ✅ FIX: también resetear db.jugadoresHoy y db.partidosAbiertos.
    // Sin esto, saveDB() puede persistir en Firebase datos de la jornada anterior
    // si el listener los había restaurado entre el reset de window.* y el saveDB().
    db.jugadoresHoy = [];
    db.partidosAbiertos = [];
    db.partidosRecientes = [];
    window.jornadaCerrada = false;
    window._estadisticasJornadaYaGuardadas = false;
    window._mvpPuntosYaAplicadosHoy = false; // reset flag sistema live MVP
    // Reset selección UI de golpes
    if (typeof window._jugadorGolpesSeleccionado !== 'undefined') window._jugadorGolpesSeleccionado = null;

    // 5. VOLCADO DE JUGADORES
    confirmadosIDs.forEach(idStr => {
        const perfil = db.jugadores.find(p => String(p.id) === idStr);
        if (perfil) {
            window.jugadoresHoy.push({
                ...perfil,
                pausado: false,
                estado: 'disponible',
                descansosSeguidos: 0,
                partidosJugadosHoy: 0,
                perdioUltimo: false
            });
        }
    });

    // 6. APERTURA OFICIAL DE LA JORNADA
    // ✅ FIX BUG MEDIO 1: ISO slice(0,10) para que coincida con las comparaciones del listener
    db.fechaEvento = new Date().toISOString().slice(0, 10);
    window.jornadaActiva = true;
    
    // 🔒 Cierre de seguridad del portal externo
    if (typeof database !== 'undefined') {
        // ✅ FIX BUG MEDIO: write sin .catch
        database.ref('torneoPlatinum/convocatoriaAbierta').set(false)
            .catch(err => console.error('⚠️ Error cerrando portal al iniciar jornada:', err));
    }
    db.convocatoriaAbierta = false;

    // 7. PERSISTENCIA Y SINCRONIZACIÓN TOTAL
    saveDB();
    
    // Ejecutamos todos los renders necesarios
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    if (typeof actualizarBadgeConvocatoria === 'function') actualizarBadgeConvocatoria();
    if (typeof sincronizarTV === 'function') sincronizarTV();
    
    if (typeof actualizarContadorConvocatoriaHub === 'function') {
        actualizarContadorConvocatoriaHub();
    }

    // 8. FEEDBACK Y NAVEGACIÓN
    alert(`🚀 JORNADA ABIERTA: ${window.jugadoresHoy.length} jugadores han entrado al club.`);
    
    showSection('jornada');
    console.log("✅ Sincronización exitosa: Convocatoria -> Pista activa.");
}


// Función para crear un jugador sobre la marcha y añadirlo a la convocatoria
function crearJugadorDesdeConvocatoria() {
    const nombreInput = document.getElementById('input-nuevo-convocado');
    const nombre = nombreInput?.value.trim();

    if (!nombre) return alert("Escribe un nombre.");

    // ✅ FIX: stats completo incluyendo trios y mvps
    const nuevo = {
        id: Date.now().toString(),
        nombre: nombre,
        puntosTotales: 0,
        nivel: "5.0",
        habilidades: { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 },
        statsAcumuladas: { ace: 0, winner: 0, dejada: 0, volea: 0, smash: 0, passing: 0 },
        stats: { 
            ganados: 0, perdidos: 0, totales: 0, mvps: 0,
            // ✅ FIX: trios solo una vez — estaba duplicado igual que en crearYAgregarJugador
            dobles: 0, simples: 0, gamificados: 0, trios: 0, asimetrico: 0, australiana: 0,
            juegosFavor: 0, juegosContra: 0,
            aces: 0, winners: 0, smashes: 0, voleas: 0, dejadas: 0, passings: 0
        }
    };

    // Añadir a cantera
    db.jugadores.push(nuevo);

    // Añadir a convocatoria activa inmediatamente
    if (!db.convocatoriaActiva) db.convocatoriaActiva = [];
    db.convocatoriaActiva.push(nuevo.id);

    // Guardar y refrescar
    saveDB();
    renderListaConvocatoria();
    if (typeof actualizarContadorConvocatoriaHub === 'function') actualizarContadorConvocatoriaHub();
    if (nombreInput) nombreInput.value = "";
    
    console.log(`🆕 Nuevo fichaje: ${nombre} añadido y convocado.`);
}

