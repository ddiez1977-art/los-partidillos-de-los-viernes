/* ============================================================
   ATP PLATINUM — 12-golpes-hitos.js
   Golpes ganadores, hitos, panel y navegación desde partido
   ── Refactor: extraído de script.js (líneas [(4334, 4715)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// --- GOLPES Y HITOS ---
// ── GOLPES: nueva UI rápida con buscador ─────────────────────
let _jugadorGolpesSeleccionado = null;


// ──────────────────────────────────────────────────────────────────────
// GOLPES RÁPIDO DESDE PISTA — irAGolpesDesdePartido(partidoId, origen)
//
// Salta al módulo de golpes prefiltrando los jugadores del partido.
// origen: 'jornada' (sección PISTA) o 'control-pistas' (sección CONTROL)
// El módulo muestra solo los jugadores del partido como chips rápidos
// y un botón "← Volver al partido" para regresar al origen.
// ──────────────────────────────────────────────────────────────────────
window._golpesContextoPartido = null; // { partidoId, origen, ids }

function irAGolpesDesdePartido(partidoId, origen) {
    const p = (window.partidosAbiertos || []).find(x => String(x.id) === String(partidoId));
    if (!p) return alert('❌ Partido no encontrado.');

    // Guardar contexto para el botón "Volver"
    window._golpesContextoPartido = {
        partidoId: String(partidoId),
        origen: origen || 'jornada',
        ids: (p.ids || []).map(String),
        nombres: p.nombres || '',
        pista: p.pista
    };

    // Preseleccionar el primer jugador del partido automáticamente
    if (p.ids && p.ids.length > 0) {
        _jugadorGolpesSeleccionado = String(p.ids[0]);
    }

    // Navegar a la sección de golpes
    if (typeof showSection === 'function') {
        showSection('hitos-votos');
    }

    // Renderizar con el contexto del partido (chips filtrados + banner volver)
    renderGolpesGanadores();

    // UX-G1: mini toast confirmando el contexto activo
    if (typeof mostrarToastGlobal === 'function') {
        mostrarToastGlobal(`⚽ PISTA ${p.pista} — toca un jugador para registrar golpes`);
    }

    // Scroll suave: primero al banner, luego al panel del jugador
    setTimeout(() => {
        const banner = document.getElementById('golpes-partido-banner');
        if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
            const panel = document.getElementById('golpes-panel-jugador');
            if (panel && panel.style.display !== 'none') {
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 220);
    }, 100);
}

function volverAlPartidoDesdeGolpes() {
    const ctx = window._golpesContextoPartido;
    window._golpesContextoPartido = null;
    _jugadorGolpesSeleccionado = null;

    if (!ctx) {
        if (typeof showSection === 'function') showSection('jornada');
        return;
    }

    showSection(ctx.origen);

    // UX-G4: refrescar la vista y hacer scroll a la card del partido de vuelta
    setTimeout(() => {
        if (ctx.origen === 'control-pistas' && typeof renderControlPistas === 'function') {
            renderControlPistas();
            // Scroll a la card del partido (buscar por data-pista o text)
            setTimeout(() => {
                const cards = document.querySelectorAll('#control-pistas-container > div');
                cards.forEach(card => {
                    if (card.textContent.includes('PISTA ' + ctx.pista)) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }, 120);
        } else {
            if (typeof renderPistas === 'function') renderPistas();
            // Scroll a la card del partido en la sección jornada
            setTimeout(() => {
                const cont = document.getElementById('partidos-abiertos-container');
                if (cont) cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 120);
        }

        // Toast de confirmación con los golpes registrados
        const _golpesCtx = window.golpesGanadoresHoy || {};
        const _totalPartido = ctx.ids.reduce((sum, id) => {
            const g = _golpesCtx[String(id)] || {};
            return sum + Object.values(g).reduce((s, v) => s + (v || 0), 0);
        }, 0);
        if (typeof mostrarToastGlobal === 'function' && _totalPartido > 0) {
            mostrarToastGlobal(`✅ ${_totalPartido} golpe${_totalPartido !== 1 ? 's' : ''} registrados — Pista ${ctx.pista}`);
        }
    }, 80);
}

function renderGolpesGanadores() {
    const lista = window.jugadoresHoy || [];

    // ── CONTEXTO DE PARTIDO: banner + chips filtrados al partido activo ──────
    const _ctx = window._golpesContextoPartido;

    // Crear o limpiar el banner de contexto
    let bannerDiv = document.getElementById('golpes-partido-banner');
    if (!bannerDiv) {
        bannerDiv = document.createElement('div');
        bannerDiv.id = 'golpes-partido-banner';
        bannerDiv.style.marginBottom = '16px';
        const secHitos = document.getElementById('hitos-votos');
        const titHitos = secHitos && secHitos.querySelector('h2.atp-title');
        if (titHitos) titHitos.insertAdjacentElement('afterend', bannerDiv);
        else if (secHitos) secHitos.prepend(bannerDiv);
    }

    if (_ctx) {
        // Banner con nombre del partido + botón volver
        bannerDiv.innerHTML = `
        <div style="background:linear-gradient(135deg,#001e3c,#002d5c); border-radius:14px;
                    padding:14px 18px; border-left:4px solid #ccff00; box-shadow:0 4px 15px rgba(0,30,60,0.25); margin-bottom:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                    <div style="font-size:0.6rem; color:#C5A059; font-weight:800; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px;">
                        PISTA ${_ctx.pista} — PARTIDO EN CURSO
                    </div>
                    <div style="color:#ccff00; font-weight:900; font-size:0.95rem;">${_ctx.nombres}</div>
                    <div style="color:rgba(255,255,255,0.5); font-size:0.72rem; margin-top:4px;">
                        Toca un nombre para registrar sus golpes
                    </div>
                </div>
                <button onclick="volverAlPartidoDesdeGolpes()"
                    style="background:#ccff00; color:#001e3c; border:none; border-radius:10px;
                           padding:10px 18px; font-weight:900; cursor:pointer; font-size:0.82rem;
                           white-space:nowrap; touch-action:manipulation; flex-shrink:0;">
                    \u2190 Volver al partido
                </button>
            </div>
        </div>`;

        // Chips solo con jugadores del partido
        const sugs = document.getElementById('golpes-sugerencias');
        if (sugs) {
            const jugadosPartido = lista.filter(j => _ctx.ids.includes(String(j.id)));
            sugs.innerHTML = jugadosPartido.map(j => {
                const sel = _jugadorGolpesSeleccionado === String(j.id);
                const golpesJ = window.golpesGanadoresHoy?.[String(j.id)] || {};
                const totalJ  = Object.values(golpesJ).reduce((s, v) => s + (v || 0), 0);
                return `<button onclick="seleccionarJugadorGolpes('${j.id}')"
                    style="padding:10px 18px; border-radius:22px; cursor:pointer; touch-action:manipulation;
                           font-weight:900; font-size:0.88rem; border:2px solid ${sel ? '#ccff00' : '#001e3c'};
                           background:${sel ? '#ccff00' : '#001e3c'}; color:${sel ? '#001e3c' : '#ccff00'};">
                    ${escapeHtml(j.nombre)}${totalJ > 0 ? ` <span style="opacity:0.7;font-size:0.75em;">${totalJ}&#127919;</span>` : ''}
                </button>`;
            }).join('');
        }
        renderPanelJugadorGolpes();
        if (typeof renderSeccionMVP === 'function') renderSeccionMVP();
        return; // En modo partido solo mostramos estos jugadores
    }

    // Sin contexto: limpiar banner
    bannerDiv.innerHTML = '';

    // Chips de jugadores
    const sugs = document.getElementById('golpes-sugerencias');
    if (sugs) {
        // UX-G5: ordenar — (1) jugando ahora, (2) con golpes registrados, (3) el resto
        const _idsJugando = new Set((window.partidosAbiertos || []).flatMap(p => (p.ids || []).map(String)));
        const jugandoAhora = lista.filter(j => _idsJugando.has(String(j.id)));
        const conGolpes    = lista.filter(j => !_idsJugando.has(String(j.id)) && Object.values(window.golpesGanadoresHoy?.[String(j.id)] || {}).some(v => v > 0));
        const sinGolpes    = lista.filter(j => !_idsJugando.has(String(j.id)) && !Object.values(window.golpesGanadoresHoy?.[String(j.id)] || {}).some(v => v > 0));
        sugs.innerHTML = [...jugandoAhora, ...conGolpes, ...sinGolpes].map(j => {
            const _enPistaAhora = _idsJugando.has(String(j.id));
            const total = Object.values(window.golpesGanadoresHoy?.[String(j.id)] || {}).reduce((s, v) => s + (v || 0), 0);
            const sel = _jugadorGolpesSeleccionado === String(j.id);
            // UX-G5c: indicar si el jugador está en pista ahora mismo
            const _pEnPista = _idsJugando.has(String(j.id));
            const _pistaN   = _pEnPista
                ? (window.partidosAbiertos || []).find(p => (p.ids || []).map(String).includes(String(j.id)))?.pista
                : null;
            return `<button onclick="seleccionarJugadorGolpes('${j.id}')"
                style="padding:7px 14px;border-radius:20px;touch-action:manipulation;
                       border:2px solid ${sel ? '#ccff00' : _pEnPista ? 'rgba(204,255,0,0.5)' : total > 0 ? '#001e3c' : '#dee2e6'};
                       background:${sel ? '#ccff00' : _pEnPista ? 'rgba(0,30,60,0.9)' : total > 0 ? '#001e3c' : 'white'};
                       color:${sel ? '#001e3c' : (_pEnPista || total > 0) ? '#ccff00' : '#001e3c'};
                       font-weight:${total > 0 || sel ? '900' : '600'};font-size:0.8rem;cursor:pointer;white-space:nowrap;">
                ${_pEnPista && !sel ? '<span style="font-size:0.6em;opacity:0.7;">🎾P' + (_pistaN || '') + ' </span>' : ''}${escapeHtml(j.nombre)}${total > 0 ? ` <span style="opacity:0.8;">(${total})</span>` : ''}
            </button>`;
        }).join('');
    }

    // Panel jugador seleccionado
    renderPanelJugadorGolpes();

    // Lista compacta
    const container = document.getElementById('lista-hitos-viva');
    if (!container) return;
    if (lista.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;opacity:0.5;">
            <div style="font-size:2.5rem;margin-bottom:8px;">🎾</div>
            <p>No hay jugadores presentes. Pasa lista en "PISTA" primero.</p>
        </div>`;
        return;
    }
    container.innerHTML = lista.map(j => {
        const stats = window.golpesGanadoresHoy?.[String(j.id)] || {};
        const total = Object.values(stats).reduce((s, v) => s + (v || 0), 0);
        const sel = _jugadorGolpesSeleccionado === String(j.id);
        return `
        <div style="background:${sel?'#f0fdf9':'white'};border:${sel?'2px solid #10ac84':'1px solid #e2e8f0'};border-radius:10px;
                    padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer;
                    border-left:4px solid ${total > 0 ? '#001e3c' : '#dee2e6'};"
             onclick="seleccionarJugadorGolpes('${j.id}')">
            <div style="flex:1;font-weight:700;color:#001e3c;font-size:0.9rem;">${escapeHtml(j.nombre)}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;">
                ${CATEGORIAS_GOLPES.filter(c => (stats[c.id] || 0) > 0).map(c =>
                    `<span style="background:${c.color};color:white;padding:2px 8px;border-radius:12px;font-size:0.65rem;font-weight:700;">
                        ${c.label.split(' ')[0]} ${stats[c.id]}
                    </span>`
                ).join('')}
                ${total === 0 ? `<span style="color:#aaa;font-size:0.75rem;font-style:italic;">Sin golpes</span>` : ''}
            </div>
            <div style="font-size:0.75rem;color:#888;background:#f8f9fa;padding:4px 10px;border-radius:8px;font-weight:700;min-width:32px;text-align:center;">
                ${total > 0 ? total : '→'}
            </div>
        </div>`;
    }).join('');
}

function filtrarJugadorGolpes(texto) {
    const lista = window.jugadoresHoy || [];
    const q = texto.trim().toLowerCase();
    const sugs = document.getElementById('golpes-sugerencias');
    if (!q) { renderGolpesGanadores(); return; }
    const coincidencias = lista.filter(j => j.nombre.toLowerCase().includes(q));
    if (coincidencias.length === 1) {
        seleccionarJugadorGolpes(coincidencias[0].id);
    } else if (sugs) {
        sugs.innerHTML = coincidencias.map(j =>
            `<button onclick="seleccionarJugadorGolpes('${j.id}');document.getElementById('golpes-buscador').value=''"
                style="padding:8px 16px;border-radius:20px;border:2px solid #001e3c;background:#001e3c;
                       color:#ccff00;font-weight:900;font-size:0.85rem;cursor:pointer;">${escapeHtml(j.nombre)}</button>`
        ).join('');
    }
}

function seleccionarJugadorGolpes(id) {
    _jugadorGolpesSeleccionado = String(id);
    renderGolpesGanadores();
    const panel = document.getElementById('golpes-panel-jugador');
    if (panel && panel.style.display !== 'none') {
        // UX-G3: en modo partido los chips ya están encima — scroll al panel de golpes
        setTimeout(() => panel.scrollIntoView({ behavior:'smooth', block:'start' }), 40);
    }
}

function limpiarBuscadorGolpes() {
    const inp = document.getElementById('golpes-buscador');
    if (inp) inp.value = '';
    _jugadorGolpesSeleccionado = null;
    // Limpiar contexto de partido si existía (usuario salió manualmente del modo partido)
    window._golpesContextoPartido = null;
    const banner = document.getElementById('golpes-partido-banner');
    if (banner) banner.innerHTML = '';
    renderGolpesGanadores();
}

function renderPanelJugadorGolpes() {
    const panel = document.getElementById('golpes-panel-jugador');
    if (!panel) return;
    const id = _jugadorGolpesSeleccionado;
    if (!id) { panel.style.display = 'none'; return; }
    const j = (window.jugadoresHoy || []).find(x => String(x.id) === id);
    if (!j) { panel.style.display = 'none'; return; }
    const stats = window.golpesGanadoresHoy?.[String(j.id)] || {};
    const total = Object.values(stats).reduce((s, v) => s + (v || 0), 0);
    panel.style.display = 'block';
    panel.innerHTML = `
    <div style="background:linear-gradient(135deg,#001e3c,#002d5c);border-radius:16px;padding:20px;margin-bottom:20px;box-shadow:0 4px 20px rgba(0,30,60,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
                <div style="color:#888;font-size:0.65rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:2px;">Registrando golpes</div>
                <div style="color:#ccff00;font-weight:900;font-size:1.4rem;">${j.nombre}</div>
            </div>
            <div style="text-align:right;">
                <div style="color:#888;font-size:0.65rem;">Total</div>
                <div style="color:#C5A059;font-weight:900;font-size:2.2rem;line-height:1;">${total}</div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            ${CATEGORIAS_GOLPES.map(c => {
                const v = stats[c.id] || 0;
                return `
                <div style="background:rgba(255,255,255,0.06);border-radius:12px;padding:12px 8px;text-align:center;border:1px solid ${v > 0 ? 'rgba(204,255,0,0.3)' : 'rgba(255,255,255,0.08)'};">
                    <div style="font-size:0.7rem;color:#aaa;font-weight:700;margin-bottom:4px;">${c.label}</div>
                    <div style="font-size:2rem;font-weight:900;color:${v > 0 ? '#ccff00' : 'white'};margin-bottom:8px;line-height:1;">${v}</div>
                    <div style="display:flex;gap:5px;">
                        <button onclick="modG('${j.id}','${c.id}',-1)"
                            style="flex:1;padding:10px 0;background:#ee5253;color:white;border:none;border-radius:8px;font-size:1.2rem;font-weight:900;cursor:pointer;touch-action:manipulation;">−</button>
                        <button onclick="modG('${j.id}','${c.id}',1)"
                            style="flex:2;padding:10px 0;background:#10ac84;color:white;border:none;border-radius:8px;font-size:1.2rem;font-weight:900;cursor:pointer;touch-action:manipulation;">+</button>
                    </div>
                </div>`;
            }).join('')}
        </div>
        ${window._golpesContextoPartido ? (() => {
            // UX-G6: en modo partido, botón para pasar al siguiente jugador del partido
            const _ctx6 = window._golpesContextoPartido;
            const _idxActual = _ctx6.ids.indexOf(_jugadorGolpesSeleccionado);
            const _idxSig    = (_idxActual + 1) % _ctx6.ids.length;
            const _idSig     = _ctx6.ids[_idxSig];
            const _jSig      = (window.jugadoresHoy || []).find(x => String(x.id) === String(_idSig));
            return _jSig ? `
            <button onclick="seleccionarJugadorGolpes('${_idSig}')"
                style="width:100%;margin-top:10px;padding:11px;background:rgba(204,255,0,0.1);color:#ccff00;
                       border:1px solid rgba(204,255,0,0.3);border-radius:10px;cursor:pointer;
                       font-size:0.85rem;font-weight:700;touch-action:manipulation;">
                → Siguiente: ${escapeHtml(_jSig.nombre)}
            </button>` : '';
        })() : ''}
        <button onclick="${window._golpesContextoPartido ? 'renderGolpesGanadores()' : '_jugadorGolpesSeleccionado=null;renderGolpesGanadores()'}"
            style="width:100%;margin-top:8px;padding:11px;background:rgba(255,255,255,0.08);color:#aaa;
                   border:1px solid rgba(255,255,255,0.15);border-radius:10px;cursor:pointer;font-size:0.85rem;font-weight:700;touch-action:manipulation;">
            ${window._golpesContextoPartido ? '← Jugadores del partido' : '✓ Hecho — ver todos los jugadores'}
        </button>
    </div>`;
}


function modG(id, golpe, valor) {
    // ✅ FIX: String() para evitar claves numéricas vs string en el mismo objeto.
    // modG puede recibir id como number (desde código) o string (desde onclick HTML).
    // Sin normalizar, {123: {...}} y {'123': {...}} son claves distintas, y los golpes
    // del día aparecen invisibles en verFicha si los tipos no coinciden.
    const idStr = String(id);
    if (!window.golpesGanadoresHoy[idStr]) {
        window.golpesGanadoresHoy[idStr] = { ace:0, dejada:0, volea:0, winner:0, smash:0, passing:0 };
    }
    window.golpesGanadoresHoy[idStr][golpe] = Math.max(0, (window.golpesGanadoresHoy[idStr][golpe] || 0) + valor);
    // ✅ Evolución de habilidades técnicas (igual que antes con votarGolpe)
    if (valor > 0 && typeof evolucionarHabilidades === 'function') {
        evolucionarHabilidades(id, golpe);
    }
    if (typeof saveDB === 'function') saveDB();
    renderPanelJugadorGolpes();

    // UX-G2: en modo partido, actualizar solo los chips sin re-renderizar el banner completo
    if (window._golpesContextoPartido) {
        // Actualizar el contador del chip del jugador actual
        const _ctx2 = window._golpesContextoPartido;
        const sugs2 = document.getElementById('golpes-sugerencias');
        if (sugs2) {
            const jugadosPartido2 = (window.jugadoresHoy || []).filter(j => _ctx2.ids.includes(String(j.id)));
            sugs2.innerHTML = jugadosPartido2.map(j => {
                const sel = _jugadorGolpesSeleccionado === String(j.id);
                const golpesJ2 = window.golpesGanadoresHoy?.[String(j.id)] || {};
                const totalJ2  = Object.values(golpesJ2).reduce((s, v) => s + (v || 0), 0);
                return `<button onclick="seleccionarJugadorGolpes('${j.id}')"
                    style="padding:10px 18px; border-radius:22px; cursor:pointer; touch-action:manipulation;
                           font-weight:900; font-size:0.88rem; border:2px solid ${sel ? '#ccff00' : '#001e3c'};
                           background:${sel ? '#ccff00' : '#001e3c'}; color:${sel ? '#001e3c' : '#ccff00'};">
                    ${escapeHtml(j.nombre)}${totalJ2 > 0 ? ` <span style="opacity:0.7;font-size:0.75em;">${totalJ2}&#127919;</span>` : ''}
                </button>`;
            }).join('');
        }
    } else {
        const sugs = document.getElementById('golpes-sugerencias');
        if (sugs) renderGolpesGanadores();
    }
    if (typeof sincronizarTV === 'function') sincronizarTV();
    if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
    if (typeof actualizarTicker === 'function') actualizarTicker();
}

