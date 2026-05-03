/* ============================================================
   ATP PLATINUM — 14-cierre-jornada.js
   Cerrar jornada, ver detalle de jornada
   ── Refactor: extraído de script.js (líneas [(5047, 5272)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function cerrarJornada() {
    // 1. ESCUDOS DE SEGURIDAD (mantenidos exactamente como los tenías)
    if (window.partidosAbiertos && window.partidosAbiertos.length > 0) {
        alert("⛔ BLOQUEO: Aún hay partidos en curso. Finalízalos antes de cerrar.");
        showSection('jornada');
        return;
    }

    const hayMVPAsignado = (window.mvpIdsJugadores?.length > 0) || 
                           (window.mvpIdsEntrenadores?.length > 0);

    if (!hayMVPAsignado) {
        // ✅ FIX FLUJO MVP: en lugar de bloquear sin salida, informamos al usuario
        // y le damos opciones claras: ir a asignar MVP (recomendado) o continuar sin él.
        const irAMVP = confirm(
            "⚠️ ATENCIÓN: No has asignado ningún MVP de esta jornada.\n\n" +
            "El reconocimiento al mejor jugador/entrenador forma parte del cierre oficial.\n\n" +
            "✅  ACEPTAR  → ir a la pantalla de MVP para asignarlo ahora (recomendado)\n" +
            "❌  CANCELAR → continuar cerrando SIN MVP (quedará sin reconocimiento)"
        );
        if (irAMVP) {
            showSection('sec-mvp');
            return;
        }
        // El usuario elige cerrar sin MVP — doble confirmación obligatoria
        if (!confirm("⚠️ ¿Confirmas el cierre de jornada SIN asignar MVP?\n\nEsta jornada quedará registrada sin reconocimiento al mejor jugador/entrenador.")) {
            return;
        }
    }

    if (!confirm("🏁 ¿CERRAR JORNADA Y ENVIAR REPORTE?\n\nSe actualizarán rankings, se generará el informe de WhatsApp y volverás al HUB.")) 
        return;

    if (window.jugadoresHoy.length === 0 && window.partidosFinalizadosHoy.length === 0) {
        if (!confirm("⚠️ No hay jugadores ni partidos registrados en esta jornada.\n¿Cerrar igualmente?")) return;
    }

    // =============================================
    // CONSOLIDAR MVPs ANTES DE CUALQUIER OTRA ACCION
    // FIX: capturar snapshots de IDs ANTES de consolidar.
    // consolidarMVPsDelDia() aplica puntos (si se uso toggleMVP/sistema diferido)
    // pero no resetea los arrays — el reset lo hace la limpieza al final.
    // Estos snapshots garantizan que el historial y el WhatsApp siempre
    // reflejen el MVP real aunque consolidar haya cambiado los arrays.
    // =============================================
    const _mvpIdsJSnap = Array.isArray(window.mvpIdsJugadores)    ? [...window.mvpIdsJugadores]    : [];
    const _mvpIdsESnap = Array.isArray(window.mvpIdsEntrenadores) ? [...window.mvpIdsEntrenadores] : [];

    consolidarMVPsDelDia();


    // 2. ACTUALIZACIÓN DE ESTADÍSTICAS Y RANKING (mantenido)
    window._estadisticasJornadaYaGuardadas = false;
    try {
        if (typeof actualizarEstadisticasJugadores === 'function') {
            actualizarEstadisticasJugadores();
        }
    } catch (e) {
        console.error('❌ Error en actualizarEstadisticasJugadores:', e);
        window._estadisticasJornadaYaGuardadas = false;
    }

    // 3. CONSTRUCCIÓN DEL MENSAJE DE WHATSAPP (mejorado pero manteniendo tu lógica)
    // FIX-MVP-CIERRE: usar snapshots capturados antes de consolidar
    const mvpIdsJ = _mvpIdsJSnap;
    const mvpIdsE = _mvpIdsESnap;
    
    const _gn = id => db.jugadores.find(x => String(x.id) === String(id))?.nombre?.toUpperCase() || '?';
    
    const nombresMVPJ = mvpIdsJ.length ? mvpIdsJ.map(_gn).join(', ') : null;
    const nombresMVPE = mvpIdsE.length ? mvpIdsE.map(_gn).join(', ') : null;
    // null cuando no hay MVP — el historial lo muestra como 'Sin MVP asignado'
    const nombreMVP = nombresMVPJ || nombresMVPE || null;

    const fecha = new Date().toLocaleDateString();
    // WA-FIX 2: enriquecer mensaje con asistentes totales, nº de partidos,
    // marcadores limpios (sin "0-0" si hay datos de tb/aus) y golpes del día.
    const _numAsistentes = (window.jugadoresHoy || []).filter(j => !j.esInvitado).length;
    const _numPartidos   = (window.partidosFinalizadosHoy || []).length;

    let mensaje = `🎾 *ATP MASTER TOUR PRO* - ${fecha}\n`;
    if (_numAsistentes > 0) mensaje += `👥 *Asistentes:* ${_numAsistentes} jugadores · ${_numPartidos} partidos\n`;
    if (nombresMVPJ) mensaje += `🗳️ *MVP JUGADORES:* ${nombresMVPJ} 👑\n`;
    if (nombresMVPE) mensaje += `👨‍🏫 *MVP ENTRENADORES:* ${nombresMVPE} 👑\n`;
    mensaje += `━━━━━━━━━━━━━━━━\n\n`;
    mensaje += `📊 *RESULTADOS DISPUTADOS:*\n`;

    if (window.partidosFinalizadosHoy && window.partidosFinalizadosHoy.length > 0) {
        window.partidosFinalizadosHoy.forEach(p => {
            const modo = resolverModoPartido(p);
            // WA-FIX 2b: marcador limpio — si sigue siendo "0-0" pero hay datos
            // de tb o australiana, construir el texto correcto
            let marcador = p.marcador && p.marcador !== "0-0" && p.marcador !== "0 - 0"
                ? p.marcador
                : `${p.juegosA || 0}-${p.juegosB || 0}`;
            // Evitar "0-0" vacíos en el mensaje: si sigue 0-0 y hay TB, indicarlo
            if ((marcador === '0-0' || marcador === '0 - 0') && p.tiebreak) {
                marcador = `TB ${p.tbPuntosA || 0}-${p.tbPuntosB || 0}`;
            }
            mensaje += `${modo.icono} ${p.nombres} → *${marcador}*\n`;
        });
    } else {
        mensaje += `_Sin partidos registrados hoy._\n`;
    }

    // WA-FIX 2c: añadir top golpes del día si los hay
    const _golpesHoy = window.golpesGanadoresHoy || {};
    const _totalGolpesHoy = Object.values(_golpesHoy).reduce((s, g) => {
        return s + Object.values(g || {}).reduce((a, b) => a + Number(b || 0), 0);
    }, 0);
    if (_totalGolpesHoy > 0) {
        // Encontrar al jugador con más golpes totales hoy
        let _topGolpeNombre = null, _topGolpeTotal = 0;
        Object.entries(_golpesHoy).forEach(([id, golpes]) => {
            const total = Object.values(golpes || {}).reduce((a, b) => a + Number(b || 0), 0);
            if (total > _topGolpeTotal) {
                _topGolpeTotal = total;
                const jj = (db.jugadores || []).find(x => String(x.id) === String(id));
                _topGolpeNombre = jj ? jj.nombre : null;
            }
        });
        if (_topGolpeNombre) {
            mensaje += `\n🎯 *Golpes del día:* ${_topGolpeTotal} registrados — destacado: *${_topGolpeNombre}*\n`;
        }
    }

    mensaje += `\n━━━━━━━━━━━━━━━━\n`;
    mensaje += `🏆 *TOP 5 RANKING ACTUALIZADO:*\n`;
    const rankingTop = [...(db.jugadores || [])]
        .filter(j => !j.esInvitado)   // Top 5 sin invitados
        .sort((a, b) => (b.puntosTotales || 0) - (a.puntosTotales || 0))
        .slice(0, 5);
    rankingTop.forEach((j, i) => {
        const medalla = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '🔹'));
        mensaje += `${medalla} ${j.nombre}: *${j.puntosTotales} pts*\n`;
    });

    const URL_FANS = "https://los-partidillos-de-los-viernes.netlify.app/fans/fans.html";
    mensaje += `\n━━━━━━━━━━━━━━━━\n`;
    mensaje += `📡 *Consulta el ranking en directo:*\n${URL_FANS}`;

    // 4. ARCHIVADO EN HISTORIAL PERMANENTE (mantenido con mejoras menores)
    const registroHistorico = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        fecha: fecha,
        mvp: nombreMVP,
        mvpIdsJugadores: [...mvpIdsJ],
        mvpIdsEntrenadores: [...mvpIdsE],
        partidos: [...(window.partidosFinalizadosHoy || [])],
        asistentes: (window.jugadoresHoy || []).map(j => ({ id: j.id, nombre: j.nombre, esInvitado: !!j.esInvitado })),
        jugadores: (window.jugadoresHoy || []).length
    };

    if (!db.historicoJornadas) db.historicoJornadas = [];
    db.historicoJornadas.push(registroHistorico);

    // Actualizar ultimoMVP para que el hub muestre el MVP de la jornada recien cerrada
    if (mvpIdsJ.length || mvpIdsE.length) {
        const _partesUMVP = [];
        if (mvpIdsJ.length) _partesUMVP.push("Jugadores: " + mvpIdsJ.map(_gn).join(", "));
        if (mvpIdsE.length) _partesUMVP.push("Entrenadores: " + mvpIdsE.map(_gn).join(", "));
        db.ultimoMVP = _partesUMVP.join(" · ");
    } else {
        db.ultimoMVP = null;
    }


    // 5. LIMPIEZA ABSOLUTA DE LA JORNADA (mantenido)
    db.fechaEvento = null;
    db.jugadoresHoy = [];
    db.partidosAbiertos = [];
    db.partidosRecientes = [];
    db.mvpIdHoy = null;
    db.mvpIdsHoy = [];
    db.mvpIdsJugadores = [];
    db.mvpIdsEntrenadores = [];
    db.votosJugadoresMVP = {};
    db.golpesGanadoresHoy = {};
    // ✅ FIX BUG MVP DOBLE APLICACIÓN: limpiar el registro de puntos MVP aplicados
    // para que la siguiente jornada empiece limpia. Los puntos ya están sumados
    // a puntosTotales del jugador (ranking acumulado), este registro era solo
    // para evitar doble aplicación dentro de la misma jornada.
    db.mvpPuntosAplicados = {};

    window.jugadoresHoy = [];
    window.partidosAbiertos = [];
    window.partidosFinalizadosHoy = [];
    window.mvpIdHoy = null;
    window.mvpIdsHoy = [];
    window.mvpIdsJugadores = [];
    window.mvpIdsEntrenadores = [];
    window.votosJugadoresMVP = {};
    window.golpesGanadoresHoy = {};
    window.logVenganzasTV = [];
    window._mvpPuntosYaAplicadosHoy = false;
    // ✅ Limpiar flag de sesión: el listener volverá a leer jornadaActiva
    // desde db.fechaEvento (que ahora es null), sin protección artificial.
    window._jornadaIniciadaSesion = null;
    window.jornadaActiva = false;
    window.jornadaCerrada = true;

    // 6. PERSISTENCIA
    saveDB();

    // 7. REFRESCAR VISTAS IMPORTANTES
    if (typeof renderRanking === 'function') renderRanking();
    if (typeof renderHistoricoGeneral === 'function') renderHistoricoGeneral();
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
    if (typeof actualizarTablonHub === 'function') actualizarTablonHub();

    // 8. WHATSAPP Y RETORNO AL HUB (mantenido)
    alert("✅ Jornada finalizada con éxito. Se abrirá WhatsApp para compartir el resumen.");
    const urlWa = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(urlWa, '_blank');

    // SCRIPT-C FIX: resetear badge convocatoria al volver al HUB.
    // Sin esta llamada el badge mostraba el número de la jornada cerrada.
    if (typeof actualizarContadorConvocatoriaHub === 'function') actualizarContadorConvocatoriaHub();

    if (typeof volverAlHub === 'function') {
        volverAlHub();
    } else {
        document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
        const inicio = document.getElementById('inicio');
        if (inicio) inicio.classList.add('active');
        const hub = document.getElementById('pantalla-inicio-hub');
        if (hub) hub.style.display = 'flex';
    }
}    

// Añadir en cualquier sitio del archivo:
function verDetalleJornada(id) {
    toggleDetalleHistorial(id);
}


