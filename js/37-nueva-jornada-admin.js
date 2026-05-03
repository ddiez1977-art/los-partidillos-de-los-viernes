/* ============================================================
   ATP PLATINUM — 37-nueva-jornada-admin.js
   Nueva Jornada Admin completa (módulo nj*)
   ── Refactor: extraído de script.js (líneas [(11859, 12624)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ==========================================
// NUEVA JORNADA COMPLETA — MODO ADMIN
// Permite crear una jornada con sus partidos
// directamente en el historial sin pasar
// por la sesión activa.
// ==========================================

// Estado en memoria de los partidos de la nueva jornada
window._njPartidos = [];
window._njContador = 0;

// ── INICIALIZACIÓN (llamada desde switchAdminTab) ──────────

function njInicializar() {
    // BUG-A FIX: si hay partidos en progreso no confirmados, preguntar antes de resetear
    const enProgreso = (window._njPartidos || []).filter(p => !p.confirmado).length;
    if (enProgreso > 0) {
        const ok = confirm(
            `⚠️ Tienes ${enProgreso} partido(s) sin confirmar en esta jornada.

` +
            `¿Quieres descartar el trabajo y empezar de nuevo?

` +
            `Pulsa ACEPTAR para resetear, CANCELAR para conservar lo que tienes.`
        );
        if (!ok) return; // conservar estado actual
    }

    window._njPartidos = [];
    window._njContador = 0;

    // Fecha por defecto = hoy (solo si no tiene valor)
    const fi = document.getElementById('nj-fecha');
    if (fi && !fi.value) fi.value = new Date().toISOString().split('T')[0];

    // Rellenar selectores de MVP
    njRenderMvpDual([], []);

    // Vaciar lista de partidos
    njRenderListaPartidos();
}

// ── RENDER MVP DUAL ────────────────────────────────────────

function njRenderMvpDual(preselJ, preselE) {
    const jugadores = (db.jugadores || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    const empty = '<p style="color:#aaa;font-size:0.78rem;text-align:center;">Sin jugadores registrados</p>';

    const cJ = document.getElementById('nj-mvpJ-container');
    const cE = document.getElementById('nj-mvpE-container');
    if (!cJ || !cE) return;

    if (!jugadores.length) { cJ.innerHTML = empty; cE.innerHTML = empty; return; }

    const selJ = new Set((preselJ || []).map(String));
    const selE = new Set((preselE || []).map(String));

    const fila = (j, cls, accent, sel) => {
        const badgeInv = j.esInvitado
            ? '<span style="font-size:0.6rem;background:rgba(245,158,11,0.2);border:1px solid #f59e0b;color:#92400e;border-radius:4px;padding:0 4px;margin-left:4px;">INVITADO</span>'
            : '';
        const nota = j.esInvitado ? '<span style="font-size:0.7rem;color:#aaa;margin-left:4px;">— no suma puntos</span>' : '';
        return `<label style="display:flex;align-items:center;gap:8px;padding:4px;cursor:pointer;border-radius:6px;${j.esInvitado ? 'opacity:0.7;' : ''}"
                onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <input type="checkbox" value="${j.id}" class="${cls}"
                   ${sel.has(String(j.id)) ? 'checked' : ''} style="width:15px;height:15px;cursor:pointer;accent-color:${accent};">
            <span style="font-size:0.85rem;font-weight:600;">${j.nombre}</span>${badgeInv}${nota}
        </label>`;
    };

    cJ.innerHTML = jugadores.map(j => fila(j, 'nj-mvpJ-check', '#10ac84', selJ)).join('');
    cE.innerHTML = jugadores.map(j => fila(j, 'nj-mvpE-check', '#C5A059', selE)).join('');
}

// ── AÑADIR PARTIDO (crea formulario inline) ────────────────

function njAnadirPartido() {
    const idx = window._njContador++;
    const partido = {
        idx,
        tipo: 'dobles',
        idsA: [], idsB: [], idsG: [],
        jA: 0, jB: 0,
        marcador: '0-0',
        mvpIdsJ: [], mvpIdsE: [],
        nombres: '',
        confirmado: false
    };
    window._njPartidos.push(partido);
    njRenderListaPartidos();

    // Scroll al nuevo formulario
    setTimeout(() => {
        const el = document.getElementById(`nj-form-${idx}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
}

// ── RENDER LISTA DE PARTIDOS ────────────────────────────────

function njRenderListaPartidos() {
    const lista = document.getElementById('nj-partidos-lista');
    if (!lista) return;

    if (!window._njPartidos.length) {
        lista.innerHTML = `<div id="nj-partidos-empty" style="text-align:center;padding:24px;background:#f8f9fa;
            border:2px dashed #dee2e6;border-radius:10px;color:#aaa;font-size:0.82rem;font-style:italic;">
            Aún no hay partidos. Pulsa "+ Añadir Partido" para comenzar.
        </div>`;
        return;
    }

    lista.innerHTML = window._njPartidos.map(p => njHtmlPartido(p)).join('');
}

// ── HTML DE UN PARTIDO (formulario o tarjeta confirmada) ───

function njHtmlPartido(p) {
    if (p.confirmado) {
        // Tarjeta compacta de partido confirmado
        const colores = { dobles:'#001e3c', individual:'#0056b3', trios:'#C5A059',
                          gamificado:'#00d4ff', asimetrico:'#ff6b35', equipos3:'#a78bfa' };
        const color = colores[p.tipo] || '#001e3c';
        // BUG-B FIX: defensive access — mvpIdsJ/E pueden ser undefined en partidos legacy
        const _mvpJ = p.mvpIdsJ || [];
        const _mvpE = p.mvpIdsE || [];
        const mvpTexto = [
            _mvpJ.length && `🗳️ ${_mvpJ.map(id => db.jugadores.find(j=>String(j.id)===String(id))?.nombre || '?').join(', ')}`,
            _mvpE.length && `👨‍🏫 ${_mvpE.map(id => db.jugadores.find(j=>String(j.id)===String(id))?.nombre || '?').join(', ')}`
        ].filter(Boolean).join(' · ');

        return `<div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 12px;border-radius:10px;background:#f8f9fa;
                    border:1px solid #e9ecef;border-left:4px solid ${color};">
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.72rem;color:#888;font-weight:800;text-transform:uppercase;margin-bottom:2px;">
                    ${njLabelModo(p.tipo)}${mvpTexto ? ' · 👑 ' + mvpTexto : ''}
                </div>
                <div style="font-weight:800;color:#001e3c;font-size:0.88rem;overflow:hidden;
                            text-overflow:ellipsis;white-space:nowrap;">${p.nombres}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:10px;">
                <span style="font-family:monospace;font-weight:900;background:white;
                             padding:3px 9px;border-radius:6px;border:1px solid #ddd;">${p.marcador}</span>
                <button onclick="njEditarPartido(${p.idx})"
                        style="background:#fff3cd;border:1px solid #ffc107;color:#856404;
                               border-radius:6px;padding:4px 8px;font-size:0.78rem;cursor:pointer;font-weight:700;">✏️</button>
                <button onclick="njEliminarPartido(${p.idx})"
                        style="background:#f8d7da;border:1px solid #f5c6cb;color:#721c24;
                               border-radius:6px;padding:4px 8px;font-size:0.78rem;cursor:pointer;font-weight:700;">🗑️</button>
            </div>
        </div>`;
    }

    // ── Formulario de partido sin confirmar ──────────────────
    const opts = '<option value="">-- Jugador --</option>' +
        (db.jugadores || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(j => `<option value="${j.id}">${escapeHtml(j.nombre)}${j.esInvitado ? ' 👨‍👧' : ''}</option>`).join('');

    const sEl = (eq, pos, lbl) =>
        `<div style="margin-bottom:4px;">
            <div style="font-size:0.65rem;font-weight:800;color:#555;margin-bottom:2px;">${lbl}</div>
            <select class="atp-input nj-jugador-${p.idx}" data-equipo="${eq}" style="font-size:0.82rem;">${opts}</select>
        </div>`;

    const modalidad = p.tipo;

    let jugHtml = '', resHtml = '';

    if (modalidad === 'dobles') {
        jugHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="border-left:3px solid #001e3c;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#001e3c;margin-bottom:4px;">EQUIPO A</div>
                ${sEl('A',1,'Jugador 1')}${sEl('A',2,'Jugador 2')}
            </div>
            <div style="border-left:3px solid #C5A059;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#C5A059;margin-bottom:4px;">EQUIPO B</div>
                ${sEl('B',1,'Jugador 3')}${sEl('B',2,'Jugador 4')}
            </div></div>`;
        resHtml = `<div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
            <label style="font-size:0.72rem;font-weight:700;color:#555;">Resultado:</label>
            <input id="nj-sA-${p.idx}" type="number" min="0" class="atp-input" value="0"
                   style="width:55px;text-align:center;font-size:1rem;font-weight:900;">
            <span style="font-weight:900;color:#aaa;">—</span>
            <input id="nj-sB-${p.idx}" type="number" min="0" class="atp-input" value="0"
                   style="width:55px;text-align:center;font-size:1rem;font-weight:900;">
        </div>`;
    } else if (modalidad === 'individual') {
        jugHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="border-left:3px solid #001e3c;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#001e3c;margin-bottom:4px;">JUGADOR A</div>
                ${sEl('A',1,'Jugador A')}
            </div>
            <div style="border-left:3px solid #C5A059;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#C5A059;margin-bottom:4px;">JUGADOR B</div>
                ${sEl('B',1,'Jugador B')}
            </div></div>`;
        resHtml = `<div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
            <label style="font-size:0.72rem;font-weight:700;color:#555;">Resultado:</label>
            <input id="nj-sA-${p.idx}" type="number" min="0" class="atp-input" value="0"
                   style="width:55px;text-align:center;font-size:1rem;font-weight:900;">
            <span style="font-weight:900;color:#aaa;">—</span>
            <input id="nj-sB-${p.idx}" type="number" min="0" class="atp-input" value="0"
                   style="width:55px;text-align:center;font-size:1rem;font-weight:900;">
        </div>`;
    } else if (modalidad === 'trios') {
        jugHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="border-left:3px solid #001e3c;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#001e3c;margin-bottom:4px;">EQUIPO A</div>
                ${sEl('A',1,'Jugador 1')}${sEl('A',2,'Jugador 2')}${sEl('A',3,'Jugador 3')}
            </div>
            <div style="border-left:3px solid #C5A059;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#C5A059;margin-bottom:4px;">EQUIPO B</div>
                ${sEl('B',1,'Jugador 4')}${sEl('B',2,'Jugador 5')}${sEl('B',3,'Jugador 6')}
            </div></div>`;
        resHtml = `<div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
            <label style="font-size:0.72rem;font-weight:700;color:#555;">Resultado:</label>
            <input id="nj-sA-${p.idx}" type="number" min="0" class="atp-input" value="0"
                   style="width:55px;text-align:center;font-size:1rem;font-weight:900;">
            <span style="font-weight:900;color:#aaa;">—</span>
            <input id="nj-sB-${p.idx}" type="number" min="0" class="atp-input" value="0"
                   style="width:55px;text-align:center;font-size:1rem;font-weight:900;">
        </div>`;
    } else if (modalidad === 'asimetrico') {
        jugHtml = `<div style="margin-bottom:6px;">
            <div style="font-size:0.65rem;font-weight:900;color:#001e3c;margin-bottom:4px;">EQUIPO A (añade los que quieras)</div>
            ${sEl('A',1,'Jugador A1')}${sEl('A',2,'Jugador A2 (opcional)')}${sEl('A',3,'Jugador A3 (opcional)')}
            <div style="font-size:0.65rem;font-weight:900;color:#C5A059;margin-bottom:4px;margin-top:8px;">EQUIPO B</div>
            ${sEl('B',1,'Jugador B1')}${sEl('B',2,'Jugador B2 (opcional)')}${sEl('B',3,'Jugador B3 (opcional)')}
        </div>`;
        resHtml = `<div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
            <label style="font-size:0.72rem;font-weight:700;color:#555;">Resultado:</label>
            <input id="nj-sA-${p.idx}" type="number" min="0" class="atp-input" value="0"
                   style="width:55px;text-align:center;font-size:1rem;font-weight:900;">
            <span style="font-weight:900;color:#aaa;">—</span>
            <input id="nj-sB-${p.idx}" type="number" min="0" class="atp-input" value="0"
                   style="width:55px;text-align:center;font-size:1rem;font-weight:900;">
        </div>`;
    } else if (modalidad === 'equipos3') {
        jugHtml = `<div style="margin-bottom:6px;">
            <div style="font-size:0.65rem;font-weight:900;color:#7c3aed;margin-bottom:4px;">🔄 AUSTRALIANA (3 jugadores)</div>
            ${[1,2,3].map(i=>`<div style="margin-bottom:6px;">
                ${sEl('A',i,'Jugador '+i)}
                <div style="display:flex;gap:6px;margin-top:3px;">
                    <div>
                        <div style="font-size:0.6rem;color:#777;margin-bottom:1px;">Juegos totales</div>
                        <input id="nj-aus-pts-${p.idx}-${i}" type="number" min="0" class="atp-input" value="0"
                               style="width:65px;font-size:0.88rem;font-weight:900;text-align:center;">
                    </div>
                    <div>
                        <div style="font-size:0.6rem;color:#777;margin-bottom:1px;">Juegos de solo</div>
                        <input id="nj-aus-solo-${p.idx}-${i}" type="number" min="0" class="atp-input" value="0"
                               style="width:65px;font-size:0.88rem;font-weight:900;text-align:center;">
                    </div>
                </div>
            </div>`).join('')}
        </div>`;
        resHtml = '';
    } else if (modalidad === 'gamificado') {
        jugHtml = `<div>
            <div style="font-size:0.65rem;font-weight:900;color:#00b4cc;margin-bottom:4px;">🎮 GAMIFICADO (hasta 6 jugadores)</div>
            ${[1,2,3,4,5,6].map(i=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
                <select class="atp-input nj-jugador-${p.idx}" data-equipo="G" id="nj-gam-j-${p.idx}-${i}"
                        style="flex:2;font-size:0.82rem;">${opts}</select>
                <input id="nj-gam-pts-${p.idx}-${i}" type="number" min="0" class="atp-input" value="0"
                       style="width:60px;text-align:center;font-size:0.88rem;font-weight:900;" placeholder="pts">
            </div>`).join('')}
        </div>`;
        resHtml = `<div style="margin-top:6px;">
            <label style="font-size:0.72rem;font-weight:700;color:#555;">Resultado texto (opcional):</label>
            <input id="nj-gam-res-${p.idx}" type="text" class="atp-input" placeholder="Ej: ÉXITO 🏆"
                   style="font-size:0.82rem;margin-top:3px;">
        </div>`;
    }

    // MVPs del partido
    const mvpJugHtml = (db.jugadores || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(j => `<label style="display:flex;align-items:center;gap:6px;padding:2px 4px;cursor:pointer;font-size:0.82rem;">
            <input type="checkbox" value="${j.id}" class="nj-mvpJ-part-${p.idx}" style="cursor:pointer;accent-color:#10ac84;">
            ${j.nombre}
        </label>`).join('');

    const mvpEntHtml = (db.jugadores || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(j => `<label style="display:flex;align-items:center;gap:6px;padding:2px 4px;cursor:pointer;font-size:0.82rem;">
            <input type="checkbox" value="${j.id}" class="nj-mvpE-part-${p.idx}" style="cursor:pointer;accent-color:#C5A059;">
            ${j.nombre}
        </label>`).join('');

    return `<div id="nj-form-${p.idx}" style="background:#fff;border:1px solid #dee2e6;border-radius:12px;
                padding:14px;position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:0.72rem;font-weight:900;color:#0056b3;letter-spacing:1px;text-transform:uppercase;">
                🎾 Partido ${p.idx + 1}
            </span>
            <button onclick="njEliminarPartido(${p.idx})"
                    style="background:none;border:none;color:#dc3545;font-size:1rem;cursor:pointer;padding:0 4px;">✕</button>
        </div>

        <!-- Modalidad -->
        <div style="margin-bottom:8px;">
            <label style="font-size:0.72rem;font-weight:700;color:#555;display:block;margin-bottom:3px;">🎾 Modalidad</label>
            <select class="atp-input" style="font-size:0.82rem;"
                    onchange="njCambiarModalidad(${p.idx}, this.value)">
                ${['dobles','individual','trios','asimetrico','equipos3','gamificado'].map(m =>
                    `<option value="${m}" ${modalidad === m ? 'selected' : ''}>${njLabelModo(m)}</option>`
                ).join('')}
            </select>
        </div>

        <!-- Jugadores -->
        <div id="nj-jug-${p.idx}" style="margin-bottom:8px;">${jugHtml}</div>

        <!-- Resultado -->
        <div id="nj-res-${p.idx}" style="margin-bottom:8px;">${resHtml}</div>

        <!-- MVP del partido -->
        <details style="margin-bottom:8px;">
            <summary style="font-size:0.72rem;font-weight:700;color:#555;cursor:pointer;padding:4px 0;">
                👑 MVP de este partido (opcional)
            </summary>
            <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:6px;padding:8px;">
                    <div style="font-size:0.62rem;font-weight:900;color:#065f46;margin-bottom:4px;">🗳️ JUGADORES (+3pts)</div>
                    <div style="max-height:80px;overflow-y:auto;">${mvpJugHtml}</div>
                </div>
                <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px;">
                    <div style="font-size:0.62rem;font-weight:900;color:#92400e;margin-bottom:4px;">👨‍🏫 ENTRN. (+2pts)</div>
                    <div style="max-height:80px;overflow-y:auto;">${mvpEntHtml}</div>
                </div>
            </div>
        </details>

        <!-- Confirmar -->
        <button onclick="njConfirmarPartido(${p.idx})"
                style="width:100%;padding:10px;background:#0056b3;color:white;border:none;border-radius:8px;
                       font-weight:900;font-size:0.88rem;cursor:pointer;letter-spacing:0.5px;">
            ✅ Confirmar Partido
        </button>
        <div id="nj-form-fb-${p.idx}" style="display:none;margin-top:6px;padding:7px;border-radius:6px;
             font-size:0.78rem;font-weight:700;text-align:center;"></div>
    </div>`;
}

// ── CAMBIAR MODALIDAD (re-render solo el formulario) ────────

function njCambiarModalidad(idx, nuevoTipo) {
    const p = window._njPartidos.find(x => x.idx === idx);
    if (!p) return;
    p.tipo = nuevoTipo;
    // Re-renderizar solo el partido en cuestión
    const cont = document.getElementById(`nj-form-${idx}`);
    if (cont) {
        const tmp = document.createElement('div');
        tmp.innerHTML = njHtmlPartido(p);
        cont.replaceWith(tmp.firstElementChild);
    }
}

// ── CONFIRMAR PARTIDO ──────────────────────────────────────

function njConfirmarPartido(idx) {
    const p = window._njPartidos.find(x => x.idx === idx);
    if (!p) return;

    const modalidad = p.tipo;
    const gN = id => db.jugadores.find(j => String(j.id) === String(id))?.nombre || '???';
    const fb = id => {
        const el = document.getElementById(`nj-form-fb-${idx}`);
        if (!el) return;
        el.textContent = id;
        el.style.display = 'block';
        el.style.background = '#f8d7da';
        el.style.color = '#721c24';
        el.style.border = '1px solid #f5c6cb';
    };

    let idsA = [], idsB = [], idsG = [];
    // BUG1 FIX: filtrar value="" en la recogida, no después,
    // para que los selects opcionales vacíos nunca entren en los arrays.
    document.querySelectorAll(`.nj-jugador-${idx}`).forEach(sel => {
        if (!sel.value) return;          // ignora placeholders
        const eq = sel.dataset.equipo;
        if (eq === 'A') idsA.push(String(sel.value));
        else if (eq === 'B') idsB.push(String(sel.value));
        else if (eq === 'G') idsG.push(String(sel.value));
    });

    // Validaciones — gamificado e individual/dobles/tríos/asimétrico se validan aquí.
    // equipos3 (australiana) se valida DESPUÉS de leer los selects reales (más abajo).
    if (modalidad === 'gamificado') {
        idsG = [...new Set(idsG)];
        if (!idsG.length) { fb('⚠️ Selecciona al menos un participante.'); return; }
    } else if (modalidad !== 'equipos3') {
        // ✅ BUG 2 FIX: la rama equipos3 usaba idsA recogido por el selector genérico
        // (.nj-jugador-N data-equipo="A"), que para australiana devuelve los mismos selects
        // que luego se leen de nuevo en el bloque de puntosAustraliana. El resultado era que
        // idsA tenía los jugadores antes de que puntosAustraliana los reorganizase, y la
        // validación idsA.length < 3 se ejecutaba sobre ese array intermedio.
        // Solución: mover la validación de equipos3 al final del bloque de lectura de puntos.
        idsA = [...new Set(idsA)]; idsB = [...new Set(idsB)];
        if (!idsA.length || !idsB.length) { fb('⚠️ Faltan jugadores en uno de los equipos.'); return; }
        const todos = [...idsA, ...idsB];
        if (new Set(todos).size !== todos.length) { fb('⚠️ Un jugador está en los dos equipos.'); return; }
    }

    // Leer puntuación
    let jA = 0, jB = 0, marcador = '0-0';
    let puntosGamificados = {}, puntosAustraliana = {}, juegosSoloAustraliana = {};

    if (modalidad === 'gamificado') {
        for (let i = 1; i <= 6; i++) {
            const sel = document.getElementById(`nj-gam-j-${idx}-${i}`);
            const pts = parseInt(document.getElementById(`nj-gam-pts-${idx}-${i}`)?.value) || 0;
            if (sel?.value) puntosGamificados[sel.value] = pts;
        }
        idsG = Object.keys(puntosGamificados);
        marcador = document.getElementById(`nj-gam-res-${idx}`)?.value || 'ÉXITO 🏆';
    } else if (modalidad === 'equipos3') {
        const sels = document.querySelectorAll(`.nj-jugador-${idx}[data-equipo="A"]`);
        sels.forEach((sel, i) => {
            if (!sel.value) return;
            const n = i + 1;
            const pts = parseInt(document.getElementById(`nj-aus-pts-${idx}-${n}`)?.value) || 0;
            const solo = parseInt(document.getElementById(`nj-aus-solo-${idx}-${n}`)?.value) || 0;
            puntosAustraliana[sel.value] = pts;
            juegosSoloAustraliana[sel.value] = solo;
        });
        idsA = Object.keys(puntosAustraliana);
        // ✅ BUG 2 FIX (continuación): validación australiana aquí, con idsA ya correcto
        if (idsA.length < 3) { fb('⚠️ La Australiana requiere exactamente 3 jugadores seleccionados.'); return; }
        if (new Set(idsA).size !== idsA.length) { fb('⚠️ No puedes repetir el mismo jugador.'); return; }
        idsB = [];
        const haySolo = Object.values(juegosSoloAustraliana).some(v => v > 0);
        marcador = Object.entries(puntosAustraliana).sort((a, b) => b[1] - a[1])
            .map(([id, pts]) => {
                const s = juegosSoloAustraliana[id] || 0;
                return haySolo ? `${gN(id)}:${pts}(solo:${s})` : `${gN(id)}:${pts}`;
            }).join(' · ');
    } else {
        jA = parseInt(document.getElementById(`nj-sA-${idx}`)?.value) || 0;
        jB = parseInt(document.getElementById(`nj-sB-${idx}`)?.value) || 0;
        marcador = `${jA}-${jB}`;
    }

    // Leer MVPs del partido
    const mvpIdsJ = Array.from(document.querySelectorAll(`.nj-mvpJ-part-${idx}:checked`)).map(cb => cb.value);
    const mvpIdsE = Array.from(document.querySelectorAll(`.nj-mvpE-part-${idx}:checked`)).map(cb => cb.value);
    const mvpIds = [...new Set([...mvpIdsJ, ...mvpIdsE])];

    // Construir nombres
    const allIds = modalidad === 'gamificado' ? idsG : modalidad === 'equipos3' ? [...idsA] : [...idsA, ...idsB];
    let nombres = '';
    if (modalidad === 'dobles')         nombres = `${gN(idsA[0])}/${gN(idsA[1])} vs ${gN(idsB[0])}/${gN(idsB[1])}`;
    else if (modalidad === 'individual') nombres = `${gN(idsA[0])} vs ${gN(idsB[0])}`;
    else if (modalidad === 'trios')     nombres = `${idsA.map(gN).join('+')} vs ${idsB.map(gN).join('+')}`;
    else if (modalidad === 'asimetrico') nombres = `⚡ ${idsA.map(gN).join('+')} vs ${idsB.map(gN).join('+')} [${idsA.length}v${idsB.length}]`;
    else if (modalidad === 'equipos3')  nombres = `🔄 Australiana: ${allIds.map(gN).join(' · ')}`;
    else nombres = `🎮 Gamificado (${idsG.length} jugadores)`;

    // Guardar en el partido
    Object.assign(p, {
        idsA, idsB, idsG, allIds, jA, jB, marcador, nombres,
        mvpIdsJ, mvpIdsE, mvpIds,
        puntosGamificados, puntosAustraliana, juegosSoloAustraliana,
        confirmado: true
    });

    // Re-render: reemplazar el formulario por la tarjeta confirmada.
    // Si el elemento no se encuentra (tab oculto), hacer render completo como fallback.
    const cont = document.getElementById(`nj-form-${p.idx}`);
    if (cont && cont.parentNode) {
        const tmp = document.createElement('div');
        tmp.innerHTML = njHtmlPartido(p);
        const newEl = tmp.firstElementChild;
        if (newEl) cont.replaceWith(newEl);
        else njRenderListaPartidos(); // fallback si innerHTML vacío
    } else {
        njRenderListaPartidos(); // fallback si el nodo no está en el DOM
    }
}

// ── EDITAR PARTIDO (des-confirmar) ─────────────────────────

function njEditarPartido(idx) {
    const p = window._njPartidos.find(x => x.idx === idx);
    if (!p) return;
    p.confirmado = false;
    // BUG3 FIX: siempre re-render completo — más seguro que buscar el nodo
    njRenderListaPartidos();
    // Scroll al formulario reabierto
    setTimeout(() => {
        const el = document.getElementById(`nj-form-${idx}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
}

// ── ELIMINAR PARTIDO ────────────────────────────────────────

function njEliminarPartido(idx) {
    if (!confirm('¿Eliminar este partido?')) return;
    window._njPartidos = window._njPartidos.filter(x => x.idx !== idx);
    njRenderListaPartidos();
}

// ── ARCHIVAR JORNADA ────────────────────────────────────────

function njArchivarJornada() {
    // ✅ FIX BUG IDEMPOTENCIA: guard contra doble click.
    // Sin esto, si el admin pulsaba "📤 ARCHIVAR JORNADA" 2 veces seguidas
    // (red lenta, nervios), cada click aplicaba aplicarPuntosPartido() para
    // todos los partidos antes de que terminase el set() asíncrono del primero.
    // Resultado: ranking con puntos duplicados (+6 en lugar de +3 por victoria)
    // y dos registros idénticos en historicoJornadas. Bloqueamos por 2s.
    if (window._njArchivandoEnCurso) {
        console.warn('Doble click ignorado: njArchivarJornada en curso');
        return;
    }
    window._njArchivandoEnCurso = true;
    setTimeout(() => { window._njArchivandoEnCurso = false; }, 2000);

    const fecha = document.getElementById('nj-fecha')?.value;
    if (!fecha) { alert('⚠️ Selecciona una fecha para la jornada.'); return; }

    // Verificar que todos los partidos están confirmados
    const sinConfirmar = window._njPartidos.filter(p => !p.confirmado);
    if (sinConfirmar.length) {
        alert(`⚠️ Hay ${sinConfirmar.length} partido(s) sin confirmar.\nRevisa y confirma cada partido antes de archivar.`);
        const el = document.getElementById(`nj-form-${sinConfirmar[0].idx}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    // Leer MVPs de jornada
    const mvpIdsJ = Array.from(document.querySelectorAll('#nj-mvpJ-container .nj-mvpJ-check:checked')).map(cb => cb.value);
    const mvpIdsE = Array.from(document.querySelectorAll('#nj-mvpE-container .nj-mvpE-check:checked')).map(cb => cb.value);
    const mvpIds  = [...new Set([...mvpIdsJ, ...mvpIdsE])];
    const gN = id => db.jugadores.find(j => String(j.id) === String(id))?.nombre || '?';

    const hayPartidos = window._njPartidos.length > 0;
    const hayMVP = mvpIdsJ.length > 0 || mvpIdsE.length > 0;

    // BUG4 FIX: bloquear si no hay absolutamente nada que registrar
    if (!hayPartidos && !hayMVP) {
        alert('⚠️ La jornada está vacía: añade al menos un partido o un MVP antes de archivar.');
        return;
    }

    // Confirmación con resumen
    const mvpTexto = [
        mvpIdsJ.length && `🗳️ ${mvpIdsJ.map(gN).join(', ')}`,
        mvpIdsE.length && `👨‍🏫 ${mvpIdsE.map(gN).join(', ')}`
    ].filter(Boolean).join(' · ');

    let confirmMsg = `📅 ¿Archivar jornada del ${fecha}?\n`;
    confirmMsg += `🎾 ${window._njPartidos.length} partido(s)\n`;
    if (mvpTexto) confirmMsg += `👑 MVPs: ${mvpTexto}\n`;
    if (!hayPartidos) confirmMsg += `\n⚠️ Esta jornada no tiene partidos registrados.\n`;
    if (!hayMVP)      confirmMsg += `⚠️ Sin MVP asignado.\n`;

    if (!confirm(confirmMsg)) return;

    // ── Validación defensiva: todos los partidos confirmados tienen jugadores
    const sinJugadores = window._njPartidos.filter(p => !p.allIds || !p.allIds.length);
    if (sinJugadores.length) {
        alert(`⚠️ Error interno: ${sinJugadores.length} partido(s) no tienen jugadores asignados.
Edítalos y vuelve a confirmarlos.`);
        return;
    }

    // ── Construir partidos archivados ────────────────────────
    const _tsBase = Date.now();
    const partidosArchivados = window._njPartidos.map((p, _pi) => {
        // Calcular tamanoEquipoA para todos los modos competitivos:
        // es el numero de jugadores del equipo A, necesario para que
        // _calcularPtosJugadorEnPartido distinga correctamente A de B.
        let tamanoEquipoA = null;
        if (p.tipo !== 'gamificado' && p.tipo !== 'equipos3') {
            tamanoEquipoA = (p.idsA || []).length || null;
        }
        return {
            id: 'nj-' + (_tsBase + _pi) + '-' + p.idx,
            tipo: p.tipo,
            gamified: p.tipo === 'gamificado',
            fecha,
            pista: p.pista || 'ADM',
            nombres: p.nombres,
            ids: p.allIds || [],
            juegosA: p.jA || 0,
            juegosB: p.jB || 0,
            marcador: p.marcador,
            tamanoEquipoA,
            puntosGamificados: p.tipo === 'gamificado' ? p.puntosGamificados : {},
            puntosAustraliana: p.tipo === 'equipos3'  ? p.puntosAustraliana  : undefined,
            juegosSoloAustraliana: p.tipo === 'equipos3' ? p.juegosSoloAustraliana : undefined,
            golpes: {},
            mvpIds: p.mvpIds || [],
            mvpIdsJugadores:    [...(p.mvpIdsJ || [])],
            mvpIdsEntrenadores: [...(p.mvpIdsE || [])],
            mvpId: null,
            esAdmin: true,
            fin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    });

    // ── Aplicar puntos de partidos al ranking ────────────────
    // Usamos los datos originales guardados en _njPartidos para tener idsA/idsB/idsG
    // correctos (strings normalizados). El partido archivado (pa) ya tiene pa.ids
    // correcto para que aplicarPuntosPartido funcione con Australiana.
    window._njPartidos.forEach((orig, i) => {
        const pa = partidosArchivados[i];
        if (!pa) return;

        // Normalizar IDs a string (igual que guardarPartidoAdmin)
        const idsA = (orig.idsA || []).map(String);
        const idsB = (orig.idsB || []).map(String);
        const idsG = (orig.idsG || []).map(String);

        // Asegurar que pa.ids también está normalizado
        pa.ids = (pa.ids || []).map(String);
        if (pa.puntosAustraliana) {
            const normalized = {};
            Object.entries(pa.puntosAustraliana).forEach(([k,v]) => { normalized[String(k)] = v; });
            pa.puntosAustraliana = normalized;
        }
        if (pa.juegosSoloAustraliana) {
            const normalized = {};
            Object.entries(pa.juegosSoloAustraliana).forEach(([k,v]) => { normalized[String(k)] = v; });
            pa.juegosSoloAustraliana = normalized;
        }
        if (pa.puntosGamificados) {
            const normalized = {};
            Object.entries(pa.puntosGamificados).forEach(([k,v]) => { normalized[String(k)] = v; });
            pa.puntosGamificados = normalized;
        }

        if (typeof aplicarPuntosPartido === 'function') {
            aplicarPuntosPartido(pa, idsA, idsB, idsG, false);
        }

        // MVPs del partido — filtrar invitados igual que asignarMVPEntrenadores live
        if (typeof aplicarMvps === 'function') {
            const _mvpJFilt = pa.mvpIdsJugadores.filter(id => {
                const jug = db.jugadores.find(j => String(j.id) === String(id));
                return jug && !jug.esInvitado;
            });
            const _mvpEFilt = pa.mvpIdsEntrenadores.filter(id => {
                const jug = db.jugadores.find(j => String(j.id) === String(id));
                return jug && !jug.esInvitado && !pa.mvpIdsJugadores.includes(id);
            });
            aplicarMvps(_mvpJFilt, 3);
            _mvpEFilt.forEach(id => aplicarMvps([id], 2));
        }
    });

    // ── Aplicar MVPs de jornada ──────────────────────────────
    // ASIMETRÍA-4 FIX: filtrar invitados igual que asignarMVPEntrenadores en live.
    // Los invitados participan pero no acumulan puntos de ranking/MVP.
    if (typeof aplicarMvps === 'function') {
        const _noInvJ = mvpIdsJ.filter(id => {
            const jug = db.jugadores.find(j => String(j.id) === String(id));
            return jug && !jug.esInvitado;
        });
        const _noInvE = mvpIdsE.filter(id => {
            const jug = db.jugadores.find(j => String(j.id) === String(id));
            return jug && !jug.esInvitado && !mvpIdsJ.includes(id);
        });
        aplicarMvps(_noInvJ, 3);
        _noInvE.forEach(id => aplicarMvps([id], 2));
    }

    // ── Calcular asistentes únicos ───────────────────────────
    const idsUnicos = [...new Set(partidosArchivados.flatMap(p => p.ids || []))];
    const asistentes = idsUnicos.map(id => {
        const j = db.jugadores.find(x => String(x.id) === String(id));
        return j ? { id: j.id, nombre: j.nombre, esInvitado: !!j.esInvitado } : null;
    }).filter(Boolean);

    // ── Crear registro histórico ─────────────────────────────
    // BUG6 FIX: usar _tsBase con offset grande para no colisionar con IDs de partidos
    const mvpNombres = mvpIds.map(gN).join(', ') || '---';
    const registroHistorico = {
        id: _tsBase + 9000 + Math.floor(Math.random() * 999),
        fecha,
        mvp: mvpNombres,
        mvpIds,
        mvpId: null,
        mvpIdsJugadores:    [...mvpIdsJ],
        mvpIdsEntrenadores: [...mvpIdsE],
        votosJugadoresMVP:  {},
        partidos: partidosArchivados,
        jugadores: idsUnicos.length,
        asistentes,
        esAdmin: true
    };

    if (!db.historicoJornadas) db.historicoJornadas = [];
    db.historicoJornadas.push(registroHistorico);

    // ── Persistir y refrescar ────────────────────────────────
    const fb = document.getElementById('nj-feedback');
    if (fb) {
        fb.textContent = `⏳ Guardando jornada del ${fecha} en la nube...`;
        fb.style.display = 'block';
        fb.style.background = '#fff3cd';
        fb.style.color = '#856404';
        fb.style.border = '1px solid #ffc107';
    }

    // ✅ FIX CRÍTICO RACE CONDITION NJ:
    // saveDB() podía ser sobreescrito por el listener de Firebase si _guardandoDB
    // bajaba a 0 antes de que el .set() propagara. Además, saveDB() sobreescribe
    // db.jugadoresHoy/partidosAbiertos desde window.* lo que puede introducir
    // estados incorrectos en el objeto que se envía.
    //
    // Solución: snapshot profundo de db EN ESTE MOMENTO (ya incluye el push del
    // historico y los puntos aplicados), elevamos _guardandoDB para bloquear el
    // listener durante todo el vuelo del .set(), y revertimos el push si falla.
    if (!window._guardandoDB) window._guardandoDB = 0;
    window._guardandoDB++;
    const _dbSnapshot = JSON.parse(JSON.stringify(db));

    database.ref('torneoPlatinum').set(_dbSnapshot)
        .then(() => {
            window._guardandoDB = Math.max(0, window._guardandoDB - 1);
            // ✅ Grace period: bloquear el listener 3s tras el guardado para que
            // Firebase propague completamente antes de que el listener pueda sobrescribir.
            window._njGuardadoReciente = Date.now();
            setTimeout(() => { window._njGuardadoReciente = null; }, 3500);
            console.log(`✅ Jornada admin del ${fecha} confirmada en Firebase.`);

            if (typeof renderHistoricoGeneral === 'function') renderHistoricoGeneral();
            if (typeof renderRanking === 'function') renderRanking();
            if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
            if (typeof renderAnalisisAvanzado === 'function') renderAnalisisAvanzado();
            if (typeof actualizarTablonHub === 'function') actualizarTablonHub();
            if (typeof sincronizarTV === 'function') sincronizarTV();

            if (fb) {
                fb.textContent = `✅ Jornada del ${fecha} archivada con ${partidosArchivados.length} partido(s).${mvpTexto ? ' 👑 ' + mvpTexto : ''} ☁️ Guardada en la nube.`;
                fb.style.background = '#d4edda';
                fb.style.color = '#155724';
                fb.style.border = '1px solid #c3e6cb';
                setTimeout(() => { fb.style.display = 'none'; }, 7000);
            }

            window._njPartidos = [];
            window._njContador = 0;
            njRenderListaPartidos();
            njRenderMvpDual([], []);
            const fechaEl = document.getElementById('nj-fecha');
            if (fechaEl) fechaEl.value = '';
        })
        .catch(err => {
            window._guardandoDB = Math.max(0, window._guardandoDB - 1);
            console.error('❌ Error guardando jornada admin en Firebase:', err);
            // Revertir el push del histórico para no dejar estado inconsistente en memoria
            db.historicoJornadas = db.historicoJornadas.filter(j => j.id !== registroHistorico.id);
            if (fb) {
                fb.textContent = `⚠️ Error de conexión. La jornada NO se guardó en la nube. Inténtalo de nuevo.`;
                fb.style.background = '#f8d7da';
                fb.style.color = '#721c24';
                fb.style.border = '1px solid #f5c6cb';
            }
        });
}

// ── HELPER: label de modo ────────────────────────────────

function njLabelModo(tipo) {
    return {
        'dobles':     '🎾 Dobles (2v2)',
        'individual': '🤺 Individual (1v1)',
        'trios':      '🔱 Tríos (3v3)',
        'asimetrico': '⚡ Asimétrico (equipos libres)',
        'equipos3':   '🔄 Australiana (3 jugadores)',
        'gamificado': '🎮 Gamificado'
    }[tipo] || tipo;
}
