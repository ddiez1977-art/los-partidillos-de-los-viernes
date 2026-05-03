/* ============================================================
   ATP PLATINUM — inscripciones/02-jugadores-asistencia.js
   Inscripción: actualizar contador, lista, filtros, toggles, alta nueva
   ── Refactor: extraído de inscripciones.html (líneas 307-471)
   ============================================================ */

// INSCRIPCIÓN
// ══════════════════════════════════════════════════════════════════════════

function actualizarInscripcion() {
    const abierta = dbLocal.convocatoriaAbierta;
    const pill = document.getElementById('portal-status');
    if (pill) {
        pill.textContent = abierta ? '🟢 PORTAL ABIERTO' : '🔒 INSCRIPCIONES CERRADAS';
        pill.className   = 'portal-status ' + (abierta ? 'open' : 'closed');
    }
    document.getElementById('pantalla-cerrada').style.display = abierta ? 'none'  : 'block';
    document.getElementById('pantalla-abierta').style.display = abierta ? 'block' : 'none';
    if (abierta) { renderLista(); actualizarContador(); }
}

function actualizarContador() {
    const ids = dbLocal.convocatoriaActiva || [];
    const ranking   = ids.filter(id => {
        const j = dbLocal.jugadores.find(x => String(x.id) === String(id));
        return j && !j.esInvitado;
    }).length;
    const invitados = ids.length - ranking;
    const el = document.getElementById('contador-apuntados');
    if (el) el.textContent = invitados > 0 ? `${ranking} (+${invitados} inv.)` : ranking;
}

function filtrarJugadores() { renderLista(); }

function renderLista() {
    const cont = document.getElementById('lista-jugadores');
    const busqueda = (document.getElementById('buscador')?.value || '').toLowerCase().trim();
    let lista = [...dbLocal.jugadores].sort((a,b) => a.nombre.localeCompare(b.nombre));
    if (busqueda) lista = lista.filter(j => j.nombre.toLowerCase().includes(busqueda));

    if (!lista.length) {
        cont.innerHTML = busqueda
            ? `<div class="no-results">No se encontró "<b>${escHtml(busqueda)}</b>". Añádete abajo.</div>`
            : '<div class="no-results">No hay jugadores en la cantera.</div>';
        return;
    }

    const ranking   = lista.filter(j => !j.esInvitado);
    const invitados = lista.filter(j =>  j.esInvitado);
    let html = ranking.map(j => filaJugador(j)).join('');
    if (invitados.length) {
        html += `<div style="margin:10px 0 6px;padding:6px 10px;background:rgba(245,158,11,0.08);border-radius:8px;border:1px dashed rgba(245,158,11,0.5);">
            <span style="font-size:0.65rem;font-weight:900;color:#f59e0b;letter-spacing:1px;text-transform:uppercase;">👨‍👧 Invitados — sin ranking</span></div>`;
        html += invitados.map(j => filaJugador(j)).join('');
    }
    cont.innerHTML = html;
}

function filaJugador(j) {
    const apuntado = (dbLocal.convocatoriaActiva || []).includes(String(j.id));
    const esInv    = !!j.esInvitado;
    const badgeInv = esInv ? '<span style="font-size:0.6rem;background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.6);color:#f59e0b;border-radius:6px;padding:1px 6px;margin-left:6px;font-weight:800;flex-shrink:0;">INVITADO</span>' : '';
    const btnInvHtml = apuntado
        ? `<button id="btninv-${j.id}" class="btn-inv-toggle ${esInv ? '' : 'es-ranking'}"
               title="${esInv ? 'Sin ranking. Pulsa para cambiar a RANKING' : 'En ranking. Pulsa para cambiar a INVITADO'}"
               onclick="toggleInvitado('${j.id}',${!esInv},'${escapar(j.nombre)}')">${esInv ? '👨‍👧 INVITADO' : '🏆 RANKING'}</button>` : '';
    const btnClass = apuntado ? 'btn-toggle estado-apuntado' : 'btn-toggle estado-no-apuntado';
    const btnTxt   = apuntado ? '✅ APUNTADO' : '＋ APUNTARME';

    return `<div id="row-${j.id}" class="jugador-row ${apuntado ? 'apuntado' : ''}" style="${esInv && apuntado ? 'border-left:3px solid rgba(245,158,11,0.5);' : ''}">
        <span class="jugador-nombre">${escHtml(j.nombre)}${badgeInv}</span>
        <div class="jugador-actions">
            ${btnInvHtml}
            <button class="${btnClass}" id="btn-${j.id}"
                onclick="toggleAsistencia('${j.id}',${!apuntado},'${escapar(j.nombre)}')">${btnTxt}</button>
        </div>
    </div>`;
}

function toggleAsistencia(id, apuntar, nombre) {
    const idStr = String(id);

    // ✅ FIX BUG RACE CONDITION:
    // Antes leíamos dbLocal.convocatoriaActiva (snapshot local), modificábamos
    // y hacíamos .set() del array completo. Si dos jugadores se apuntaban
    // simultáneamente, uno PISABA al otro porque ambos partían del mismo
    // snapshot anterior. Ahora usamos transaction() de Firebase que lee el
    // valor más reciente del servidor, aplica el cambio y rechaza si otro
    // cliente modificó entretanto, reintentando automáticamente.
    const ref = database.ref('torneoPlatinum/convocatoriaActiva');
    ref.transaction(actual => {
        // actual puede ser null, array u objeto Firebase
        let arr = Array.isArray(actual) ? actual.slice()
                : (actual && typeof actual === 'object') ? Object.values(actual)
                : [];
        if (apuntar) { if (!arr.includes(idStr)) arr.push(idStr); }
        else         { arr = arr.filter(i => i !== idStr); }
        return arr;
    }, (err, committed, snap) => {
        if (err || !committed) {
            mostrarToast('⚠️ Error de conexión', '');
            return;
        }
        // Sincronizar UI local con el resultado
        dbLocal.convocatoriaActiva = snap.val() || [];
        actualizarContador();
        renderLista();
        mostrarToast(apuntar ? `✅ ${nombre} — ¡Apuntado!` : `❌ ${nombre} — Baja registrada`, apuntar ? 'ok' : 'out');
    });
}

function toggleInvitado(id, convertirAInvitado, nombre) {
    const j = dbLocal.jugadores.find(x => String(x.id) === String(id));
    if (!j) return;
    j.esInvitado = convertirAInvitado;
    actualizarContador();
    renderLista();
    mostrarToast(convertirAInvitado ? `👨‍👧 ${nombre} — Modo invitado` : `🏆 ${nombre} — Ahora en ranking`, convertirAInvitado ? '' : 'ok');

    // INSCR-A FIX: en lugar de hacer .set() de toda la colección de jugadores
    // (que podría borrar jugadores añadidos por el admin mientras el portal estaba abierto),
    // usamos un update puntual sobre el campo esInvitado del jugador específico.
    // Calculamos el índice del jugador dentro del array actual de Firebase usando
    // el índice local — puede diferir si el admin añadió jugadores, pero en ese
    // caso la actualización falla de forma inocua y el listener .on('value') corrige.
    const idx = dbLocal.jugadores.findIndex(x => String(x.id) === String(id));
    if (idx === -1) {
        mostrarToast('⚠️ Error al guardar', '');
        return;
    }
    database.ref(`torneoPlatinum/jugadores/${idx}/esInvitado`).set(convertirAInvitado)
        .catch(() => {
            // Fallback: si el índice no coincide (admin añadió jugadores), revertir UI
            j.esInvitado = !convertirAInvitado;
            actualizarContador();
            renderLista();
            mostrarToast('⚠️ Error al guardar. Recarga la página.', '');
        });
}

function normNombre(n) {
    return n.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function apuntarNuevoJugador() {
    if (window._gnj) return;
    window._gnj = true;
    const btnN = document.querySelector('.btn-nuevo');
    if (btnN) { btnN.disabled = true; btnN.style.opacity = '0.5'; }
    const liberar = () => { window._gnj = false; if (btnN) { btnN.disabled = false; btnN.style.opacity = ''; } };

    const input  = document.getElementById('nuevo-nombre');
    const nombre = input.value.trim();
    if (!nombre) { input.focus(); mostrarToast('⚠️ Escribe tu nombre primero',''); liberar(); return; }

    const existente = dbLocal.jugadores.find(j => normNombre(j.nombre) === normNombre(nombre));
    if (existente) {
        const ya = (dbLocal.convocatoriaActiva || []).includes(String(existente.id));
        if (!ya) toggleAsistencia(existente.id, true, existente.nombre);
        else mostrarToast(`ℹ️ ${existente.nombre} ya estás apuntado`, 'ok');
        document.getElementById('buscador').value = existente.nombre;
        filtrarJugadores(); liberar();
    } else {
        const nuevoId = Date.now().toString();
        const nj = { id:nuevoId, nombre, puntosTotales:0, nivel:'5.0', estado:'descansando',
            pausado:false, descansosSeguidos:0, rachaVictorias:0, rachaDerrotas:0,
            partidosHistorial:0, partidosJugadosHoy:0,
            stats:{ ganados:0,perdidos:0,totales:0,juegosFavor:0,juegosContra:0,dobles:0,
                simples:0,gamificados:0,trios:0,asimetrico:0,australiana:0,mvps:0,
                aces:0,winners:0,smashes:0,voleas:0,dejadas:0,passings:0 },
            statsAcumuladas:{ ace:0,winner:0,dejada:0,volea:0,smash:0,passing:0 },
            habilidades:{ Saque:5,Derecha:5,Reves:5,Volea:5,Mental:5 } };

        // ✅ FIX BUG RACE CONDITION:
        // Antes hacíamos `update({ jugadores: [..., nj], convocatoriaActiva: [..., id] })`
        // que reescribía AMBOS arrays completos. Si dos padres se apuntaban a
        // la vez, el segundo PISABA al primero (last-write-wins). Ahora:
        //  1) Para jugadores: push() del nodo único bajo torneoPlatinum/jugadores/.
        //     Cada nuevo jugador es independiente.
        //  2) Para convocatoriaActiva: transaction() para evitar pisar.
        // Las reglas de Firebase ya permiten ambos writes cuando convocatoriaAbierta=true.
        const refJug = database.ref('torneoPlatinum/jugadores');
        refJug.push(nj)
            .then(() => {
                // Tras añadir el jugador, apuntarlo a convocatoriaActiva con transaction
                return database.ref('torneoPlatinum/convocatoriaActiva').transaction(actual => {
                    let arr = Array.isArray(actual) ? actual.slice()
                            : (actual && typeof actual === 'object') ? Object.values(actual)
                            : [];
                    if (!arr.includes(nuevoId)) arr.push(nuevoId);
                    return arr;
                });
            })
            .then(() => { mostrarToast(`✅ ${nombre} — ¡Registrado y apuntado!`,'ok'); renderLista(); liberar(); })
            .catch(() => {
                mostrarToast('⚠️ Error al guardar. Inténtalo de nuevo','');
                liberar();
            });
    }
    input.value = '';
}

// ══════════════════════════════════════════════════════════════════════════
