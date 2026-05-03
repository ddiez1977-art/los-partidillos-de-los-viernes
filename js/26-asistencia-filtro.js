/* ============================================================
   ATP PLATINUM — 26-asistencia-filtro.js
   Filtro de asistencia, toggles inmediatos, marcar todos
   ── Refactor: extraído de script.js (líneas [(8328, 8547)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// BUSCADOR EN TIEMPO REAL Y MARCAR TODOS
// ==========================================
function filtrarAsistencia() {
    const lista = document.getElementById('lista-disponibles-pista');
    const filtro = document.getElementById('input-search-asistencia')?.value.toLowerCase().trim() || "";
    if (!lista) return;

    let mem = [];
    try {
        mem = JSON.parse(localStorage.getItem('asistenciaRapida')) || [];
    } catch(e) { mem = []; }

    const disponibles = db.jugadores.filter(j => 
        !window.jugadoresHoy.some(h => h.id.toString() === j.id.toString()) && 
        j.nombre.toLowerCase().includes(filtro)
    );

    let html = "";

    if (disponibles.length > 0) {
        html += `
            <button type="button" onclick="toggleMarcarTodos()" 
                style="width:100%; padding:10px; margin-bottom:15px; background:var(--atp-navy, #001e3c); color:var(--atp-gold, #C5A059); border:1px solid var(--atp-gold, #C5A059); border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; text-transform:uppercase;">
                ✅ Marcar / Desmarcar Todos
            </button>
        `;
    }

    const sugeridos = disponibles.filter(j => mem.includes(j.id.toString()));
    const resto = disponibles.filter(j => !mem.includes(j.id.toString()));

    if (filtro === "" && sugeridos.length > 0) {
        html += `<p style="color:var(--atp-blue); font-weight:bold; font-size:0.7rem; margin:10px 0 5px 5px; text-transform:uppercase;">⭐ HABITUALES</p>`;
        sugeridos.forEach(j => {
            html += `
                <label class="check-jugador" style="display:flex; align-items:center; background:#f0f7ff; padding:10px; border-radius:8px; margin-bottom:5px; border:1px solid #cce5ff; cursor:pointer;">
                    <input type="checkbox" value="${j.id}" class="check-asistencia" 
                           onchange="toggleJugadorInmediato('${j.id}', this.checked)" 
                           style="width:20px; height:20px; margin-right:10px; cursor:pointer;">
                    <span style="font-weight:bold;">${j.nombre}</span>
                </label>`;
        });
    }

    const titulo = filtro === "" ? "👥 TODA LA CANTERA" : "🔍 RESULTADOS";
    html += `<p style="color:#666; font-weight:bold; font-size:0.7rem; margin:15px 0 5px 5px; text-transform:uppercase;">${titulo}</p>`;
    
    if (disponibles.length === 0 && filtro !== "") {
        html += `<p style="text-align:center; padding:20px; font-size:0.8rem; color:#999;">No hay coincidencias. <br>Escribe arriba y usa el botón <b>"+"</b> para crearlo.</p>`;
    } else {
        resto.forEach(j => {
            html += `
                <label class="check-jugador" style="display:flex; align-items:center; background:white; padding:10px; border-radius:8px; margin-bottom:5px; border:1px solid #eee; cursor:pointer;">
                    <input type="checkbox" value="${j.id}" class="check-asistencia" 
                           onchange="toggleJugadorInmediato('${j.id}', this.checked)" 
                           style="width:20px; height:20px; margin-right:10px; cursor:pointer;">
                    <span>${j.nombre}</span>
                </label>`;
        });
    }

    lista.innerHTML = html;
}

function toggleJugadorInmediato(id, isChecked) {
    // ✅ FIX: Si estamos en medio de un marcado masivo, ignoramos
    // esta llamada individual — toggleMarcarTodos() ya gestiona todo.
    if (window._toggleMasivo) return;

    const idStr = id.toString();
    const jugador = db.jugadores.find(j => j.id.toString() === idStr);
    if (!jugador) return;

    if (isChecked) {
        // 1. INSERCIÓN SEGURA (Evita duplicados)
        if (!window.jugadoresHoy.some(h => h.id.toString() === idStr)) {
            // 🛡️ Clonación para aislar datos de jornada vs datos permanentes
            window.jugadoresHoy.push({ 
                ...jugador, 
                pausado: false, 
                estado: 'disponible', 
                descansosSeguidos: 0,
                partidosJugadosHoy: 0, // Reset para rating dinámico
                perdioUltimo: false    // Reset de venganza
            });
            console.log(`✅ ${jugador.nombre} ha entrado al club.`);
        }
    } else {
        // 2. ESCUDO DE SEGURIDAD (No quitar si está en pista)
        if (typeof estaJugando === 'function' && estaJugando(idStr)) {
            alert(`🚫 BLOQUEO: ${jugador.nombre} está jugando en una pista. Termina su partido para poder darle de baja.`);
            
            // Revertir visualmente el checkbox si es posible
            const chk = document.querySelector(`.check-asistencia[value="${idStr}"]`);
            if (chk) chk.checked = true;
            return;
        }

        // 3. ELIMINACIÓN DE LA JORNADA
        window.jugadoresHoy = window.jugadoresHoy.filter(h => h.id.toString() !== idStr);
        // ✅ Limpiar campos MVP dual si el jugador era MVP activo
        if (Array.isArray(window.mvpIdsJugadores))
            window.mvpIdsJugadores = window.mvpIdsJugadores.filter(x => x !== idStr);
        if (Array.isArray(window.mvpIdsEntrenadores))
            window.mvpIdsEntrenadores = window.mvpIdsEntrenadores.filter(x => x !== idStr);
        if (window.votosJugadoresMVP && window.votosJugadoresMVP[idStr])
            delete window.votosJugadoresMVP[idStr];
        if (Array.isArray(window.mvpIdsHoy))
            window.mvpIdsHoy = window.mvpIdsHoy.filter(x => x !== idStr);
        if (window.golpesGanadoresHoy && window.golpesGanadoresHoy[idStr])
            delete window.golpesGanadoresHoy[idStr];
        console.log(`👋 ${jugador.nombre} ha salido de la jornada.`);
    }

    // 4. PERSISTENCIA Y SINCRONIZACIÓN TOTAL
    saveDB();
    
    // Refresco de burbujas inferiores
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderVotos === 'function') renderVotos();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    
    // Sincronización con la TV (lista de espera actualizada)
    if (typeof sincronizarTV === 'function') sincronizarTV();
    
    // Actualización del contador en el Hub
    const contador = document.getElementById('count-presentes');
    if (contador) contador.innerText = window.jugadoresHoy.length;


    // ✅ AÑADIR ESTA LÍNEA AL FINAL:
    // Refresca la lista del modal para que el jugador añadido desaparezca de disponibles
    if (typeof filtrarAsistencia === 'function') filtrarAsistencia();
}


// Función auxiliar para pintar las cajas de los jugadores
function generarCheckHTML(j) {
    return `
        <label style="display:flex; align-items:center; background:white; padding:12px; border-radius:8px; margin-bottom:6px; border:1px solid #eee; cursor:pointer;">
            <input type="checkbox" value="${j.id}" class="check-asistencia" style="width:18px; height:18px; margin-right:12px; cursor:pointer;">
            <span style="font-weight:bold; color:var(--atp-navy); font-size:0.95rem;">${j.nombre}</span>
        </label>`;
}


// ---> 🌟 FUNCIÓN COMPAÑERA PARA EL BOTÓN DE ARRIBA <---
function toggleMarcarTodos() {
    const checkboxes = document.querySelectorAll('#lista-disponibles-pista .check-asistencia');
    if (checkboxes.length === 0) return;

    const todosMarcados = Array.from(checkboxes).every(cb => cb.checked);
    const nuevoEstado = !todosMarcados;

    // ✅ FIX: Flag global para suprimir los handlers individuales de onchange.
    // Sin esto, cb.checked = nuevoEstado dispara toggleJugadorInmediato() × N,
    // provocando N escrituras simultáneas a Firebase en lugar de 1.
    window._toggleMasivo = true;

    checkboxes.forEach(cb => {
        cb.checked = nuevoEstado;
        const idStr = cb.value.toString();
        const jugador = db.jugadores.find(j => j.id.toString() === idStr);
        if (!jugador) return;

        if (nuevoEstado) {
            // Añadir a jugadoresHoy si no está ya
            if (!window.jugadoresHoy.some(h => h.id.toString() === idStr)) {
                window.jugadoresHoy.push({
                    ...jugador,
                    pausado: false,
                    estado: 'disponible',
                    descansosSeguidos: 0,
                    partidosJugadosHoy: 0,
                    perdioUltimo: false
                });
            }
        } else {
            // Solo quitar si no está en pista
            if (typeof estaJugando === 'function' && estaJugando(idStr)) {
                cb.checked = true; // Revertir visualmente
                return;
            }
            window.jugadoresHoy = window.jugadoresHoy.filter(h => h.id.toString() !== idStr);
            // ✅ Limpiar campos MVP dual y golpes del jugador removido
            if (Array.isArray(window.mvpIdsJugadores))
                window.mvpIdsJugadores = window.mvpIdsJugadores.filter(x => x !== idStr);
            if (Array.isArray(window.mvpIdsEntrenadores))
                window.mvpIdsEntrenadores = window.mvpIdsEntrenadores.filter(x => x !== idStr);
            if (window.votosJugadoresMVP && window.votosJugadoresMVP[idStr])
                delete window.votosJugadoresMVP[idStr];
            if (Array.isArray(window.mvpIdsHoy))
                window.mvpIdsHoy = window.mvpIdsHoy.filter(x => x !== idStr);
            if (window.golpesGanadoresHoy && window.golpesGanadoresHoy[idStr])
                delete window.golpesGanadoresHoy[idStr];
        }
    });

    // ✅ Desactivamos el flag ANTES de persistir y refrescar
    window._toggleMasivo = false;

    // ✅ Una sola escritura a Firebase con el estado final consolidado
    saveDB();

    // Refresco único de interfaz
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderVotos === 'function') renderVotos();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    if (typeof sincronizarTV === 'function') sincronizarTV();
    if (typeof filtrarAsistencia === 'function') filtrarAsistencia();

    const contador = document.getElementById('count-presentes');
    if (contador) contador.innerText = window.jugadoresHoy.length;
}

