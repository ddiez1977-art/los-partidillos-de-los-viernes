/* ============================================================
   ATP PLATINUM — 05-asistencia.js
   Asistencia: confirmar, presentes, plan rápido, pausar/remover, MVP select
   ── Refactor: extraído de script.js (líneas [(1712, 2152)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function confirmarAsistenciaMultiple() {
    // 1. Verificación de base global
    if (!window.jugadoresHoy) window.jugadoresHoy = [];

    const checks = document.querySelectorAll('.check-asistencia:checked');
    const idsSeleccionados = Array.from(checks).map(cb => cb.value);

    if (idsSeleccionados.length === 0) {
        return alert("Selecciona al menos un jugador.");
    }

    // 2. Inyección de jugadores (Estructura compatible V1/V2/Tríos)
    idsSeleccionados.forEach(id => {
        const idStr = id.toString();
        const jugador = db.jugadores.find(j => j.id.toString() === idStr);

        if (jugador && !window.jugadoresHoy.some(h => h.id.toString() === idStr)) {
            window.jugadoresHoy.push({
                ...jugador,
                pausado: false,
                estado: 'disponible',
                descansosSeguidos: 0,
                partidosJugadosHoy: 0,
                perdioUltimo: false,
                // ✅ FIX: stats completo — antes tenía trios duplicado y faltaban aces, winners, etc.
                stats: jugador.stats || {
                    ganados: 0, perdidos: 0, totales: 0, mvps: 0,
                    dobles: 0, simples: 0, gamificados: 0, trios: 0, asimetrico: 0, australiana: 0,
                    juegosFavor: 0, juegosContra: 0,
                    aces: 0, winners: 0, smashes: 0, voleas: 0, dejadas: 0, passings: 0
                }
            });
        }
    });

    // 3. Memoria de asistencia rápida
    try {
        let memoria = JSON.parse(localStorage.getItem('asistenciaRapida')) || [];
        memoria = [...new Set([...idsSeleccionados, ...memoria])].slice(0, 15);
        localStorage.setItem('asistenciaRapida', JSON.stringify(memoria));
    } catch(e) {
        console.error("Error en localstorage memoria rápida", e);
    }

    saveDB();

    // 4. Gestión de Interfaz — cerrar modal y limpiar checks
    if (typeof cerrarPistas === 'function') cerrarPistas();
    document.querySelectorAll('.check-asistencia').forEach(el => el.checked = false);

    // 5. Refresco de Vistas
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof renderVotos === 'function') renderVotos();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();

    // ✅ FIX: actualizarContadoresPistas() no se llamaba aquí.
    // Tras añadir jugadores el badge "Pistas Libres: X / Y" no reflejaba
    // el nuevo total hasta el próximo sync de Firebase o navegación de pestaña.
    if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();

    // ✅ FIX: Actualizar el contador de presentes en el Hub.
    // Sin esto, el badge "count-presentes" del Hub quedaba desactualizado
    // hasta que Firebase propagaba el cambio a otros dispositivos.
    const contador = document.getElementById('count-presentes');
    if (contador) contador.innerText = window.jugadoresHoy.length;

    // 6. Navegación
    if (typeof showSection === 'function') showSection('jornada');

    // 7. Sincronización con TV
    if (typeof sincronizarTV === 'function') {
        sincronizarTV();
    } else if (typeof tvChannel !== 'undefined') {
        tvChannel.postMessage({ action: 'UPDATE_DATA', partidos: window.partidosAbiertos || [] });
    }

    console.log(`✅ Asistencia procesada: ${idsSeleccionados.length} jugadores añadidos.`);
}

function cerrarPistas() { 
    const modal = document.getElementById('modal-pistas');
    if (modal) {
        modal.style.display = 'none';
        
        // 🛡️ Opcional: Limpia los checks para que al volver a abrir 
        // no haya selecciones antiguas de la jornada o del planificador.
        const checks = modal.querySelectorAll('input[type="checkbox"]');
        checks.forEach(c => c.checked = false);
    }
}

function renderPlan() {
    const res = calcularRotacionInteligente();
    const plan = res.plan;
    const espera = res.espera;
    
    const cont = document.getElementById('contenedor-plan');
    if (!cont) return;

    let html = "<h3>🎾 Pistas Propuestas</h3>";

    plan.forEach((p, i) => {
        // ✅ FIX: Australiana necesita separador propio (J1+J2 vs J3, no J1 vs J2 vs J3)
        let nombresDisplay;
        if (p.tipo === 'Australiana (2vs1)') {
            const jj = p.jugadores;
            nombresDisplay = jj.length === 3
                ? `${escapeHtml(jj[0].nombre)}+${escapeHtml(jj[1].nombre)} vs ${escapeHtml(jj[2].nombre)}`
                : p.jugadores.map(j => escapeHtml(j.nombre)).join(' · ');
        } else if (p.tipo === 'Asimétrico') {
            const corte = Math.ceil(p.jugadores.length / 2);
            const eqA = p.jugadores.slice(0, corte).map(j => escapeHtml(j.nombre)).join('+');
            const eqB = p.jugadores.slice(corte).map(j => escapeHtml(j.nombre)).join('+');
            nombresDisplay = `${eqA} vs ${eqB}`;
        } else {
            const separador = p.tipo === "Tríos" ? " + " : (p.tipo === "Dobles" ? " / " : " vs ");
            nombresDisplay = p.jugadores.map(j => escapeHtml(j.nombre)).join(separador);
        }
        const colorBorde = p.tipo === 'Tríos'             ? '#C5A059'
                         : p.tipo === 'Australiana (2vs1)' ? '#a78bfa'
                         : p.tipo === 'Asimétrico'         ? '#ff6b35'
                         : 'var(--atp-tennis)';
        
        html += `
            <div class="match-card" style="border-left: 5px solid ${colorBorde}; margin-bottom:10px; padding:15px; background:rgba(255,255,255,0.05); border-radius:10px;">
                <strong style="color:var(--atp-gold);">PISTA ${i+1} — ${p.tipo.toUpperCase()}</strong><br>
                <div style="margin-top:5px; font-weight:bold;">
                    ${nombresDisplay}
                </div>
            </div>`;
    });

    if (espera.length > 0) {
        html += `
            <div style="margin-top:20px; padding:15px; background:rgba(217, 83, 79, 0.1); border: 1px solid #d9534f; border-radius:10px;">
                <strong style="color:#d9534f;">⏳ En espera (Banquillo):</strong><br>
                <div style="margin-top:5px;">
                    ${espera.map(j => `<span style="display:inline-block; background:#333; padding:2px 8px; border-radius:4px; margin:2px; font-size:0.8rem;">${escapeHtml(j.nombre)}</span>`).join('')}
                </div>
            </div>`;
    }
    
    cont.innerHTML = html;
}

function calcularRotacionInteligente() {
    const todosLibres = window.jugadoresHoy.filter(j => !estaJugando(j.id) && !j.pausado);

    // Separar ranking e invitados — los invitados van siempre al final del pool
    // para no distorsionar la rotación justa entre jugadores de ranking.
    const rankingLibres   = todosLibres.filter(j => !j.esInvitado);
    const invitadosLibres = todosLibres.filter(j =>  j.esInvitado);

    // 1. Prioridad por descansos solo entre jugadores de ranking
    rankingLibres.sort((a, b) => (b.descansosSeguidos || 0) - (a.descansosSeguidos || 0));

    // Invitados se añaden al final (relleno de huecos), sin orden de descansos
    const disponibles = [...rankingLibres, ...invitadosLibres];

    let plan = [];
    let copiaDisponibles = [...disponibles];

    while (copiaDisponibles.length >= 2) {

        // ✅ FIX: Usar el motor centralizado en lugar de lógica manual
        // Sincronizado con generarPlanMaestro y generarPlanMaestroV2
        const decision = decidirModalidad(copiaDisponibles.length, 'dobles');

        if (!decision || decision.nReq < 2) break;

        // Traducción de modo interno a etiqueta visual para renderPlan()
        const etiquetas = {
            'trios':      'Tríos',
            'dobles':     'Dobles',
            'equipos3':   'Australiana (2vs1)',
            'individual': 'Individual',
            'asimetrico': 'Asimétrico'
        };
        const tipo = etiquetas[decision.modo] || 'Individual';

        const jugadoresPartido = copiaDisponibles.splice(0, decision.nReq);
        plan.push({ tipo, jugadores: jugadoresPartido });
    }

    return { plan, espera: copiaDisponibles };
}

function registrarYTraer() {
    const input = document.getElementById('nombre-tardio');
    if (!input) return;
    const nombre = input.value.trim();
    
    if (!nombre) return alert("Escribe un nombre.");

    // 1. Buscar coincidencia exacta en la BBDD (ignorando mayúsculas)
    let j = db.jugadores.find(x => x.nombre.toLowerCase() === nombre.toLowerCase());

    if (j) {
        // ESCENARIO A: El jugador YA existe en la cantera global
        if (window.jugadoresHoy.some(h => h.id.toString() === j.id.toString())) {
            alert("Este jugador ya está en la lista de hoy.");
        } else {
            // Añadimos a la jornada con los flags necesarios para V1/V2
            window.jugadoresHoy.push({
                ...j,
                pausado: false,
                estado: 'disponible', // 🛡️ Crucial para que el planificador lo vea
                descansosSeguidos: 0,
                perdioUltimo: false,  // 🛡️ Entra sin cuentas pendientes (Venganza)
                // ✅ FIX: stats completo — el fallback anterior solo tenía 5 campos
                stats: j.stats || {
                    ganados: 0, perdidos: 0, totales: 0, mvps: 0,
                    dobles: 0, simples: 0, gamificados: 0, trios: 0, asimetrico: 0, australiana: 0,
                    juegosFavor: 0, juegosContra: 0,
                    aces: 0, winners: 0, smashes: 0, voleas: 0, dejadas: 0, passings: 0
                }
            });
            console.log(`✅ ${j.nombre} recuperado de la cantera e integrado en la jornada.`);
        }
    } else {
        // ESCENARIO B: El jugador es nuevo de verdad
        if (!confirm(`El jugador "${nombre}" no está en la cantera. ¿Deseas crearlo como nuevo?`)) return;
        
        j = { 
            id: Date.now().toString(), 
            nombre: nombre, 
            nivel: "5.0",
            puntosTotales: 0,
            esInvitado: false,   // ✅ Invitados no computan en ranking
            habilidades: { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 },
            statsAcumuladas: { ace: 0, winner: 0, dejada: 0, volea: 0, smash: 0, passing: 0 },
            // ✅ FIX: stats completo — sin todos los campos, saveDB() produce NaN
            // al hacer Number(undefined) en el escudo anti-NaN, corrompiendo la BBDD.
            stats: {
                ganados: 0, perdidos: 0, totales: 0, mvps: 0,
                dobles: 0, simples: 0, gamificados: 0, trios: 0, asimetrico: 0, australiana: 0,
                juegosFavor: 0, juegosContra: 0,
                aces: 0, winners: 0, smashes: 0, voleas: 0, dejadas: 0, passings: 0
            }
        };
        
        db.jugadores.push(j);
        
        // Añadir a hoy con el perfil completo
        window.jugadoresHoy.push({
            ...j,
            pausado: false,
            estado: 'disponible',
            descansosSeguidos: 0,
            perdioUltimo: false
        });
        console.log(`✨ ${nombre} creado y añadido con perfil de competición.`);
    }

    // 2. Persistencia y refresco (Mantenemos tus llamadas originales)
    saveDB();
    input.value = "";
    
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderVotos === 'function') renderVotos();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    if (typeof actualizarInterfazManual === 'function') actualizarInterfazManual();
    if (typeof renderCantera === 'function') renderCantera();
    
    // Sincronizar TV (Vital para actualizar el Ranking en tiempo real)
    if (typeof sincronizarTV === 'function') sincronizarTV();
}

function añadirDesdeBBDD() {
    const select = document.getElementById('select-bbdd');
    const id = select ? select.value : null;
    if (!id) return;

    // 1. Buscamos al jugador en la base global (Cantera)
    const j = db.jugadores.find(x => x.id.toString() === id.toString());
    
    // 2. Verificamos si existe y si NO está ya en la jornada de hoy (Comparación estricta de IDs)
    if (j && !window.jugadoresHoy.some(x => x.id.toString() === j.id.toString())) {
        
        // 3. Inyectamos con el "Kit de Jornada" completo para V1/V2
        window.jugadoresHoy.push({
            ...j,
            pausado: false,         // 🛡️ Entra activo para que el planificador lo cuente
            estado: 'disponible',   // 🛡️ Flag para el renderizado de burbujas en el HUB
            descansosSeguidos: 0,   // 🛡️ Reset de prioridad para evitar saltos de turno injustos
            perdioUltimo: false,    // 🛡️ Reset de venganza para empezar la sesión de cero
            // ✅ FIX: stats completo — el fallback anterior solo tenía 5 campos,
            // si j.stats era undefined se guardaba un objeto truncado sin aces, winners, etc.
            stats: j.stats || {
                ganados: 0, perdidos: 0, totales: 0, mvps: 0,
                dobles: 0, simples: 0, gamificados: 0, trios: 0, asimetrico: 0, australiana: 0,
                juegosFavor: 0, juegosContra: 0,
                aces: 0, winners: 0, smashes: 0, voleas: 0, dejadas: 0, passings: 0
            }
        });
        
        console.log(`✅ ${j.nombre} añadido a la jornada desde la base de datos.`);
    } else if (j) {
        alert(`${j.nombre} ya se encuentra en la lista de hoy.`);
    }

    // 4. Refresco y Persistencia (Mantenemos tus funciones centralizadas)
    saveDB();
    
    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderVotos === 'function') renderVotos();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    if (typeof actualizarInterfazManual === 'function') actualizarInterfazManual(); 
    
    // Limpiamos el select para la siguiente búsqueda
    if (select) select.value = "";
    
    // Sincronización con TV (Vital si el jugador rescatado entra directo al Top 10)
    if (typeof sincronizarTV === 'function') sincronizarTV();
}

function renderPresentes() {
    const cont = document.getElementById('lista-presentes-hoy');
    if (!cont) return;

    const lista = window.jugadoresHoy || [];

    if (lista.length === 0) {
        cont.innerHTML = '<p style="color:#999; font-size:0.8rem; padding:10px;">No hay jugadores presentes hoy.</p>';
        return;
    }

    function tagJugador(j) {
        const idStr = j.id.toString();
        const jugando = estaJugando(idStr);
        const pausado = j.pausado || false;

        let colorFondo = j.esInvitado ? '#b45309' : 'var(--atp-blue)';
        if (jugando) colorFondo = '#444';
        if (pausado) colorFondo = '#ff9800';

        const icono = pausado ? ' ☕' : (jugando ? ' 🎾' : '');
        const prioridad = (!j.esInvitado && !jugando && !pausado && (j.descansosSeguidos || 0) > 0)
            ? `<span style="background:var(--atp-gold); color:black; padding:0 5px; border-radius:50%; font-size:0.6rem; margin-left:5px;">${j.descansosSeguidos}</span>`
            : '';

        const badgeInvitado = j.esInvitado
            ? '<span style="font-size:0.5rem; background:rgba(245,158,11,0.3); border:1px solid #f59e0b; color:#fde68a; border-radius:8px; padding:1px 5px; margin-left:4px; letter-spacing:0.5px;">INVITADO</span>'
            : '';
        return `
            <div class="tag-jugador" onclick="togglePausa('${idStr}')"
                 style="cursor:pointer; background:${colorFondo}; display:inline-flex; align-items:center; margin:3px; padding:6px 12px; border-radius:20px; color:white; font-size:0.75rem; font-weight:bold; border:1px solid rgba(255,255,255,0.2);">
                ${j.nombre.toUpperCase()} ${icono} ${prioridad} ${badgeInvitado}
            </div>`;
    }

    const ranking   = lista.filter(j => !j.esInvitado);
    const invitados = lista.filter(j =>  j.esInvitado);

    let htmlFinal = ranking.map(tagJugador).join('');

    if (invitados.length > 0) {
        htmlFinal += `<div style="width:100%;margin:8px 0 4px;font-size:0.6rem;font-weight:900;
                          color:#f59e0b;letter-spacing:1px;text-transform:uppercase;padding-left:4px;">
                          👨‍👧 Invitados (sin ranking)</div>`;
        htmlFinal += invitados.map(tagJugador).join('');
    }

    cont.innerHTML = htmlFinal;
}

// Función necesaria para activar/desactivar el modo café al hacer clic
function togglePausa(id) {
    var jugador = window.jugadoresHoy.find(function(x) { return String(x.id) === String(id); });
    if (!jugador) return;
    // ✅ FIX UX: antes el botón parecía no responder si el jugador estaba jugando.
    // Mismo patrón que removerHoy() — feedback explícito en lugar de silencio.
    if (estaJugando(id)) {
        alert(`☕ No se puede pausar a ${jugador.nombre}: está jugando ahora mismo.\n` +
              `Espera a que finalice su partido para activarle el modo "café".`);
        return;
    }
    jugador.pausado = !jugador.pausado;
    saveDB();           // ← añadir
    renderPresentes();
    sincronizarTV();
    if (typeof actualizarInterfazManual === 'function') actualizarInterfazManual();
}

function removerHoy(id) {
    const idStr = String(id);

    // ✅ FIX: Bloquear si el jugador está jugando en una pista activa
    if (typeof estaJugando === 'function' && estaJugando(idStr)) {
        return alert(`🚫 No puedes quitar a este jugador porque está jugando en una pista.\nFinaliza su partido primero.`);
    }

    window.jugadoresHoy = window.jugadoresHoy.filter(x => String(x.id) !== idStr);

    // ✅ Limpiar campos MVP dual si el jugador removido era MVP activo
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

    saveDB();

    if (typeof renderPresentes === 'function') renderPresentes();
    if (typeof renderVotos === 'function') renderVotos();
    if (typeof renderGolpesGanadores === 'function') renderGolpesGanadores();
    if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
    if (typeof actualizarInterfazManual === 'function') actualizarInterfazManual();
    if (typeof filtrarAsistencia === 'function') filtrarAsistencia();
    if (typeof sincronizarTV === 'function') sincronizarTV();
    if (typeof actualizarContadoresPistas === 'function') actualizarContadoresPistas();

    // Actualizar contador del Hub si existe
    const contador = document.getElementById('count-presentes');
    if (contador) contador.innerText = window.jugadoresHoy.length;
}



function actualizarSelectMVP() {
    const select = document.getElementById('select-mvp');
    if (!select) return;

    // 1. Empezamos con la opción por defecto
    let html = '<option value="">-- MVP --</option>';

    // 2. Recorremos los jugadores de hoy y sumamos las opciones
    // Usamos concatenación tradicional para evitar errores de sintaxis
    window.jugadoresHoy.forEach(function(j) {
        html += '<option value="' + j.id + '">' + escapeHtml(j.nombre) + '</option>';
    });

    // 3. Inyectamos el resultado final
    select.innerHTML = html;
}
