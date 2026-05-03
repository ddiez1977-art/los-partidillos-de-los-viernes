/* ============================================================
   ATP PLATINUM — 29-backup-restore.js
   Sistema de backup/restore avanzado por secciones
   ── Refactor: extraído de script.js (líneas [(9121, 9509)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// BACKUP / RESTAURAR — SISTEMA AVANZADO
// ==========================================
// Definición de las secciones que se pueden respaldar/restaurar de forma
// granular. La clave es la ruta dentro de `db`. Algunas son virtuales
// (p.ej. 'mvp' agrupa varios campos).
// ==========================================
const BACKUP_SECCIONES = {
    jugadores: {
        label: '👥 Jugadores + Ranking',
        descripcion: 'Cantera completa, puntos, stats, habilidades',
        paths: ['jugadores']
    },
    historicoJornadas: {
        label: '📚 Historial de Jornadas',
        descripcion: 'Todas las jornadas archivadas y sus partidos',
        paths: ['historicoJornadas']
    },
    partidosAbiertos: {
        label: '🎾 Partidos Abiertos (jornada actual)',
        descripcion: 'Partidos en juego ahora mismo',
        paths: ['partidosAbiertos']
    },
    partidosRecientes: {
        label: '🏁 Partidos Finalizados (jornada actual)',
        descripcion: 'Partidos cerrados de hoy',
        paths: ['partidosRecientes']
    },
    jugadoresHoy: {
        label: '✋ Asistencia (jornada actual)',
        descripcion: 'Jugadores presentes hoy',
        paths: ['jugadoresHoy']
    },
    golpesGanadoresHoy: {
        label: '🎯 Golpes Ganadores (hoy)',
        descripcion: 'Aces, winners, smashes, etc. de hoy',
        paths: ['golpesGanadoresHoy']
    },
    mvp: {
        label: '👑 MVPs (jornada actual)',
        descripcion: 'Votos y selección MVP de hoy',
        paths: ['mvpIdHoy', 'mvpIdsHoy', 'mvpIdsJugadores', 'mvpIdsEntrenadores', 'votosJugadoresMVP']
    },
    fechaEvento: {
        label: '📅 Fecha de Jornada',
        descripcion: 'Fecha de la jornada activa',
        paths: ['fechaEvento']
    }
};

// Estado temporal del archivo cargado para restauración
window._backupCargado = null;

// ==========================================
// HELPER: descarga genérica de un objeto JSON
// ==========================================
function _descargarJSON(obj, nombreArchivo) {
    const datosTexto = JSON.stringify(obj, null, 2);
    const blob = new Blob([datosTexto], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
}

// ==========================================
// HELPER: empaquetar backup con metadata
// ==========================================
function _empaquetarBackup(payload, tipo) {
    return {
        _meta: {
            version: 2,
            tipo: tipo,                    // 'completo' | 'parcial:<seccion>'
            fechaExport: new Date().toISOString(),
            origen: 'ATP Master Platinum',
            secciones: Object.keys(payload).filter(k => k !== '_meta')
        },
        ...payload
    };
}

// ==========================================
// EXPORTAR BACKUP COMPLETO (mejorado, con metadata)
// ==========================================
function exportarBackupCompleto() {
    if (!db) {
        return alert("⚠️ No hay base de datos para exportar.");
    }
    const fecha = new Date().toISOString().split('T')[0];
    const payload = _empaquetarBackup({ ...db }, 'completo');
    _descargarJSON(payload, `ATP_Backup_Completo_${fecha}.json`);
    alert("✅ Backup COMPLETO descargado.");
}

// ==========================================
// EXPORTAR BACKUP PARCIAL (una sola sección)
// ==========================================
function exportarBackupParcial(seccionKey) {
    if (!db) return alert("⚠️ No hay base de datos para exportar.");

    const def = BACKUP_SECCIONES[seccionKey];
    if (!def) return alert("⚠️ Sección desconocida: " + seccionKey);

    const payload = {};
    def.paths.forEach(p => {
        if (db[p] !== undefined) payload[p] = db[p];
    });

    if (Object.keys(payload).length === 0) {
        return alert(`⚠️ La sección "${def.label}" está vacía. No hay nada que exportar.`);
    }

    const fecha = new Date().toISOString().split('T')[0];
    const empaquetado = _empaquetarBackup(payload, 'parcial:' + seccionKey);
    _descargarJSON(empaquetado, `ATP_Backup_${seccionKey}_${fecha}.json`);
    alert(`✅ Backup parcial de "${def.label}" descargado.`);
}

// ==========================================
// LECTURA DEL ARCHIVO Y PREVIEW
// ==========================================
function onBackupArchivoSeleccionado(input) {
    const file = input.files[0];
    const status = document.getElementById('backup-restore-status-new');
    const fileName = document.getElementById('backup-file-name');
    const previewZone = document.getElementById('backup-preview-zone');

    if (!file) {
        if (fileName) fileName.textContent = 'Ningún archivo seleccionado';
        if (previewZone) previewZone.style.display = 'none';
        window._backupCargado = null;
        return;
    }

    if (fileName) fileName.textContent = '📄 ' + file.name;
    if (status) { status.textContent = '⏳ Leyendo archivo...'; status.style.color = '#666'; }

    const reader = new FileReader();
    reader.onload = function (e) {
        let datos;
        try { datos = JSON.parse(e.target.result); }
        catch (err) {
            if (status) { status.textContent = '❌ JSON inválido: ' + err.message; status.style.color = '#dc2626'; }
            window._backupCargado = null;
            if (previewZone) previewZone.style.display = 'none';
            return;
        }

        // Validación: debe tener al menos una clave conocida
        const clavesConocidas = ['jugadores', 'historicoJornadas', 'partidosAbiertos',
                                  'partidosRecientes', 'jugadoresHoy', 'golpesGanadoresHoy',
                                  'fechaEvento', 'mvpIdHoy', 'mvpIdsJugadores'];
        const tieneAlgo = clavesConocidas.some(k => datos[k] !== undefined);
        if (!tieneAlgo) {
            if (status) { status.textContent = '❌ El archivo no parece un backup válido del torneo.'; status.style.color = '#dc2626'; }
            window._backupCargado = null;
            if (previewZone) previewZone.style.display = 'none';
            return;
        }

        window._backupCargado = { archivo: file, datos: datos };
        if (status) { status.textContent = '✅ Archivo cargado correctamente.'; status.style.color = '#0d8c6c'; }
        renderBackupPreview(datos);
        if (previewZone) previewZone.style.display = 'block';
    };
    reader.readAsText(file);
}

// ==========================================
// PREVIEW: mostrar resumen + checkboxes granulares
// ==========================================
function renderBackupPreview(datos) {
    const meta = datos._meta || {};
    const resumenEl = document.getElementById('backup-preview-resumen');
    const seccionesEl = document.getElementById('backup-secciones-lista');
    if (!resumenEl || !seccionesEl) return;

    // ── Construir resumen ──
    const lineas = [];
    if (meta.fechaExport) {
        const f = new Date(meta.fechaExport);
        lineas.push(`📅 <b>Generado:</b> ${f.toLocaleString('es-ES')}`);
    }
    if (meta.tipo) {
        lineas.push(`📦 <b>Tipo:</b> ${meta.tipo}`);
    }
    if (Array.isArray(datos.jugadores)) {
        lineas.push(`👥 <b>Jugadores:</b> ${datos.jugadores.length}`);
    }
    if (Array.isArray(datos.historicoJornadas)) {
        const totalP = datos.historicoJornadas.reduce((s, j) => s + (Array.isArray(j.partidos) ? j.partidos.length : 0), 0);
        lineas.push(`📚 <b>Jornadas archivadas:</b> ${datos.historicoJornadas.length} <span style="opacity:0.7;">(${totalP} partidos)</span>`);
    }
    if (Array.isArray(datos.partidosAbiertos)) {
        lineas.push(`🎾 <b>Partidos abiertos:</b> ${datos.partidosAbiertos.length}`);
    }
    if (Array.isArray(datos.partidosRecientes)) {
        lineas.push(`🏁 <b>Partidos finalizados (hoy):</b> ${datos.partidosRecientes.length}`);
    }
    if (datos.fechaEvento) {
        lineas.push(`📅 <b>Fecha jornada:</b> ${datos.fechaEvento}`);
    }
    resumenEl.innerHTML = lineas.length ? lineas.join('<br>') : '<i>Sin metadatos detallados.</i>';

    // ── Construir checkboxes granulares: solo secciones con datos en el backup ──
    const items = [];
    Object.keys(BACKUP_SECCIONES).forEach(key => {
        const def = BACKUP_SECCIONES[key];
        // ¿Tiene al menos un path con datos?
        const tieneDatos = def.paths.some(p => {
            const v = datos[p];
            if (v === undefined || v === null) return false;
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === 'object') return Object.keys(v).length > 0;
            return true;
        });
        if (!tieneDatos) return;

        // Conteo descriptivo
        let meta = '';
        if (key === 'jugadores' && Array.isArray(datos.jugadores)) meta = `${datos.jugadores.length} fichas`;
        else if (key === 'historicoJornadas' && Array.isArray(datos.historicoJornadas)) meta = `${datos.historicoJornadas.length} jornadas`;
        else if (key === 'partidosAbiertos' && Array.isArray(datos.partidosAbiertos)) meta = `${datos.partidosAbiertos.length} partidos`;
        else if (key === 'partidosRecientes' && Array.isArray(datos.partidosRecientes)) meta = `${datos.partidosRecientes.length} partidos`;
        else if (key === 'fechaEvento') meta = datos.fechaEvento || '';
        else if (key === 'golpesGanadoresHoy' && datos.golpesGanadoresHoy) meta = `${Object.keys(datos.golpesGanadoresHoy).length} jugadores`;

        items.push(`
            <label class="backup-seccion-checkbox">
                <input type="checkbox" class="backup-seccion-check" value="${key}" checked>
                <div>
                    <div style="font-weight:800;">${def.label}</div>
                    <div style="font-size:0.7rem;color:#888;font-weight:500;">${def.descripcion}</div>
                </div>
                <span class="seccion-meta">${meta}</span>
            </label>`);
    });
    seccionesEl.innerHTML = items.join('') || '<div style="font-size:0.78rem;color:#888;font-style:italic;">El backup no contiene secciones reconocibles.</div>';
}

// ==========================================
// EJECUTAR RESTAURACIÓN (con PIN + safety backup)
// ==========================================
function ejecutarRestauracionBackup() {
    const status = document.getElementById('backup-restore-status-new');
    const setStatus = (msg, color) => {
        if (status) { status.textContent = msg; status.style.color = color || '#666'; }
    };

    if (!window._backupCargado) {
        return setStatus('⚠️ Primero selecciona un archivo de backup.', '#dc2626');
    }

    const datos = window._backupCargado.datos;
    const modoEl = document.querySelector('input[name="backup-modo"]:checked');
    const modo = modoEl ? modoEl.value : 'completo';

    // 1. Determinar qué se va a restaurar
    let pathsARestaurar = [];
    let descripcionPlan = '';

    if (modo === 'completo') {
        // Reemplazar TODA la BBDD por el contenido del backup (excluyendo _meta)
        descripcionPlan = '💣 REEMPLAZAR BASE DE DATOS COMPLETA';
        pathsARestaurar = Object.keys(datos).filter(k => k !== '_meta');
    } else {
        // Granular: leer checkboxes
        const checks = document.querySelectorAll('.backup-seccion-check:checked');
        if (checks.length === 0) {
            return setStatus('⚠️ Marca al menos una sección a restaurar.', '#dc2626');
        }
        const seccionesElegidas = Array.from(checks).map(c => c.value);
        seccionesElegidas.forEach(key => {
            const def = BACKUP_SECCIONES[key];
            if (def) pathsARestaurar = pathsARestaurar.concat(def.paths);
        });
        // dedupe
        pathsARestaurar = [...new Set(pathsARestaurar)];
        descripcionPlan = `🎯 RESTAURACIÓN GRANULAR — ${seccionesElegidas.length} sección(es):\n   • ` +
            seccionesElegidas.map(k => BACKUP_SECCIONES[k].label).join('\n   • ');
    }

    if (pathsARestaurar.length === 0) {
        return setStatus('⚠️ No hay nada que restaurar.', '#dc2626');
    }

    // 2. Confirmar con resumen
    const confirmMsg =
        `🔄 CONFIRMAR RESTAURACIÓN\n\n` +
        `Archivo: ${window._backupCargado.archivo.name}\n\n` +
        `${descripcionPlan}\n\n` +
        `⚠️ Esta operación sobrescribe datos en la nube.\n` +
        `Antes de aplicar cambios se descargará automáticamente un backup\n` +
        `del estado actual (red de seguridad).\n\n` +
        `¿Continuar?`;
    if (!confirm(confirmMsg)) {
        return setStatus('Cancelado.', '#666');
    }

    // 3. PIN admin (reutiliza hashDjb2 + ADMIN_HASH del index.html)
    const pin = prompt('🔒 Introduce el PIN de admin para confirmar la restauración:');
    if (pin === null) return setStatus('Cancelado.', '#666');

    let hashFn = (typeof hashDjb2 === 'function') ? hashDjb2 : null;
    let adminHash = (typeof ADMIN_HASH !== 'undefined') ? ADMIN_HASH : null;
    if (!hashFn || adminHash === null) {
        return setStatus('❌ Sistema de PIN no disponible.', '#dc2626');
    }
    if (hashFn(pin) !== adminHash) {
        return setStatus('❌ PIN incorrecto.', '#dc2626');
    }

    // 4. Descarga de seguridad del estado actual
    setStatus('⏳ Descargando backup de seguridad del estado actual...', '#666');
    try {
        const fechaSafe = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, 19);
        const safety = _empaquetarBackup({ ...db }, 'safety-pre-restore');
        _descargarJSON(safety, `ATP_SAFETY_pre-restore_${fechaSafe}.json`);
    } catch (e) {
        if (!confirm('⚠️ No se pudo descargar el backup de seguridad. ¿Continuar igualmente?')) {
            return setStatus('Cancelado tras fallo en safety backup.', '#dc2626');
        }
    }

    // 5. Aplicar restauración
    setStatus('⏳ Aplicando restauración en la nube...', '#666');

    if (modo === 'completo') {
        // Reemplazo total: construir un objeto limpio sin _meta
        const nuevoDB = {};
        pathsARestaurar.forEach(p => { nuevoDB[p] = datos[p]; });

        if (typeof database === 'undefined') {
            return setStatus('❌ Firebase no disponible.', '#dc2626');
        }

        // ✅ Bloqueamos el listener de echo durante el set
        if (!window._guardandoDB) window._guardandoDB = 0;
        window._guardandoDB++;

        database.ref('torneoPlatinum').set(nuevoDB)
            .then(() => {
                window._guardandoDB = Math.max(0, window._guardandoDB - 1);
                setStatus('✅ Restauración COMPLETA aplicada. Recargando...', '#0d8c6c');
                alert('✅ Base de datos restaurada con éxito.\n\nLa app se recargará para aplicar los cambios.');
                setTimeout(() => location.reload(), 800);
            })
            .catch(err => {
                window._guardandoDB = Math.max(0, window._guardandoDB - 1);
                console.error('Error en restauración completa:', err);
                setStatus('❌ Error: ' + err.message, '#dc2626');
            });

    } else {
        // Granular: multi-path update
        const updates = {};
        pathsARestaurar.forEach(p => {
            // Si el valor existe en el backup lo escribimos; si no, no tocamos esa rama
            if (datos[p] !== undefined) {
                updates[`torneoPlatinum/${p}`] = datos[p];
            }
        });

        if (Object.keys(updates).length === 0) {
            return setStatus('⚠️ Nada que aplicar (las secciones marcadas no existen en el backup).', '#dc2626');
        }

        if (!window._guardandoDB) window._guardandoDB = 0;
        window._guardandoDB++;

        database.ref().update(updates)
            .then(() => {
                window._guardandoDB = Math.max(0, window._guardandoDB - 1);
                setStatus(`✅ Restauradas ${Object.keys(updates).length} rama(s). Recargando...`, '#0d8c6c');
                alert(`✅ ${Object.keys(updates).length} sección(es) restauradas con éxito.\n\nLa app se recargará para aplicar los cambios.`);
                setTimeout(() => location.reload(), 800);
            })
            .catch(err => {
                window._guardandoDB = Math.max(0, window._guardandoDB - 1);
                console.error('Error en restauración granular:', err);
                setStatus('❌ Error: ' + err.message, '#dc2626');
            });
    }
}

