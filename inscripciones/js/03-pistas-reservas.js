/* ============================================================
   ATP PLATINUM — inscripciones/03-pistas-reservas.js
   Render pistas, select, reservas, añadir/cancelar reserva
   ── Refactor: extraído de inscripciones.html (líneas 472-629)
   ============================================================ */

// PISTAS
// ══════════════════════════════════════════════════════════════════════════

function renderPistas() {
    renderSelectPistas();
    renderReservasConfirmadas();
    actualizarTituloForm();
}

function renderSelectPistas() {
    const sel = document.getElementById('sel-pista');
    if (!sel) return;
    const val = sel.value; // guardar selección actual

    const reservadasNums = new Set(
        pistasReservadas.filter(p => p && p.reservadoPor).map(p => Number(p.numero))
    );

    sel.innerHTML = '<option value="">— Selecciona una pista —</option>';

    const libres   = [];
    const ocupadas = [];
    for (let i = 1; i <= numPistasClub; i++) {
        (reservadasNums.has(i) ? ocupadas : libres).push(i);
    }

    if (libres.length) {
        const g = document.createElement('optgroup');
        g.label = '✅ Disponibles';
        libres.forEach(n => {
            const o = document.createElement('option');
            o.value = n; o.textContent = `Pista ${n}`;
            g.appendChild(o);
        });
        sel.appendChild(g);
    }

    if (ocupadas.length) {
        const g = document.createElement('optgroup');
        g.label = '📌 Ya reservadas (añadir otra hora)';
        ocupadas.forEach(n => {
            const o = document.createElement('option');
            o.value = n; o.textContent = `Pista ${n} — ya reservada`;
            g.appendChild(o);
        });
        sel.appendChild(g);
    }

    // restaurar selección
    if (val) sel.value = val;
}

function renderReservasConfirmadas() {
    const cont = document.getElementById('reservas-confirmadas');
    if (!cont) return;

    const lista = [...pistasReservadas]
        .filter(p => p && p.reservadoPor)
        .sort((a,b) => Number(a.numero) - Number(b.numero));

    if (!lista.length) { cont.innerHTML = ''; return; }

    let html = `<div class="reservas-lista">
        <div class="reservas-lista-header">
            🏟️ ${lista.length} pista${lista.length !== 1 ? 's' : ''} reservada${lista.length !== 1 ? 's' : ''}
        </div>`;

    lista.forEach(p => {
        const ts = p.ts
            ? new Date(p.ts).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})
            : '';
        html += `<div class="reserva-item">
            <div class="ri-num">P${escHtml(String(p.numero))}</div>
            <div class="ri-info">
                <div class="ri-hora">${escHtml(p.hora || '—')}</div>
                <div class="ri-quien">👤 ${escHtml(p.reservadoPor)}${ts ? ' · ' + ts : ''}</div>
            </div>
            <button class="ri-cancel" onclick="cancelarReserva('${escHtml(p.id||'')}')">✕ Cancelar</button>
        </div>`;
    });

    html += '</div>';
    cont.innerHTML = html;
}

function actualizarTituloForm() {
    const n = pistasReservadas.filter(p => p && p.reservadoPor).length;
    const titulo = document.getElementById('form-title');
    const btn    = document.getElementById('btn-añadir');
    if (titulo) titulo.textContent = n > 0
        ? `➕ Añadir otra pista (${n} ya reservada${n !== 1 ? 's' : ''})`
        : '➕ Añadir pista reservada';
    if (btn && !btn.disabled) btn.textContent = n > 0
        ? '✅ Añadir esta pista también'
        : '✅ Añadir esta reserva';
}

function añadirReserva() {
    const numPista = parseInt(document.getElementById('sel-pista').value);
    const horaIni  = (document.getElementById('hora-ini').value  || '').trim();
    const horaFin  = (document.getElementById('hora-fin').value  || '').trim();
    const quien    = (document.getElementById('inp-quien').value || '').trim();

    if (!numPista) {
        mostrarToast('⚠️ Selecciona una pista del club', '');
        document.getElementById('sel-pista').focus(); return;
    }
    if (!quien) {
        mostrarToast('⚠️ Escribe tu nombre', '');
        document.getElementById('inp-quien').focus(); return;
    }

    let franja = 'Hora sin especificar';
    if (horaIni && horaFin) franja = `${horaIni} – ${horaFin}`;
    else if (horaIni)       franja = horaIni;

    // ✅ FIX BUG DUPLICADO RESERVA:
    // Antes nada impedía que dos padres reservasen la misma pista a la misma
    // hora — ambas reservas se guardaban y el árbitro veía un conflicto.
    // Ahora avisamos si la combinación pista+hora ya existe; el padre puede
    // confirmar o cancelar.
    const yaReservada = pistasReservadas.find(p =>
        p && Number(p.numero) === numPista &&
        ((p.horaInicio || '').trim() === horaIni)
    );
    if (yaReservada) {
        const continuar = confirm(
            `⚠️ La pista ${numPista} a las ${horaIni || '(sin hora)'} ya fue reservada por ${yaReservada.reservadoPor}.\n\n` +
            `¿Quieres añadir tu reserva de todas formas? (puede causar conflicto)`
        );
        if (!continuar) return;
    }

    const btn = document.getElementById('btn-añadir');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

    const nueva = {
        id: Date.now().toString(), numero: numPista,
        horaInicio: horaIni, horaFin, hora: franja,
        reservadoPor: quien, ts: Date.now()
    };

    // ✅ FIX BUG RACE CONDITION:
    // Antes hacíamos pistasReservadas.push(nueva) + .set(pistasReservadas), que
    // PISA el array entero. Si otro padre acababa de reservar y nuestro listener
    // aún no se había actualizado, perdíamos su reserva (last-write-wins).
    // Ahora usamos push() de Firebase: añade un hijo único bajo pistasReservadas/
    // sin tocar lo demás. Cada reserva es independiente, no hay race.
    const refReservas = database.ref('torneoPlatinum/pistasReservadas');
    refReservas.push(nueva)
        .then(() => {
            mostrarToast(`✅ Pista ${numPista} añadida — ${franja}`, 'ok');
            document.getElementById('sel-pista').value = '';
            document.getElementById('hora-ini').value  = '';
            document.getElementById('hora-fin').value  = '';
            // inp-quien NO se limpia — el reservador suele ser el mismo
            renderPistas();
            if (btn) { btn.disabled = false; btn.textContent = '✅ Añadir esta pista también'; }
        })
        .catch(err => {
            console.error(err);
            mostrarToast('⚠️ Error al guardar. Comprueba las reglas de Firebase', '');
            pistasReservadas = pistasReservadas.filter(p => p.id !== nueva.id);
            if (btn) { btn.disabled = false; btn.textContent = '✅ Añadir esta reserva'; }
        });
}

function cancelarReserva(idReserva) {
    const p = pistasReservadas.find(x => x.id === idReserva);
    if (!p || !confirm(`¿Cancelar la reserva de Pista ${p.numero} (${p.hora})?`)) return;

    // ✅ FIX BUG RACE CONDITION (cancelar):
    // Antes hacíamos `pistasReservadas.filter(...).set()` que pisaba el array
    // entero — si otro padre acababa de añadir una pista entre nuestro listener
    // local y el set, la perdíamos. Ahora buscamos el nodo concreto en Firebase
    // y lo eliminamos, sin tocar el resto.
    //
    // El nodo puede tener cualquier key (numérica si viene de array antiguo,
    // o '-MockN' si viene de push()). Lo localizamos comparando el id interno.
    database.ref('torneoPlatinum/pistasReservadas').once('value')
        .then(snap => {
            const data = snap.val() || {};
            // Encontrar la key del nodo cuya id coincide con idReserva
            let keyABorrar = null;
            if (Array.isArray(data)) {
                const idx = data.findIndex(x => x && x.id === idReserva);
                if (idx >= 0) keyABorrar = String(idx);
            } else if (data && typeof data === 'object') {
                for (const [k, v] of Object.entries(data)) {
                    if (v && v.id === idReserva) { keyABorrar = k; break; }
                }
            }
            if (!keyABorrar) {
                mostrarToast('⚠️ Reserva ya no existe', '');
                return;
            }
            return database.ref(`torneoPlatinum/pistasReservadas/${keyABorrar}`).remove()
                .then(() => { mostrarToast(`🗑️ Reserva de Pista ${p.numero} cancelada`, ''); renderPistas(); });
        })
        .catch(err => {
            console.error(err);
            mostrarToast('⚠️ No se pudo cancelar — recarga la página', '');
        });
}

// ══════════════════════════════════════════════════════════════════════════
