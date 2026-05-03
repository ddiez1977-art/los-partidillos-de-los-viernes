/* ============================================================
   ATP PLATINUM — 06-lanzamiento-manual.js
   Interfaz de lanzamiento manual, ajustes asimétricos, edición rápida en pista
   ── Refactor: extraído de script.js (líneas [(2153, 2788)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// --- 1. GESTIÓN DE INTERFAZ DINÁMICA ---
function actualizarInterfazManual() {
    const elTipo = document.getElementById('tipo-evento-manual');
    const cont = document.getElementById('controles-evento-manual');
    if (!elTipo || !cont) return;

    // Actualizar select de pista con estado libre/ocupado
    poblarSelectPistaManual();

    const tipo = elTipo.value;

    // ✅ FIX BUG INFO 3: Limpiar preseleccionGamificado al cambiar de tipo.
    // Si el admin seleccionaba jugadores en modo gamificado y luego cambiaba
    // a dobles/individual, al volver a gamificado aparecían los IDs anteriores.
    if (tipo !== 'gamificado') {
        window.preseleccionGamificado = [];
    }

    // 1. FILTRADO ULTRA-SEGURO: Solo los que no están en pista y no están pausados
    const listaActual = window.jugadoresHoy || [];
    const disponibles = listaActual.filter(j => {
        const jugando = (typeof estaJugando === 'function') ? estaJugando(j.id) : false;
        return !jugando && !j.pausado;
    });

    // Ordenamos alfabéticamente los disponibles para que sea fácil encontrarlos
    disponibles.sort((a, b) => a.nombre.localeCompare(b.nombre));

    let opts = '<option value="">-- Jugador --</option>';
    disponibles.forEach(j => {
        opts += `<option value="${j.id}">${escapeHtml(j.nombre)}</option>`;
    });

    // 2. CONSTRUCCIÓN DE LA INTERFAZ
    if (tipo === 'individual') {
        cont.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr; gap:10px;">
                <select class="atp-input select-jugador-manual">${opts}</select>
                <div style="text-align:center; font-weight:bold; color:var(--atp-blue);">VS</div>
                <select class="atp-input select-jugador-manual">${opts}</select>
            </div>`;
    }
    else if (tipo === 'equipos3') {
        cont.innerHTML = `
            <div style="text-align:center; font-size:0.85rem; font-weight:bold; color:#a78bfa;
                        text-transform:uppercase; margin-bottom:10px;">
                🔄 MODO AUSTRALIANA (2 vs 1)
            </div>
            <div style="display:grid; grid-template-columns:1fr; gap:10px;">
                <div style="font-size:0.65rem; color:#888; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">
                    JUGADOR 1 — empieza en pareja
                </div>
                <select class="atp-input select-jugador-manual" style="border-left:4px solid #a78bfa;">${opts}</select>
                <div style="font-size:0.65rem; color:#888; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">
                    JUGADOR 2 — empieza en pareja
                </div>
                <select class="atp-input select-jugador-manual" style="border-left:4px solid #a78bfa;">${opts}</select>
                <div style="font-size:0.65rem; color:#888; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">
                    JUGADOR 3 — empieza solo (individual)
                </div>
                <select class="atp-input select-jugador-manual" style="border-left:4px solid #C5A059;">${opts}</select>
            </div>
            <p style="text-align:center; margin-top:10px; font-size:0.7rem; color:#888; font-style:italic; line-height:1.4;">
                🔄 Pareja (J1+J2) vs Solo (J3) · El sistema rota automáticamente cada juego.<br>
                Los puntos se acumulan individualmente.
            </p>`;
    }
    else if (tipo === 'gamificado') {
        // 🛡️ SEGURIDAD: Limitamos a un máximo razonable para no romper el diseño (ej. 8 selectores)
        // Pero permitimos tantos como disponibles si son pocos.
        const numHuecos = Math.min(disponibles.length, 8) || 4; 
        
        let selectoresHTML = "";
        for (let i = 0; i < numHuecos; i++) {
            selectoresHTML += `<select class="atp-input select-jugador-manual" style="border-left: 4px solid #00d4ff; background: rgba(0,212,255,0.02);">${opts}</select>`;
        }

        cont.innerHTML = `
            <div style="text-align:center; font-size:0.85rem; font-weight:bold; color:#00d4ff; text-transform:uppercase; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:5px;">
                <span>🎯 MODO GAMIFICADO</span>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; max-height: 250px; overflow-y: auto; padding: 5px; border: 1px solid rgba(0,212,255,0.2); border-radius: 8px; background: #faffff;">
                ${selectoresHTML}
            </div>
            
            <p style="text-align:center; margin-top:10px; font-size:0.75rem; color:#008ba8; font-style: italic; line-height:1.2;">
                🎮 Selecciona a los participantes.<br>Los huecos vacíos se ignorarán al empezar.
            </p>`;
    }
    else if (tipo === 'trios') {
        cont.innerHTML = `
            <div style="text-align:center; font-size:0.85rem; font-weight:bold; color:var(--atp-blue); text-transform:uppercase; margin-bottom:10px;">
                🔱 MODO TRÍOS (3 VS 3)
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; align-items: center;">
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <select class="atp-input select-jugador-manual" style="border-left: 4px solid #ccff00;">${opts}</select>
                    <select class="atp-input select-jugador-manual" style="border-left: 4px solid #ccff00;">${opts}</select>
                    <select class="atp-input select-jugador-manual" style="border-left: 4px solid #ccff00;">${opts}</select>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <select class="atp-input select-jugador-manual" style="border-left: 4px solid var(--atp-gold);">${opts}</select>
                    <select class="atp-input select-jugador-manual" style="border-left: 4px solid var(--atp-gold);">${opts}</select>
                    <select class="atp-input select-jugador-manual" style="border-left: 4px solid var(--atp-gold);">${opts}</select>
                </div>
                
                <div style="grid-column: 1 / -1; text-align:center; font-weight:bold; color:var(--atp-blue); margin-top: 5px;">VS</div>
            </div>
            <p style="text-align:center; margin-top:10px; font-size:0.7rem; color:#666;">
                Ideal para grupos de 6 jugadores.
            </p>`;
    }
    else if (tipo === 'asimetrico') {
        // ✅ REESCRITURA COMPLETA: cada select tiene data-equipo="A" o "B"
        // así la recogida de IDs en lanzarPartidoManual siempre sabe
        // a qué equipo pertenece cada jugador, sin importar cuáles estén vacíos.
        // ✅ FIX BUG ASIM-1: Preservar el número de slots actuales cuando el formulario
        // ya existe en el DOM (evita que eventos reactivos como Firebase sync reseteen
        // el estado a 3A-2B mientras el admin está ajustando los equipos).
        const _maxPorEquipo = 4;
        const _slotsAActuales = (() => {
            const c = document.getElementById('slots-equipo-a');
            if (!c) return 3; // default
            // ✅ FIX BUG ASIM-2: antes usaba '[data-slot]' que matchea TANTO los div
            // wrapper como los select internos (ambos tienen data-slot). Esto duplicaba
            // el conteo: 3 slots visibles → actuales=6, corrompiendo toda la lógica +/-.
            // Ahora filtramos solo los divs wrapper por su clase específica.
            const vis = c.querySelectorAll('.asim-slot-a');
            const n = Array.from(vis).filter(s => s.style.display !== 'none').length;
            return n > 0 ? n : 3;
        })();
        const _slotsBActuales = (() => {
            const c = document.getElementById('slots-equipo-b');
            if (!c) return 2; // default
            // ✅ FIX BUG ASIM-2: mismo fix que arriba para el equipo B
            const vis = c.querySelectorAll('.asim-slot-b');
            const n = Array.from(vis).filter(s => s.style.display !== 'none').length;
            return n > 0 ? n : 2;
        })();
        // Leer los valores actuales de los selects para repoblarlos con los jugadores disponibles
        const _valsA = (() => {
            const c = document.getElementById('slots-equipo-a');
            if (!c) return [];
            return Array.from(c.querySelectorAll('select[data-equipo="A"]')).map(s => s.value);
        })();
        const _valsB = (() => {
            const c = document.getElementById('slots-equipo-b');
            if (!c) return [];
            return Array.from(c.querySelectorAll('select[data-equipo="B"]')).map(s => s.value);
        })();
        let slotsA = '', slotsB = '';
        for (let i = 0; i < _maxPorEquipo; i++) {
            const visA = i < _slotsAActuales ? 'flex' : 'none';
            const visB = i < _slotsBActuales ? 'flex' : 'none';
            slotsA += `<div class="asim-slot-a" data-slot="${i}"
                            style="display:${visA}; align-items:center; gap:6px; margin-bottom:6px;">
                            <select class="atp-input select-jugador-manual"
                                    data-equipo="A" data-slot="${i}"
                                    style="flex:1; border-left:4px solid #ccff00;">${opts}</select>
                        </div>`;
            slotsB += `<div class="asim-slot-b" data-slot="${i}"
                            style="display:${visB}; align-items:center; gap:6px; margin-bottom:6px;">
                            <select class="atp-input select-jugador-manual"
                                    data-equipo="B" data-slot="${i}"
                                    style="flex:1; border-left:4px solid var(--atp-gold, #C5A059);">${opts}</select>
                        </div>`;
        }

        cont.innerHTML = `
            <div style="text-align:center; font-size:0.85rem; font-weight:bold; color:#ff6b35;
                        text-transform:uppercase; margin-bottom:12px;">
                ⚡ MODO ASIMÉTRICO
            </div>
            <div style="display:grid; grid-template-columns:1fr auto 1fr; gap:10px; align-items:start;">

                <!-- EQUIPO A -->
                <div>
                    <div style="font-size:0.7rem; font-weight:900; color:#ccff00; text-align:center;
                                margin-bottom:8px; letter-spacing:1px;">
                        EQUIPO A
                        <span id="badge-count-a" style="background:#ccff00; color:#000; padding:1px 7px;
                                                         border-radius:10px; margin-left:4px; font-size:0.65rem;">${_slotsAActuales}</span>
                    </div>
                    <div id="slots-equipo-a">${slotsA}</div>
                    <div style="display:flex; justify-content:center; gap:6px; margin-top:6px;">
                        <button type="button" onclick="ajustarEquipoAsim('A',-1)"
                            style="width:28px; height:28px; border:none; background:#ee5253; color:white;
                                   border-radius:6px; cursor:pointer; font-weight:900; font-size:0.9rem;">−</button>
                        <button type="button" onclick="ajustarEquipoAsim('A',1)"
                            style="width:28px; height:28px; border:none; background:#10ac84; color:white;
                                   border-radius:6px; cursor:pointer; font-weight:900; font-size:0.9rem;">+</button>
                    </div>
                </div>

                <!-- VS -->
                <div style="font-weight:900; color:var(--atp-blue,#001e3c); font-size:0.9rem; margin-top:30px;">VS</div>

                <!-- EQUIPO B -->
                <div>
                    <div style="font-size:0.7rem; font-weight:900; color:var(--atp-gold,#C5A059); text-align:center;
                                margin-bottom:8px; letter-spacing:1px;">
                        EQUIPO B
                        <span id="badge-count-b" style="background:var(--atp-gold,#C5A059); color:#000; padding:1px 7px;
                                                         border-radius:10px; margin-left:4px; font-size:0.65rem;">${_slotsBActuales}</span>
                    </div>
                    <div id="slots-equipo-b">${slotsB}</div>
                    <div style="display:flex; justify-content:center; gap:6px; margin-top:6px;">
                        <button type="button" onclick="ajustarEquipoAsim('B',-1)"
                            style="width:28px; height:28px; border:none; background:#ee5253; color:white;
                                   border-radius:6px; cursor:pointer; font-weight:900; font-size:0.9rem;">−</button>
                        <button type="button" onclick="ajustarEquipoAsim('B',1)"
                            style="width:28px; height:28px; border:none; background:#10ac84; color:white;
                                   border-radius:6px; cursor:pointer; font-weight:900; font-size:0.9rem;">+</button>
                    </div>
                </div>
            </div>
            <p style="text-align:center; margin-top:10px; font-size:0.72rem;
                      color:#888; font-style:italic;">
                Usa + / − para añadir o quitar jugadores en cada equipo (máx. 4 por equipo).
            </p>`;
        // ✅ FIX BUG ASIM-1 (continuación): Restaurar los valores que tenía el usuario
        // en los selects antes de que actualizarInterfazManual() reconstruyera el HTML.
        // Solo se restauran valores que siguen siendo válidos en la nueva lista (disponibles).
        const _restoreVals = (equipo, valsAntes) => {
            const sels = cont.querySelectorAll(`select[data-equipo="${equipo}"]`);
            sels.forEach((sel, i) => {
                const v = valsAntes[i];
                if (v && sel.querySelector(`option[value="${v}"]`)) {
                    sel.value = v;
                }
            });
        };
        _restoreVals('A', _valsA);
        _restoreVals('B', _valsB);
    }
    else {
        // Dobles por defecto
        cont.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <select class="atp-input select-jugador-manual">${opts}</select>
                <select class="atp-input select-jugador-manual">${opts}</select>
                <div style="grid-column: 1 / -1; text-align:center; font-weight:bold; color:var(--atp-blue); margin: 5px 0;">VS</div>
                <select class="atp-input select-jugador-manual">${opts}</select>
                <select class="atp-input select-jugador-manual">${opts}</select>
            </div>`;
    }
}

// ==========================================
// HELPER MODO ASIMÉTRICO: añade/quita slots por equipo
// ==========================================
function ajustarEquipoAsim(equipo, delta) {
    const contenedorId = equipo === 'A' ? 'slots-equipo-a' : 'slots-equipo-b';
    const claseSlot    = equipo === 'A' ? '.asim-slot-a'   : '.asim-slot-b';
    const badgeId      = equipo === 'A' ? 'badge-count-a'  : 'badge-count-b';
    const contenedor   = document.getElementById(contenedorId);
    const badge        = document.getElementById(badgeId);
    if (!contenedor) return;

    // ✅ FIX BUG ASIM-2: antes usaba '[data-slot]' que seleccionaba TANTO los div
    // wrappers como los <select data-slot> internos → NodeList duplicada.
    // Con 3 slots visibles, actuales=6 en vez de 3, haciendo que +/- saltara
    // en incrementos de 2 y dejara selects intermedios con display:flex forzado,
    // lo que rompía la UI: al pulsar + después de un − no aparecían jugadores.
    // Ahora seleccionamos solo los div wrappers por su clase específica.
    const slots   = contenedor.querySelectorAll(claseSlot);
    const visibles = Array.from(slots).filter(s => s.style.display !== 'none');
    const actuales = visibles.length;
    const nuevos   = Math.max(1, Math.min(4, actuales + delta));
    if (nuevos === actuales) return;

    slots.forEach((s, i) => {
        s.style.display = i < nuevos ? 'flex' : 'none';
        // Limpiar selects ocultos para que no contaminen los ids recogidos
        if (i >= nuevos) {
            const sel = s.querySelector('select');
            if (sel) sel.value = '';
        }
    });

    if (badge) badge.innerText = nuevos;
}

// Mantener el nombre anterior como alias por si hay referencias legacy
function ajustarCorteAsimetrico(delta) { /* legacy — ya no se usa */ }


// --- 2. LANZAMIENTO DE PARTIDO ---
function lanzarPartidoManual() {
    if (!db.fechaEvento || window.jornadaCerrada) {
        alert("🚫 ACCIÓN BLOQUEADA: No hay una jornada activa. Por favor, inicia el evento desde el HUB.");
        if (typeof volverAlHub === 'function') volverAlHub();
        return;
    }

    const elTipo = document.getElementById('tipo-evento-manual');
    const elPista = document.getElementById('pista-manual');
    const elControles = document.getElementById('controles-evento-manual');

    if (!elTipo || !elControles) return console.error("❌ Faltan elementos críticos en el DOM");

    const tipo = elTipo.value;
    const numPista = elPista ? elPista.value : "1";

    // ✅ FIX BUG ASIGNACIÓN MANUAL: validar que la pista forme parte de las
    // disponibles en la jornada (activadas en cajas + reservadas + en curso).
    // Antes el selector mostraba TODAS las pistas físicas del club, así que
    // el admin podía elegir una pista que ni siquiera estaba reservada.
    if (typeof getPistasDisponiblesJornada === 'function') {
        const disponibles = getPistasDisponiblesJornada().map(String);
        if (!disponibles.includes(String(numPista))) {
            return alert(`🚫 BLOQUEO: La pista ${numPista} no está activada para esta jornada.\n` +
                         `Marca la pista como disponible en las cajas de pistas (arriba) o cambia a otra ya disponible.`);
        }
    }

    const pistaYaOcupada = (window.partidosAbiertos || []).some(
        p => String(p.pista) === String(numPista)
    );
    if (pistaYaOcupada) {
        return alert(`🚫 BLOQUEO: La pista ${numPista} ya tiene un partido en curso.\nSelecciona otra pista o finaliza el partido actual.`);
    }

    const selects = elControles.querySelectorAll('.select-jugador-manual');
    let ids = [];
    let tamanoEquipoA = null;

    if (tipo === 'asimetrico') {
        // ✅ CORRECCIÓN CRÍTICA: recoger IDs separados por equipo usando data-equipo
        // Antes se recogían todos los selects con valor en orden DOM, y el corte se
        // leía de count-a (slots totales del equipo A), desincronizándose cuando
        // había slots vacíos intercalados — un slot vacío en A rompía la asignación.
        const idsA = Array.from(elControles.querySelectorAll('select[data-equipo="A"]'))
            .map(s => s.value).filter(v => v !== '');
        const idsB = Array.from(elControles.querySelectorAll('select[data-equipo="B"]'))
            .map(s => s.value).filter(v => v !== '');

        if (idsA.length === 0) return alert("⚠️ El Equipo A necesita al menos 1 jugador.");
        if (idsB.length === 0) return alert("⚠️ El Equipo B necesita al menos 1 jugador.");

        ids = [...idsA, ...idsB];
        tamanoEquipoA = idsA.length;
    } else {
        selects.forEach(sel => {
            if (sel.value && sel.value !== "") ids.push(sel.value.toString());
        });
    }

    if (ids.length === 0) return alert("⚠️ Selecciona al menos un jugador.");
    if (new Set(ids).size !== ids.length) return alert("⚠️ Error: No puedes duplicar al mismo jugador en un partido.");

    const idsEnPista = (window.partidosAbiertos || []).flatMap(p => p.ids.map(id => id.toString()));
    const ocupados = ids.filter(id => idsEnPista.includes(id));

    if (ocupados.length > 0) {
        const nombresOcupados = ocupados
            .map(id => db.jugadores.find(x => x.id.toString() === id)?.nombre || "???")
            .join(", ");
        return alert(`🚫 BLOQUEO: ${nombresOcupados} ya están jugando en otra pista.`);
    }

    if (tipo === 'individual' && ids.length < 2) return alert("⚠️ Modo Individual requiere 2 jugadores.");
    if (tipo === 'dobles'    && ids.length < 4) return alert("⚠️ Modo Dobles requiere 4 jugadores.");
    if (tipo === 'trios'     && ids.length < 6) return alert("⚠️ Modo Tríos requiere 6 jugadores.");
    if (tipo === 'equipos3'  && ids.length < 3) return alert("⚠️ Equipos de 3 requiere seleccionar 3 jugadores.");
    if (tipo === 'gamificado'&& ids.length < 2) return alert("⚠️ Modo Gamificado requiere al menos 2 jugadores.");
    // asimétrico: ya validado arriba con alert por equipo; ids.length >= 2 garantizado

    // ✅ DISEÑO INTENCIONAL: cualquier partido que incluya a un jugador con perdioUltimo=true
    // se marca como revancha, independientemente de en qué equipo esté.
    // Esto puede producir partidos 🔥 donde el perdedor original no busca revancha activamente
    // (p.ej. si el admin lo coloca en el mismo equipo), pero es el comportamiento esperado.
    let esVenganzaManual = false;
    ids.forEach(id => {
        const jHoy = (window.jugadoresHoy || []).find(x => x.id.toString() === id);
        if (jHoy && jHoy.perdioUltimo) esVenganzaManual = true;
    });

    // Construir texto de display usando helper centralizado (garantiza coherencia con todos los renders)
    let textoDisplay = "";
    if (tipo === 'gamificado') {
        textoDisplay = `🎮 ENTRENAMIENTO (${ids.length} jugadores)`;
    } else {
        // Construimos un objeto partido provisional solo para pasar al helper
        const pProvisional = { tipo, ids, tamanoEquipoA };
        const { eqA, eqB } = resolverNombresEquipos(
            pProvisional,
            id => db.jugadores.find(x => x.id.toString() === id)?.nombre || "???"
        );
        textoDisplay = eqB ? `${eqA} vs ${eqB}` : eqA;
    }

    if (esVenganzaManual) textoDisplay = `🔥 ${textoDisplay} 🔥`;

    const nuevoPartido = {
        id: 'p' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        pista: String(numPista),
        tipo: tipo,
        ids: ids,
        nombres: textoDisplay,
        marcador: "0-0",
        inicio: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tiempoInicio: Date.now(),
        gamified: tipo === 'gamificado',
        puntosGamificados: {},
        esVenganza: esVenganzaManual,
        timestamp: Date.now(),
        juegosA: 0,
        juegosB: 0,
        // ✅ tamanoEquipoA: clave para que finalizarPartido, actualizarEstadísticas y verFicha
        // sepan cuántos jugadores pertenecen al equipo A en partidos asimétricos
        tamanoEquipoA: tamanoEquipoA,
        p1: ids[0],
        p2: ids[1],
        p3: ids[2] || null,
        p4: ids[3] || null,
        p5: ids[4] || null,
        p6: ids[5] || null,
        // ✅ NUEVO Australiana: estado de rondas y acumulado individual
        ...(tipo === 'equipos3' && ids.length === 3 ? {
            rondaActual: 0,
            puntosAustraliana: { [ids[0]]: 0, [ids[1]]: 0, [ids[2]]: 0 },
            juegosSoloAustraliana: { [ids[0]]: 0, [ids[1]]: 0, [ids[2]]: 0 }
        } : {})
    };

    window.partidosAbiertos.push(nuevoPartido);

    (window.jugadoresHoy || []).forEach(j => {
        if (ids.includes(j.id.toString())) {
            j.descansosSeguidos = 0;
            j.estado = 'jugando';
        }
    });

    saveDB();

    if (typeof renderPistas === 'function') renderPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();
    if (typeof sincronizarTV === 'function') sincronizarTV();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();

    elControles.innerHTML = "";
    elTipo.value = "dobles";
    if (typeof actualizarInterfazManual === 'function') actualizarInterfazManual();

    console.log(`🚀 Partido Manual (${tipo}) en Pista ${numPista} -> LANZADO`);
}


// --- FUNCIONES DE EDICIÓN DE PARTIDOS ACTIVOS ---

/**
 * Abre un menú sencillo para editar datos del partido sin detener el cronómetro
 */
function menuEdicionRapida(idPartido) {
    const p = window.partidosAbiertos.find(x => String(x.id) === String(idPartido));
    if (!p) {
        console.error('menuEdicionRapida: partido no encontrado, id recibido:', idPartido);
        return alert('❌ Partido no encontrado. Puede que ya haya sido finalizado.');
    }

    const opcion = prompt(
        "🛠️ MENÚ DE EDICIÓN RÁPIDA\n\n" +
        "1. Cambiar número de Pista\n" +
        "2. Editar nombres/título del partido\n" +
        "3. Sustituir a un jugador por otro\n\n" +
        "Escribe el número de la opción:"
    );

    if (opcion === null) return;

    // ✅ Helper: refresca todas las vistas que muestran partidos activos
    const refrescarTodo = () => {
        if (typeof renderPistas === 'function') renderPistas();
        if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
        if (typeof sincronizarTV === 'function') sincronizarTV();
        // ✅ FIX: refrescar también la vista de control si está activa
        const seccionControl = document.getElementById('control-pistas');
        if (seccionControl && seccionControl.classList.contains('active')) {
            if (typeof renderControlPistas === 'function') renderControlPistas();
        }
    };

    if (opcion === "1") {
        const nuevaPista = prompt("Nuevo número de pista:", p.pista);
        if (nuevaPista === null || nuevaPista.trim() === '') return;
        p.pista = nuevaPista.trim();
        saveDB();
        refrescarTodo();
    }
    else if (opcion === "2") {
        const nuevoNombre = prompt("Corregir nombres (ej: A+B+C vs D+E+F):", p.nombres);
        if (nuevoNombre === null || nuevoNombre.trim() === '') return;
        p.nombres = nuevoNombre.trim();
        saveDB();
        refrescarTodo();
    }
    else if (opcion === "3") {
        abrirSelectorCambioJugador(p.id);
    }
    else {
        alert("⚠️ Opción no válida. Escribe 1, 2 o 3.");
    }
}

function abrirSelectorCambioJugador(idPartido) {
    const partido = window.partidosAbiertos.find(p => p.id === idPartido);
    if (!partido) return;

    const disponibles = (window.jugadoresHoy || []).filter(j => 
        !estaJugando(j.id) && !j.pausado
    );
    if (disponibles.length === 0) {
        return alert("⚠️ No hay jugadores disponibles para hacer el cambio.");
    }

    // ✅ FIX: mostrar nombres legibles en lugar de IDs imposibles de escribir
    const opcionesSale = partido.ids.map((id, i) => {
        const j = db.jugadores.find(x => String(x.id) === String(id));
        return `${i + 1}. ${j ? j.nombre : '???'}`;
    }).join('\n');

    const entradaSale = prompt(`¿Qué jugador SALE? (escribe el número)\n\n${opcionesSale}`);
    if (entradaSale === null) return;

    const indiceSale = parseInt(entradaSale.trim()) - 1;
    if (isNaN(indiceSale) || indiceSale < 0 || indiceSale >= partido.ids.length) {
        return alert("❌ Número no válido.");
    }
    const idViejo = partido.ids[indiceSale];

    const opcionesEntra = disponibles.map((j, i) => `${i + 1}. ${j.nombre}`).join('\n');
    const entradaEntra = prompt(`¿Qué jugador ENTRA? (escribe el número)\n\n${opcionesEntra}`);
    if (entradaEntra === null) return;

    const indiceEntra = parseInt(entradaEntra.trim()) - 1;
    if (isNaN(indiceEntra) || indiceEntra < 0 || indiceEntra >= disponibles.length) {
        return alert("❌ Número no válido.");
    }
    const idNuevo = disponibles[indiceEntra].id;

    ejecutarCambioJugador(idPartido, idViejo, idNuevo);
}

function ejecutarCambioJugador(idPartido, idViejo, idNuevo) {
    // 🛡️ 1. OBTENCIÓN Y VALIDACIÓN DEL PARTIDO
    const partido = window.partidosAbiertos.find(p => p.id === idPartido);
    if (!partido) {
        console.error(`❌ ejecutarCambioJugador: Partido ${idPartido} no encontrado.`);
        return;
    }

    const idVStr = String(idViejo);
    const idNStr = String(idNuevo);

    // 🛡️ 2. VALIDAR QUE EL JUGADOR QUE SALE ESTÁ EN EL PARTIDO
    if (!partido.ids.map(String).includes(idVStr)) {
        console.error(`❌ El jugador ${idVStr} no está en el partido ${idPartido}.`);
        return alert("❌ Error: El jugador que sale no pertenece a este partido.");
    }

    // 🛡️ 3. VALIDAR QUE EL JUGADOR QUE ENTRA NO ESTÁ YA EN OTRA PISTA
    const idsEnPistasActuales = (window.partidosAbiertos || [])
        .flatMap(p => p.ids.map(String));
    
    if (idsEnPistasActuales.includes(idNStr)) {
        const jugadorNuevo = db.jugadores.find(x => String(x.id) === idNStr);
        const nombreNuevo = jugadorNuevo ? jugadorNuevo.nombre : idNStr;
        return alert(`🚫 BLOQUEO: ${nombreNuevo} ya está jugando en otra pista.`);
    }

    // 🛡️ 4. VALIDAR QUE NO ES EL MISMO JUGADOR
    if (idVStr === idNStr) {
        return alert("⚠️ El jugador entrante y saliente son el mismo.");
    }

    // 5. REEMPLAZO EN ARRAY IDS (Universal 2, 4 o 6 jugadores)
    partido.ids = partido.ids.map(id => String(id) === idVStr ? idNStr : id);

    // 6. SINCRONIZAR CAMPOS p1-p6 (Fix: evita desincronización)
    ['p1','p2','p3','p4','p5','p6'].forEach((campo, i) => {
        if (partido[campo] !== undefined && partido[campo] !== null) {
            if (String(partido[campo]) === idVStr) {
                partido[campo] = idNStr;
            }
        }
    });

    // 7. RECONSTRUCCIÓN INTELIGENTE DE NOMBRES usando helper centralizado
    const { eqA, eqB } = resolverNombresEquipos(partido);
    let nuevoTexto = eqB ? `${eqA} vs ${eqB}` : eqA;

    // ✅ FIX Bug 3: esVenganza no estaba declarada en este scope → ReferenceError.
    const esVenganza = partido.esVenganza || false;
    partido.nombres = esVenganza ? `🔥 ${nuevoTexto} 🔥` : nuevoTexto;

    // 8. ACTUALIZACIÓN DE ESTADOS EN jugadoresHoy
    (window.jugadoresHoy || []).forEach(j => {
        const sid = String(j.id);

        if (sid === idVStr) {
            j.estado = 'disponible';
            j.descansosSeguidos = 0;
            // 🛡️ Fix: Conservamos perdioUltimo para que no pierda 
            // su turno de venganza por culpa de un cambio técnico
            // j.perdioUltimo se mantiene tal cual estaba
        }

        if (sid === idNStr) {
            j.estado = 'jugando';
            j.descansosSeguidos = 0; // Reset al entrar en pista
        }
    });

    // 9. MIGRACIÓN DE PUNTOS GAMIFICADOS (Sin pérdida de datos)
    // ✅ FIX BUG CRÍTICO 2: cubrir también tipo==='gamificado' sin flag .gamified
    if ((partido.gamified || partido.tipo === 'gamificado') && partido.puntosGamificados) {
        partido.puntosGamificados[idNStr] = partido.puntosGamificados[idVStr] || 0;
        delete partido.puntosGamificados[idVStr];
    }

    // ✅ NUEVO: Migración de puntosAustraliana al cambiar jugador en australiana.
    if (partido.tipo === 'equipos3' && partido.puntosAustraliana) {
        partido.puntosAustraliana[idNStr] = partido.puntosAustraliana[idVStr] || 0;
        delete partido.puntosAustraliana[idVStr];
    }
    // ✅ Migrar también juegosSoloAustraliana
    if (partido.tipo === 'equipos3' && partido.juegosSoloAustraliana) {
        partido.juegosSoloAustraliana[idNStr] = partido.juegosSoloAustraliana[idVStr] || 0;
        delete partido.juegosSoloAustraliana[idVStr];
    }

    // 10. PERSISTENCIA Y SINCRONIZACIÓN TOTAL
    saveDB();

    if (typeof renderPistas === 'function') renderPistas();
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof sincronizarTV === 'function') sincronizarTV();

    console.log(`♻️ Cambio en Pista ${partido.pista}: ${nuevoTexto}`);
    console.log(`   Sale: ${idVStr} | Entra: ${idNStr}`);
}

