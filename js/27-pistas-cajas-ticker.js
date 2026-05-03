/* ============================================================
   ATP PLATINUM — 27-pistas-cajas-ticker.js
   Cajas de pistas (config club / estado), ticker de noticias
   ── Refactor: extraído de script.js (líneas [(8548, 8897)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// GENERACIÓN DE CAJAS DE PISTAS POR HORA
// ==========================================

/**
 * Obtener TODAS las pistas físicas del club (1..N).
 * Útil para construir las cajas de selección por hora, NO para el selector
 * de asignación manual (que debe usar getPistasDisponiblesJornada).
 */
function getPistasDelClub() {
    const n = parseInt(document.getElementById('plan-pistas-totales')?.value) || 8;
    return Array.from({ length: n }, (_, i) => i + 1);
}

/**
 * ✅ FIX BUG ASIGNACIÓN MANUAL: pistas DISPONIBLES PARA LA JORNADA.
 *
 * Devuelve las pistas que están realmente disponibles para asignar partidos
 * en esta jornada. Combina TRES fuentes:
 *
 *  1. Pistas marcadas como activas en las cajas (db.pistasEstado por hora).
 *     Si una pista está activa en CUALQUIER hora de la jornada, está disponible.
 *
 *  2. Pistas reservadas por padres desde el portal de inscripciones
 *     (db.pistasReservadas[].numero).
 *
 *  3. Pistas con partido abierto AHORA (window.partidosAbiertos[].pista).
 *     Estas se incluyen aunque no estuvieran marcadas — el partido en curso
 *     prueba que esa pista existe y se está usando, así que es relevante
 *     mostrarla en el selector (como ocupada).
 *
 * Si no hay pistas configuradas en ningún sitio (caso inicial sin setup),
 * cae al fallback de getPistasDelClub() para no romper nada.
 *
 * @returns Array<number> ordenado ascendente y deduplicado.
 */
function getPistasDisponiblesJornada() {
    const set = new Set();

    // 1. Pistas activas en las cajas (cualquier hora cuenta)
    const estado = (db && db.pistasEstado) ? db.pistasEstado : {};
    Object.values(estado).forEach(pistasDeHora => {
        if (pistasDeHora && typeof pistasDeHora === 'object') {
            Object.entries(pistasDeHora).forEach(([num, activa]) => {
                if (activa === true) set.add(Number(num));
            });
        }
    });

    // 2. Pistas reservadas por padres desde el portal
    const reservadas = Array.isArray(db.pistasReservadas)
        ? db.pistasReservadas
        : Object.values(db.pistasReservadas || {});
    reservadas.forEach(r => {
        if (r && r.reservadoPor && r.numero != null) set.add(Number(r.numero));
    });

    // 3. Pistas con partido en curso (incluye también si alguien las usa
    //    sin haberlas marcado: las mostraremos como ocupadas)
    (window.partidosAbiertos || []).forEach(p => {
        if (p && p.pista != null) set.add(Number(p.pista));
    });

    // Si no hay nada configurado, fallback a todas las del club
    if (set.size === 0) return getPistasDelClub();

    return Array.from(set).sort((a, b) => a - b);
}

// ── Obtener pistas libres (disponibles en la jornada y SIN partido activo) ──
function getPistasLibres() {
    const disponibles = getPistasDisponiblesJornada();
    const ocupadas = new Set((window.partidosAbiertos || []).map(p => String(p.pista)));
    return disponibles.filter(n => !ocupadas.has(String(n)));
}

// ── Poblar el select de pista manual con estado libre/ocupado ──
// ✅ FIX BUG ASIGNACIÓN MANUAL: ahora muestra solo pistas DISPONIBLES en la
// jornada (activadas + reservadas + en curso), no todas las del club.
function poblarSelectPistaManual(pistaPreseleccionada) {
    const sel = document.getElementById('pista-manual');
    if (!sel) return;

    const disponibles = getPistasDisponiblesJornada();
    const ocupadas = new Set((window.partidosAbiertos || []).map(p => String(p.pista)));

    // Map de info de reserva (para tooltip)
    const reservadasInfo = {};
    const reservas = Array.isArray(db.pistasReservadas)
        ? db.pistasReservadas
        : Object.values(db.pistasReservadas || {});
    reservas.forEach(r => {
        if (r && r.reservadoPor && r.numero != null) {
            reservadasInfo[Number(r.numero)] = r.reservadoPor;
        }
    });

    const anterior = pistaPreseleccionada != null
        ? String(pistaPreseleccionada)
        : (sel.value || '');

    if (disponibles.length === 0) {
        sel.innerHTML = '<option value="" disabled>⚠️ No hay pistas configuradas — marca pistas en las cajas de arriba</option>';
        return;
    }

    sel.innerHTML = disponibles.map(n => {
        const libre = !ocupadas.has(String(n));
        const reservada = reservadasInfo[n];
        let label;
        if (libre) {
            label = reservada
                ? `Pista ${n} — libre ✅ · 🎾 reservada (${reservada})`
                : `Pista ${n} — libre ✅`;
        } else {
            label = `Pista ${n} — ocupada 🔴`;
        }
        const disabled = libre ? '' : 'disabled';
        const selected = String(n) === anterior && libre ? 'selected' : '';
        return `<option value="${n}" ${disabled} ${selected}>${label}</option>`;
    }).join('');

    // Si la pista anterior quedó ocupada o ya no está disponible, saltar a la primera libre
    const sigueValida = disponibles.some(n => String(n) === anterior && !ocupadas.has(String(n)));
    if (!sigueValida) {
        const primeraLibre = disponibles.find(n => !ocupadas.has(String(n)));
        if (primeraLibre != null) sel.value = String(primeraLibre);
    }
}

// Todas las pistas salen desmarcadas. El coordinador marca las disponibles en cada hora.
function generarCajasPistas() {
    const hrsInput    = document.getElementById('plan-hours');
    const pistasInput = document.getElementById('plan-pistas-totales');
    const contenedor  = document.getElementById('contenedor-cajas-pistas');

    if (!hrsInput || !pistasInput || !contenedor) return;

    const hrs        = parseInt(hrsInput.value)    || 1;
    const pistasClub = parseInt(pistasInput.value) || 1;

    // Leer el estado guardado ANTES de limpiar el contenedor
    const estadoGuardado = _cargarEstadoPistas();

    // ✅ Precargar pistas reservadas desde pistasReservadas (portal inscripciones).
    // Los números de pista reservados por los padres se marcan como activos
    // en TODAS las horas de la jornada. El admin puede ajustar manualmente después.
    const pistasReservadasNums = new Set(
        (Array.isArray(db.pistasReservadas) ? db.pistasReservadas : Object.values(db.pistasReservadas || {}))
        .filter(Boolean)
        .filter(r => r.reservadoPor)
        .map(r => Number(r.numero))
    );

    contenedor.innerHTML = '';
    window.TOTAL_PISTAS_MAX = pistasClub;

    for (let h = 1; h <= hrs; h++) {
        const fila = document.createElement('div');
        fila.className    = 'fila-pistas-hora';
        fila.dataset.hora = h;

        const label = document.createElement('span');
        label.className   = 'hora-label';
        label.textContent = `HORA ${h}`;
        fila.appendChild(label);

        const grupo = document.createElement('div');
        grupo.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; align-items:center;';

        for (let p = 1; p <= pistasClub; p++) {
            const caja = document.createElement('div');
            // Estado: guardado manualmente > pista reservada por padres > inactiva
            const estaActivaGuardada   = estadoGuardado[h] && estadoGuardado[h][p] === true;
            const estaActivaReservada  = pistasReservadasNums.has(p);
            const estaActiva = estaActivaGuardada || estaActivaReservada;

            caja.className   = 'caja-pista-check ' + (estaActiva ? 'activa' : 'inactiva');
            caja.textContent = `P${p}`;
            // Tooltip extra si viene de reserva
            const origenReserva = estaActivaReservada && !estaActivaGuardada ? ' (reservada)' : '';
            caja.title = estaActiva
                ? `Pista ${p} — disponible${origenReserva} (clic para desmarcar)`
                : `Pista ${p} — clic para marcar como disponible`;

            caja.addEventListener('click', function() {
                const disponible = this.classList.toggle('activa');
                this.classList.toggle('inactiva', !disponible);
                this.title = disponible
                    ? `Pista ${p} — disponible (clic para desmarcar)`
                    : `Pista ${p} — clic para marcar como disponible`;
                _guardarEstadoPistas(); // persistir tras cada clic
            });

            grupo.appendChild(caja);
        }

        fila.appendChild(grupo);
        contenedor.appendChild(fila);
    }

    // Si hay pistas reservadas que no estaban guardadas, persistir el nuevo estado
    if (pistasReservadasNums.size > 0) {
        _guardarEstadoPistas();
    }
}

// ── Persistencia del estado de cajas (qué pistas están activas por hora) ──
// ✅ FIX BUG PISTAS: antes solo se guardaba en localStorage, lo que hacía
// que el estado se perdiera al refrescar desde otro dispositivo o navegador.
// Ahora se persiste en Firebase (db.pistasEstado) para sincronización cross-device.
function _guardarEstadoPistas() {
    const filas = document.querySelectorAll('.fila-pistas-hora');
    const estado = {}; // { hora: { pista: true/false } }
    filas.forEach(fila => {
        const h = parseInt(fila.dataset.hora);
        estado[h] = {};
        fila.querySelectorAll('.caja-pista-check').forEach(caja => {
            const p = parseInt(caja.textContent.replace('P', ''));
            estado[h][p] = caja.classList.contains('activa');
        });
    });
    try { localStorage.setItem('atp_pistas_estado', JSON.stringify(estado)); } catch(e) {}
    db.pistasEstado = estado;
    // ✅ FIX BUG PERMISSION_DENIED: el path /torneoPlatinum/pistasEstado hereda
    // las reglas de /torneoPlatinum, escribibles por admins y árbitros.
    // Bloqueamos el set para usuarios sin rol (que son los que provocaban el
    // permission_denied al cargar la app si había pistas reservadas detectadas).
    // Admins y árbitros sí pueden sincronizar a Firebase.
    if (typeof database !== 'undefined' &&
        (window.rolUsuario === 'admin' || window.rolUsuario === 'arbitro')) {
        database.ref('torneoPlatinum/pistasEstado').set(estado)
            .catch(err => console.warn('No se pudo guardar pistasEstado en Firebase:', err));
    }

    // ✅ FIX BUG PROPAGACIÓN: cuando el admin marca una pista nueva durante
    // la jornada, ese cambio debe reflejarse INMEDIATAMENTE en:
    //   - El selector de asignación manual (#pista-manual)
    //   - El badge "Pistas Libres: X / Y"
    //   - El control de pistas (si está abierto)
    // Antes solo se actualizaban al recargar o al volver a entrar en la pantalla.
    if (typeof poblarSelectPistaManual === 'function') {
        try { poblarSelectPistaManual(); } catch(e) { console.warn('poblarSelectPistaManual:', e); }
    }
    if (typeof actualizarBadgePistas === 'function') {
        try { actualizarBadgePistas(); } catch(e) {}
    }
    if (typeof renderControlPistas === 'function' && document.getElementById('pantalla-control-pistas')) {
        try { renderControlPistas(); } catch(e) {}
    }
}

function _cargarEstadoPistas() {
    // Prioridad: Firebase (db.pistasEstado) > localStorage
    if (db.pistasEstado && typeof db.pistasEstado === 'object' && Object.keys(db.pistasEstado).length > 0) {
        return db.pistasEstado;
    }
    try {
        const saved = localStorage.getItem('atp_pistas_estado');
        return saved ? JSON.parse(saved) : {};
    } catch(e) { return {}; }
}

// Guardar el número total de pistas del club en localStorage Y Firebase
window.guardarConfigPistasClub = function() {
    const pistasInput = document.getElementById('plan-pistas-totales');
    if (!pistasInput) return;
    const val = parseInt(pistasInput.value) || 8;
    localStorage.setItem('atp_pistas_club', val);
    window.TOTAL_PISTAS_MAX = val;
    // ✅ Sincronizar a Firebase para que inscripciones.html pueda leer cuántas
    // pistas tiene el club y poblar el desplegable correctamente.
    // /torneoPlatinum/numPistasClub hereda escritura del padre: admins y árbitros.
    if (typeof database !== 'undefined' &&
        (window.rolUsuario === 'admin' || window.rolUsuario === 'arbitro')) {
        database.ref('torneoPlatinum/numPistasClub').set(val)
            .catch(err => console.warn('Error guardando numPistasClub:', err));
    }
    // ✅ FIX BUG PROPAGACIÓN: si el admin cambia "PISTAS CLUB" durante la jornada,
    // re-generar las cajas y repoblar el selector para reflejar el cambio.
    if (typeof generarCajasPistas === 'function') {
        try { generarCajasPistas(); } catch(e) {}
    }
    if (typeof poblarSelectPistaManual === 'function') {
        try { poblarSelectPistaManual(); } catch(e) {}
    }
    if (typeof actualizarBadgePistas === 'function') {
        try { actualizarBadgePistas(); } catch(e) {}
    }
};

// Enviar el plan generado a TV + copiar link fans para compartir
window.enviarPlanATV = function() {
    const resultadoDiv = document.getElementById('resultado-planificacion');
    if (!resultadoDiv || resultadoDiv.innerText.trim().length < 10) {
        alert('⚠️ Genera un plan primero antes de enviarlo.');
        return;
    }

    const URL_FANS = 'https://los-partidillos-de-los-viernes.netlify.app/fans/fans.html';

    // Construir texto del plan — preferir datos estructurados si disponibles
    const _gnATV = id => (db.jugadores || []).find(x => String(x.id) === String(id))?.nombre || '???';
    const _modoLblATV = t => ({ trios:'🔱 TRÍOS', dobles:'🎾 DOBLES', individual:'🤺 INDIVIDUAL',
        equipos3:'🔄 AUSTRALIANA', asimetrico:'⚡ ASIMÉTRICO', gamificado:'🎮 GAMIFICADO' }[t] || t?.toUpperCase() || '');

    let resumen = '🎾 PLAN DE PISTAS:\n';
    let _bloquesCont = 0;

    if (Array.isArray(window.planesTemporales) && window.planesTemporales.length > 0) {
        window.planesTemporales.forEach((bloque, bi) => {
            if (!Array.isArray(bloque) || !bloque.length) return;
            _bloquesCont++;
            if (window.planesTemporales.length > 1) resumen += `── BLOQUE ${bi + 1} ──\n`;
            bloque.forEach(p => {
                const pistaStr = p.pistaSugerida ? `PISTA ${p.pistaSugerida}` : '';
                const modoStr  = _modoLblATV(p.tipo);
                if (pistaStr || modoStr) resumen += `[${[pistaStr, modoStr].filter(Boolean).join(' · ')}]\n`;
                resumen += (p.nombres || (p.ids || []).map(_gnATV).join(' / ')) + '\n';
            });
            resumen += '\n';
        });
    }

    // Fallback DOM si no hay datos en memoria
    if (_bloquesCont === 0) {
        resultadoDiv.querySelectorAll('.card').forEach(card => {
            const titulo = card.querySelector('b')?.innerText?.trim();
            if (!titulo) return;
            const clone = card.cloneNode(true);
            clone.querySelectorAll('button, .btn-bloque-plan, .btn-primary-atp').forEach(el => el.remove());
            const lineas = clone.innerText.split('\n')
                .map(l => l.trim())
                .filter(l => l && l !== titulo && !l.startsWith('🚫'));
            if (!lineas.length) return;
            _bloquesCont++;
            resumen += titulo + '\n' + lineas.join('\n') + '\n\n';
        });
    }

    // Mostrar prompt con el resumen y el link
    const msg = resumen + '\n📡 Portal en directo: ' + URL_FANS;
    const elegido = prompt('✏️ Copia el texto para compartir (WhatsApp, Telegram…)\n\nTambién puedes editarlo:', msg);

    // Si el usuario pulsa OK (no cancela), copiar al portapapeles
    if (elegido !== null) {
        navigator.clipboard.writeText(elegido).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = elegido;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
        // Abrir TV mode simultáneamente
        if (typeof abrirDashboardTV === 'function') abrirDashboardTV();
    }
};

function actualizarTicker() {
    const ticker = document.getElementById('ticker-text');
    let mensajes = [];
    const todosLosJugadores = db.jugadores || [];
    const ranking = [...todosLosJugadores].sort((a,b) => (b.puntosTotales || 0) - (a.puntosTotales || 0));

    const inputPistas = document.getElementById('plan-pistas-totales');
    const totalPistas = inputPistas ? parseInt(inputPistas.value) || 2 : (window.TOTAL_PISTAS_MAX || 2);
    const ocupadas = window.partidosAbiertos ? window.partidosAbiertos.length : 0;
    const libres = Math.max(0, totalPistas - ocupadas);

    if (libres > 0) {
        mensajes.push(`🏟️ PISTAS DISPONIBLES: ¡Hay ${libres} pistas libres! Acércate al control para jugar.`);
    }

    if (window.partidosAbiertos && window.partidosAbiertos.length > 0) {
        window.partidosAbiertos.forEach(p => {
            const modoTicker = resolverModoPartido(p);
            // ✅ Gamificado en vivo: construir marcador desde puntosGamificados
            let marcador;
            if ((p.gamified || p.tipo === 'gamificado') && p.puntosGamificados && p.ids) {
                marcador = p.ids.map(id => {
                    const jt = todosLosJugadores.find(x => x.id.toString() === id?.toString());
                    return `${jt ? jt.nombre.split(' ')[0] : '?'}:${p.puntosGamificados[id] || 0}`;
                }).join(' ');
            } else {
                marcador = p.marcador || "0-0";
            }
            const iconoPista = modoTicker.icono;

            // ✅ FIX: guard para p.ids undefined — si el partido se creó sin ids, evitar crash
            const nombrePartido = p.nombres || (p.ids || []).slice(0,2).map(id => {
                const j = todosLosJugadores.find(x => x.id.toString() === id?.toString());
                return j ? j.nombre : '?';
            }).join(' vs ');

            const labelModo = modoTicker.esGamificado    ? ' [GAMIFICADO]'
                            : p.tipo === 'equipos3'      ? ` [AUSTRALIANA R${(p.rondaActual ?? 0) + 1}]`
                            : modoTicker.esTrio          ? ' [TRÍOS]'
                            : modoTicker.esAsimetrico    ? ` [${modoTicker.etiqueta}]`
                            : '';

            mensajes.push(`${iconoPista} PISTA ${p.pista}: ${nombrePartido}${labelModo} [${marcador}]`);

            // Análisis de ranking solo para partidos 1v1 y 2v2
            if (p.ids.length <= 4 && !p.gamified && p.tipo !== 'equipos3') {
                const p1 = todosLosJugadores.find(x => x.id.toString() === p.ids[0]?.toString());
                const p2 = todosLosJugadores.find(x => x.id.toString() === p.ids[1]?.toString());
                if (p1 && p2) {
                    const difRanking = Math.abs((p2.puntosTotales || 0) - (p1.puntosTotales || 0));
                    if ((p2.puntosTotales || 0) > (p1.puntosTotales || 0) && difRanking > 15)
                        mensajes.push(`⭐ SORPRESA: ${p1.nombre} está desafiando al gigante ${p2.nombre}.`);
                    if (difRanking <= 5)
                        mensajes.push(`⚖️ MÁXIMA IGUALDAD (Pista ${p.pista}): Separados por solo ${difRanking} pts.`);
                    else if (difRanking > 100)
                        mensajes.push(`🏛️ DAVID vs GOLIAT (Pista ${p.pista}): Diferencia de ${difRanking} pts.`);
                }
            }
            if (p.esVenganza) mensajes.push(`🔥 VENGANZA (Pista ${p.pista}): ¡Hay cuentas pendientes en este partido!`);
        });
    }

    if (ranking.length >= 2) {
        const lider = ranking[0];
        const seguidor = ranking[1];
        const difTop = lider.puntosTotales - seguidor.puntosTotales;
        mensajes.push(`👑 LÍDER INDISCUTIBLE: ${lider.nombre} domina el circuito con ${lider.puntosTotales} pts.`);
        if (difTop > 0 && difTop <= 15) {
            mensajes.push(`🚨 ALERTA RANKING: ¡A ${seguidor.nombre} solo le faltan ${difTop} pts para arrebatarle el N1 a ${lider.nombre}!`);
        }
    }

    if (window.partidosFinalizadosHoy && window.partidosFinalizadosHoy.length > 0) {
        const ultimo = window.partidosFinalizadosHoy[window.partidosFinalizadosHoy.length - 1];
        mensajes.push(`✅ ÚLTIMO RESULTADO: Partido finalizado en la Pista ${ultimo.pista || 'X'}. ¡Puntos repartidos!`);
    }

    const presentes = (window.jugadoresHoy || []).filter(j => !j.pausado).length;
    if (presentes > 0 && presentes < (totalPistas * 2)) {
        mensajes.push(`⚠️ SE BUSCAN JUGADORES: Faltan inscritos para completar el próximo turno de pistas.`);
    }

    const frasesMotivacion = [
        "💪 ¡VAMOS! Cada punto cuenta para el MVP de la jornada.",
        "✨ FAIR PLAY: La elegancia en la victoria es la marca Platinum.",
        "🔔 RECORDATORIO: Al terminar, introduce el resultado en la tablet de pista."
    ];

    const poolFinal = [...mensajes, ...frasesMotivacion];
    poolFinal.sort(() => Math.random() - 0.5);
    const textoFinal = " 🎾   " + poolFinal.join("     🏆     ") + "   🎾 ";

    if (ticker) {
        ticker.innerText = textoFinal;
        ticker.style.fontSize = "1.5rem";
        ticker.style.fontWeight = "900";
        ticker.style.color = "#ccff00";
        const factorVelocidad = window.innerWidth < 768 ? 0.22 : 0.15;
        const duracion = textoFinal.length * factorVelocidad;
        ticker.style.animation = 'none';
        void ticker.offsetWidth;
        ticker.style.animation = `ticker-move ${duracion}s linear infinite`;
        ticker.style.animationPlayState = 'running';
    }

    if (window.tvChannel) {
        window.tvChannel.postMessage({
            action: 'UPDATE_TICKER',
            payload: { text: textoFinal, pistasLibres: libres, totalPistas: totalPistas }
        });
    }
}

