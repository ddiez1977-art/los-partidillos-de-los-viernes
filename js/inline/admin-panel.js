// ═══════════════════════════════════════════════════════════
// MÓDULO ADMINISTRADOR — REGISTRO HISTÓRICO MANUAL
// ═══════════════════════════════════════════════════════════

// PIN (hash djb2, mismo sistema que resetAppTotal)
const ADMIN_HASH = 2117957204; // PIN: 182400
let adminDesbloqueado = false;
let admPartidosSesion = []; // partidos registrados en esta sesión admin
let admGolpesTemporal = {}; // {idJugador: {ace,winner,dejada,volea,smash,passing}}

function hashDjb2(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) + str.charCodeAt(i);
        h = h & h;
    }
    return h;
}

function verificarPinAdmin() {
    const pin = document.getElementById('admin-pin-input').value;
    const err = document.getElementById('admin-pin-error');
    if (hashDjb2(pin) === ADMIN_HASH) {
        adminDesbloqueado = true;
        document.getElementById('admin-pin-screen').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        inicializarAdminPanel();
    } else {
        err.style.display = 'block';
        document.getElementById('admin-pin-input').value = '';
        document.getElementById('admin-pin-input').focus();
        setTimeout(() => err.style.display = 'none', 3000);
    }
}


// ═══════════════════════════════════════════════════════════
// HELPERS MVP — compatibilidad hacia atrás (mvpId string → mvpIds array)
// ═══════════════════════════════════════════════════════════

function getMvpIds(obj) {
    if (!obj) return [];
    // FIX-D: leer primero las fuentes duales (mvpIdsJugadores/Entrenadores),
    // que es el formato de todos los partidos admin/NJ modernos.
    // Fallback a mvpIds (legacy) y mvpId (legacy singular).
    const idsJ = Array.isArray(obj.mvpIdsJugadores) ? obj.mvpIdsJugadores.map(String) : [];
    const idsE = Array.isArray(obj.mvpIdsEntrenadores) ? obj.mvpIdsEntrenadores.map(String) : [];
    if (idsJ.length || idsE.length) return [...new Set([...idsJ, ...idsE])];
    if (Array.isArray(obj.mvpIds)) return obj.mvpIds.map(String);
    if (obj.mvpId) return [String(obj.mvpId)];
    return [];
}

// ── Aplicar/revertir MVPs diferenciando fuente ────────────
// Jugadores → +3pts | Entrenadores → +2pts | Legacy mvpIds → +3pts
function aplicarMvpsDual(obj) {
    const idsJ = Array.isArray(obj.mvpIdsJugadores)    ? obj.mvpIdsJugadores.map(String)    : [];
    const idsE = Array.isArray(obj.mvpIdsEntrenadores) ? obj.mvpIdsEntrenadores.map(String) : [];
    const soloLegacy = idsJ.length === 0 && idsE.length === 0;
    if (soloLegacy) {
        aplicarMvps(getMvpIds(obj), 3);
    } else {
        // Solo aplicar a los que no se solapan (evitar doble suma si alguien está en ambas)
        aplicarMvps(idsJ, 3);
        idsE.filter(id => !idsJ.includes(id)).forEach(id => aplicarMvps([id], 2));
    }
}

function revertirMvpsDual(obj) {
    const idsJ = Array.isArray(obj.mvpIdsJugadores)    ? obj.mvpIdsJugadores.map(String)    : [];
    const idsE = Array.isArray(obj.mvpIdsEntrenadores) ? obj.mvpIdsEntrenadores.map(String) : [];
    const soloLegacy = idsJ.length === 0 && idsE.length === 0;
    if (soloLegacy) {
        revertirMvps(getMvpIds(obj), 3);
    } else {
        revertirMvps(idsJ, 3);
        idsE.filter(id => !idsJ.includes(id)).forEach(id => revertirMvps([id], 2));
    }
}

function renderMvpCheckboxes(containerId, preselectedIds, accentColor) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const jugadores = (db.jugadores||[]).slice().sort((a,b)=>a.nombre.localeCompare(b.nombre));
    if (!jugadores.length) { cont.innerHTML='<p style="color:#aaa;font-size:0.78rem;text-align:center;">Sin jugadores</p>'; return; }
    const sel = new Set((preselectedIds||[]).map(String));
    const accent = accentColor || '#0056b3';
    cont.innerHTML = jugadores.map(j=>`
        <label style="display:flex;align-items:center;gap:8px;padding:5px 4px;cursor:pointer;border-radius:6px;"
               onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">
            <input type="checkbox" value="${j.id}" class="adm-mvp-check"
                   ${sel.has(String(j.id))?'checked':''} style="width:16px;height:16px;cursor:pointer;accent-color:${accent};">
            <span style="font-size:0.88rem;font-weight:600;">${escapeHtml(j.nombre)}</span>
        </label>`).join('');
}

// ✅ Rellena los dos bloques MVP (jugadores + entrenadores) del formulario "Cerrar Jornada Manual"
// Usa IDs de clase distintos para poder leerlos por separado al guardar.
function renderJornadaMvpDual(preselJ, preselE) {
    const jugadores = (db.jugadores||[]).slice().sort((a,b)=>a.nombre.localeCompare(b.nombre));
    const empty = '<p style="color:#aaa;font-size:0.78rem;text-align:center;">Sin jugadores</p>';
    if (!jugadores.length) {
        const cJ = document.getElementById('adm-jornada-mvpJ-container');
        const cE = document.getElementById('adm-jornada-mvp-container');
        if (cJ) cJ.innerHTML = empty;
        if (cE) cE.innerHTML = empty;
        return;
    }
    const selJ = new Set((preselJ||[]).map(String));
    const selE = new Set((preselE||[]).map(String));
    const makeRow = (j, cls, accent, sel) =>
        `<label style="display:flex;align-items:center;gap:8px;padding:4px;cursor:pointer;border-radius:6px;"
               onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <input type="checkbox" value="${j.id}" class="${cls}"
                   ${sel.has(String(j.id))?'checked':''} style="width:15px;height:15px;cursor:pointer;accent-color:${accent};">
            <span style="font-size:0.85rem;font-weight:600;">${escapeHtml(j.nombre)}</span>
        </label>`;
    const cJ = document.getElementById('adm-jornada-mvpJ-container');
    const cE = document.getElementById('adm-jornada-mvp-container');
    if (cJ) cJ.innerHTML = jugadores.map(j => makeRow(j, 'adm-jornada-mvpJ-check', '#10ac84', selJ)).join('');
    if (cE) cE.innerHTML = jugadores.map(j => makeRow(j, 'adm-jornada-mvpE-check', '#C5A059', selE)).join('');
}

function leerMvpIds(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .adm-mvp-check:checked`)).map(cb=>cb.value);
}

function aplicarMvps(mvpIds, ptsOverride) {
    // ptsOverride: si se pasa, usa ese valor en lugar del default (+3)
    const pts = (ptsOverride !== undefined) ? ptsOverride : 3;
    (mvpIds||[]).forEach(id=>{
        const j=db.jugadores.find(x=>String(x.id)===String(id));
        if (!j) return;
        if (j.esInvitado) return;
        j.puntosTotales=(j.puntosTotales||0)+pts;
        if (!j.stats) j.stats={};
        // stats.mvps SOLO para MVP jugadores (+3); stats.mvpsEntrenador SOLO para MVP entrenadores (+2)
        if (pts === 3) j.stats.mvps=(j.stats.mvps||0)+1;
        // ✅ FIX RANKING ICONO MVP-E: contador separado para entrenadores
        if (pts === 2) j.stats.mvpsEntrenador=(j.stats.mvpsEntrenador||0)+1;
        db.ultimoMVP=j.nombre;
    });
}

function revertirMvps(mvpIds, ptsOverride) {
    const pts = (ptsOverride !== undefined) ? ptsOverride : 3;
    (mvpIds||[]).forEach(id=>{
        const j=db.jugadores.find(x=>String(x.id)===String(id));
        if (!j) return;
        if (j.esInvitado) return;
        j.puntosTotales=Math.max(0,(j.puntosTotales||0)-pts);
        if (j.stats && pts === 3) j.stats.mvps=Math.max(0,(j.stats.mvps||0)-1);
        // ✅ FIX RANKING ICONO MVP-E: revertir contador entrenador
        if (j.stats && pts === 2) j.stats.mvpsEntrenador=Math.max(0,(j.stats.mvpsEntrenador||0)-1);
    });
}

// ── TABS INTERNOS ──────────────────────────────────────────
function switchAdminTab(tabId, btn) {
    document.querySelectorAll('.admin-tab-content').forEach(t=>t.style.display='none');
    document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById('admin-tab-'+tabId).style.display='block';
    btn.classList.add('active');
    if (tabId==='admin-historial')        renderAdmListaRegistrados();
    if (tabId==='admin-historial-global') renderAdmHistorialGlobal();
    if (tabId==='jornada-manual') {
        renderJornadaMvpDual([], []);
        renderAdmPartidosParaJornada();
    }
    if (tabId==='nueva-jornada' && typeof njInicializar === 'function') njInicializar();
}

// ── INICIALIZAR PANEL ──────────────────────────────────────
function inicializarAdminPanel() {
    const hoy=new Date().toISOString().split('T')[0];
    const fi=document.getElementById('adm-fecha');
    const fj=document.getElementById('adm-jornada-fecha');
    if (fi&&!fi.value) fi.value=hoy;
    if (fj&&!fj.value) fj.value=hoy;
    actualizarFormAdmin();
    renderJornadaMvpDual([], []);
}

// ── CONSTRUIR FORMULARIO SEGÚN MODALIDAD ──────────────────
function actualizarFormAdmin() {
    if (!adminDesbloqueado) return;
    const modalidad=document.getElementById('adm-modalidad')?.value||'dobles';
    admGolpesTemporal={};
    const jugadores=(db.jugadores||[]).slice().sort((a,b)=>a.nombre.localeCompare(b.nombre));
    const opts='<option value="">-- Jugador --</option>'+
        jugadores.map(j=>`<option value="${j.id}">${escapeHtml(j.nombre)}</option>`).join('');
    const cont=document.getElementById('adm-jugadores-container');
    const resCont=document.getElementById('adm-resultado-container');
    let jugadoresHTML='', resultadoHTML='';

    if (modalidad==='dobles') {
        jugadoresHTML=`<label class="form-label">👥 Jugadores</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div class="adm-equipo-col">
                    <div class="adm-equipo-label" style="background:#001e3c;color:#C5A059;">EQUIPO A</div>
                    <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A1" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                    <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A2" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                </div>
                <div style="display:flex;align-items:center;font-weight:900;color:#888;">VS</div>
                <div class="adm-equipo-col">
                    <div class="adm-equipo-label" style="background:#C5A059;color:#001e3c;">EQUIPO B</div>
                    <select class="atp-input adm-jugador" data-equipo="B" id="adm-j-B1" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                    <select class="atp-input adm-jugador" data-equipo="B" id="adm-j-B2" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                </div>
            </div>`;
        resultadoHTML=resultadoJuegosHTML();
    } else if (modalidad==='individual') {
        jugadoresHTML=`<label class="form-label">👥 Jugadores</label>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A1" style="flex:1" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                <span style="font-weight:900;color:#888;">VS</span>
                <select class="atp-input adm-jugador" data-equipo="B" id="adm-j-B1" style="flex:1" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
            </div>`;
        resultadoHTML=resultadoJuegosHTML();
    } else if (modalidad==='trios') {
        jugadoresHTML=`<label class="form-label">👥 Jugadores (3v3)</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div class="adm-equipo-col">
                    <div class="adm-equipo-label" style="background:#001e3c;color:#C5A059;">EQUIPO A</div>
                    <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A1" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                    <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A2" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                    <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A3" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                </div>
                <div style="display:flex;align-items:center;font-weight:900;color:#888;">VS</div>
                <div class="adm-equipo-col">
                    <div class="adm-equipo-label" style="background:#C5A059;color:#001e3c;">EQUIPO B</div>
                    <select class="atp-input adm-jugador" data-equipo="B" id="adm-j-B1" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                    <select class="atp-input adm-jugador" data-equipo="B" id="adm-j-B2" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                    <select class="atp-input adm-jugador" data-equipo="B" id="adm-j-B3" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                </div>
            </div>`;
        resultadoHTML=resultadoJuegosHTML();
    } else if (modalidad==='asimetrico') {
        // ✅ Asimétrico: equipos de tamaño libre con score A-B
        jugadoresHTML=`<label class="form-label">⚡ ASIMÉTRICO — Equipos libres</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div class="adm-equipo-col" style="flex:1;">
                    <div class="adm-equipo-label" style="background:#ff6b35;color:white;">EQUIPO A</div>
                    <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A1" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                    <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A2" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts.replace('<option value="">-- Jugador --</option>','<option value="">-- Opcional --</option>')}</select>
                    <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A3" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts.replace('<option value="">-- Jugador --</option>','<option value="">-- Opcional --</option>')}</select>
                </div>
                <div style="display:flex;align-items:center;font-weight:900;color:#ff6b35;">VS</div>
                <div class="adm-equipo-col" style="flex:1;">
                    <div class="adm-equipo-label" style="background:#ff6b35;color:white;">EQUIPO B</div>
                    <select class="atp-input adm-jugador" data-equipo="B" id="adm-j-B1" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts}</select>
                    <select class="atp-input adm-jugador" data-equipo="B" id="adm-j-B2" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts.replace('<option value="">-- Jugador --</option>','<option value="">-- Opcional --</option>')}</select>
                    <select class="atp-input adm-jugador" data-equipo="B" id="adm-j-B3" onchange="syncGolpesAdmin();syncMvpAdmin()">${opts.replace('<option value="">-- Jugador --</option>','<option value="">-- Opcional --</option>')}</select>
                </div>
            </div>`;
        resultadoHTML=resultadoJuegosHTML();
    } else if (modalidad==='equipos3') {
        jugadoresHTML=`<label class="form-label">🔄 AUSTRALIANA — 3 Jugadores</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
                ${[1,2,3].map(i=>`<div style="display:flex;align-items:center;gap:8px;">
                    <select class="atp-input adm-jugador" data-equipo="A" id="adm-j-A${i}" style="flex:1"
                            onchange="syncGolpesAdmin();syncMvpAdmin();actualizarAusFormLabels()">${opts}</select>
                    <span id="adm-aus-label-${i}" style="font-size:0.7rem;color:#a78bfa;font-weight:900;min-width:28px;text-align:center;">J${i}</span>
                </div>`).join('')}
            </div>`;
        resultadoHTML=`
            <div style="background:#f5f0ff;border-radius:10px;padding:14px;margin-bottom:10px;">
                <label class="form-label" style="color:#a78bfa;margin-bottom:10px;display:block;">🎾 Juegos ganados (totales acumulados por jugador)</label>
                <div style="display:flex;gap:8px;">
                    ${[1,2,3].map(i=>`<div style="text-align:center;flex:1;">
                        <div id="adm-aus-pname-${i}" style="font-size:0.7rem;font-weight:800;color:#a78bfa;margin-bottom:4px;">J${i}</div>
                        <input type="number" id="adm-aus-pts-${i}" class="adm-score-input" value="0" min="0" max="99" style="border:2px solid #a78bfa;">
                    </div>`).join('')}
                </div>
            </div>
            <div style="background:#fff8f0;border-radius:10px;padding:14px;">
                <label class="form-label" style="color:#ff6b35;margin-bottom:8px;display:block;">⚡ Desglose Solo vs Pareja <span style="font-size:0.7rem;color:#888;font-weight:400;">(opcional — para el bonus David vs Goliat)</span></label>
                <p style="font-size:0.72rem;color:#888;margin:0 0 10px;">Indica cuántos juegos ganó cada jugador cuando jugaba <b>solo</b> (1 contra 2). Si el que más ganó lo hizo mayoritariamente como solo, recibirá +1pt bonus.</p>
                <div style="display:flex;gap:8px;">
                    ${[1,2,3].map(i=>`<div style="text-align:center;flex:1;">
                        <div id="adm-aus-solname-${i}" style="font-size:0.65rem;font-weight:800;color:#ff6b35;margin-bottom:4px;">J${i}</div>
                        <div style="font-size:0.6rem;color:#888;margin-bottom:3px;">siendo solo</div>
                        <input type="number" id="adm-aus-solo-${i}" class="atp-input" value="0" min="0" max="99"
                               style="width:100%;text-align:center;padding:6px 2px;font-size:0.9rem;">
                    </div>`).join('')}
                </div>
            </div>`;
    } else if (modalidad==='gamificado') {
        let gamJugadores='';
        for (let i=1;i<=6;i++) {
            gamJugadores+=`<div style="display:flex;gap:8px;align-items:center;margin-bottom:7px;">
                <select class="atp-input adm-jugador" data-equipo="G" id="adm-j-G${i}" style="flex:1"
                        onchange="syncGolpesAdmin();syncMvpAdmin()">
                    ${opts.replace('<option value="">-- Jugador --</option>',`<option value="">-- Jugador ${i} (opcional) --</option>`)}
                </select>
                <input type="number" id="adm-gam-pts-${i}" min="0" max="999"
                       class="atp-input" style="width:70px;text-align:center;" value="0"
                       oninput="actualizarPreviewGamAdmin()">
                <span id="adm-gam-rk-${i}" style="font-size:0.6rem;color:#888;font-weight:900;min-width:28px;text-align:center;">+?🏆</span>
            </div>`;
        }
        jugadoresHTML=`<label class="form-label">👥 Participantes y puntos individuales</label>${gamJugadores}`;
        resultadoHTML=`<div class="form-group">
            <label class="form-label">🏆 Resultado general</label>
            <input type="text" id="adm-gam-resultado" class="atp-input" placeholder="Ej: ÉXITO 🏆" value="ÉXITO 🏆">
        </div>`;
    }

    cont.innerHTML=`<div class="form-group">${jugadoresHTML}</div>`;
    resCont.innerHTML=`<div class="form-group">${resultadoHTML}</div>`;
    syncGolpesAdmin();
    syncMvpAdmin();
}

// ── PREVIEW PROPORCIONAL GAMIFICADO ────────────────────────
// ── Actualiza etiquetas del formulario australiana con nombres reales ──
function actualizarAusFormLabels() {
    for (let i=1;i<=3;i++) {
        const sel = document.getElementById(`adm-j-A${i}`);
        const nombre = sel?.value ? (db.jugadores.find(j=>String(j.id)===sel.value)?.nombre?.split(' ')[0] || `J${i}`) : `J${i}`;
        const lbl = document.getElementById(`adm-aus-label-${i}`);
        const pname = document.getElementById(`adm-aus-pname-${i}`);
        const solname = document.getElementById(`adm-aus-solname-${i}`);
        if (lbl) lbl.textContent = nombre;
        if (pname) pname.textContent = nombre;
        if (solname) solname.textContent = nombre;
    }
}

function actualizarPreviewGamAdmin() {
    const pts = [];
    for (let i=1;i<=6;i++) {
        const v = parseInt(document.getElementById(`adm-gam-pts-${i}`)?.value)||0;
        pts.push(v);
    }
    const max = Math.max(0,...pts);
    const numMax = pts.filter(v=>v===max).length;
    const esEmp = numMax>1&&max>0;
    for (let i=1;i<=6;i++) {
        const el = document.getElementById(`adm-gam-rk-${i}`);
        if (!el) continue;
        const p = pts[i-1];
        let rk;
        if (max===0)          rk='1';
        else if (esEmp&&p===max) rk='2';
        else if (p===max)     rk='3';
        else if (p===0)       rk='0';
        else { rk=Math.max(1,Math.round(p/max*3)); if(rk>=3)rk=2; rk=String(rk); }
        const col = rk==='3'?'#10ac84':rk==='2'?'#f39c12':rk==='1'?'#888':'#ee5253';
        el.textContent=`+${rk}🏆`;
        el.style.color=col;
    }
}

// ── SYNC MVP con jugadores seleccionados ───────────────────
function syncMvpAdmin() {
    const cont  = document.getElementById('adm-mvp-container');
    const contE = document.getElementById('adm-mvp-entrenadores-container');
    if (!cont) return;
    const ids=[...new Set(Array.from(document.querySelectorAll('.adm-jugador')).map(s=>s.value).filter(Boolean))];
    const empty='<p style="color:#aaa;font-size:0.78rem;text-align:center;">Selecciona jugadores primero</p>';
    if (!ids.length) {
        cont.innerHTML = empty;
        if (contE) contE.innerHTML = empty;
        return;
    }
    const makeCheckbox = (id, cls, accent) => {
        const j = db.jugadores.find(x=>String(x.id)===id);
        if (!j) return '';
        return `<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;cursor:pointer;border-radius:6px;"
               onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">
            <input type="checkbox" value="${j.id}" class="${cls}" style="width:16px;height:16px;cursor:pointer;accent-color:${accent};">
            <span style="font-size:0.88rem;font-weight:600;">${escapeHtml(j.nombre)}</span>
        </label>`;
    };
    cont.innerHTML  = ids.map(id => makeCheckbox(id, 'adm-mvp-check', '#10ac84')).join('');
    if (contE) contE.innerHTML = ids.map(id => makeCheckbox(id, 'adm-mvp-check-e', '#C5A059')).join('');
}

function resultadoJuegosHTML() {
    return `<label class="form-label">📊 Resultado (juegos)</label>
        <div class="adm-resultado-box">
            <div style="text-align:center;">
                <div style="font-size:0.65rem;font-weight:800;color:#555;margin-bottom:4px;">EQUIPO A</div>
                <input type="number" id="adm-score-A" class="adm-score-input" value="0" min="0" max="99">
            </div>
            <div style="font-size:1.4rem;font-weight:900;color:#ccc;">—</div>
            <div style="text-align:center;">
                <div style="font-size:0.65rem;font-weight:800;color:#555;margin-bottom:4px;">EQUIPO B</div>
                <input type="number" id="adm-score-B" class="adm-score-input" value="0" min="0" max="99">
            </div>
        </div>`;
}

// ── SYNC GOLPES ────────────────────────────────────────────
function syncGolpesAdmin() {
    const cont=document.getElementById('adm-golpes-container');
    if (!cont) return;
    const ids=[...new Set(Array.from(document.querySelectorAll('.adm-jugador')).map(s=>s.value).filter(Boolean))];
    if (!ids.length) { cont.innerHTML='<p style="color:#aaa;font-size:0.8rem;text-align:center;padding:10px;">Selecciona jugadores primero.</p>'; return; }
    const golpes=[{id:'ace',label:'🚀 ACE'},{id:'winner',label:'🔥 WINNER'},{id:'dejada',label:'🧤 DEJADA'},{id:'volea',label:'🎾 VOLEA'},{id:'smash',label:'💥 SMASH'},{id:'passing',label:'🎯 PASSING'}];
    cont.innerHTML=ids.map(id=>{
        const j=db.jugadores.find(x=>String(x.id)===id);
        if (!j) return '';
        return `<div class="adm-golpe-row">
            <div class="adm-golpe-jugador-name">${escapeHtml(j.nombre)}</div>
            <div class="adm-golpes-grid">
                ${golpes.map(g=>`<div class="adm-golpe-item">
                    <label>${g.label}</label>
                    <input type="number" min="0" max="99" value="0" id="adm-golpe-${j.id}-${g.id}" class="adm-golpe-input">
                </div>`).join('')}
            </div>
        </div>`;
    }).join('');
}

function toggleAdmGolpes() {
    const panel=document.getElementById('adm-golpes-panel');
    const btn=document.getElementById('btn-toggle-golpes');
    const visible=panel.style.display!=='none';
    panel.style.display=visible?'none':'block';
    btn.textContent=visible?'+ Añadir golpes':'− Ocultar golpes';
    if (!visible) syncGolpesAdmin();
}

function leerGolpesAdmin() {
    const resultado={};
    document.querySelectorAll('.adm-golpe-input').forEach(inp=>{
        // id = "adm-golpe-{jugadorId}-{golpeId}" — golpeId es la última parte
        const parts=inp.id.replace('adm-golpe-','').split('-');
        const golpeId=parts[parts.length-1];
        const jugadorId=parts.slice(0,parts.length-1).join('-');
        const val=parseInt(inp.value)||0;
        if (val>0) {
            if (!resultado[jugadorId]) resultado[jugadorId]={};
            resultado[jugadorId][golpeId]=val;
        }
    });
    return resultado;
}

// ── GUARDAR PARTIDO ADMIN ──────────────────────────────────

// ── HELPER: reconstruir asistentes de una jornada archivada ─
// Deduplica todos los IDs que aparecen en los partidos de la jornada,
// busca nombre y esInvitado en db.jugadores, igual que cerrarJornada live.
function recalcularAsistentesJornada(jornada) {
    const partidos = jornada.partidos || [];
    const idsUnicos = [...new Set(partidos.flatMap(p => (p.ids || []).map(String)))];
    jornada.asistentes = idsUnicos.map(id => {
        const j = db.jugadores.find(x => String(x.id) === id);
        return j ? { id: j.id, nombre: j.nombre, esInvitado: !!j.esInvitado } : null;
    }).filter(Boolean);
    jornada.jugadores = jornada.asistentes.length;
}

function guardarPartidoAdmin() {
    // AUDIT-FIX B2: guard — estas funciones solo son válidas con PIN correcto
    if (typeof adminDesbloqueado !== 'undefined' && !adminDesbloqueado) {
        console.warn('Acceso denegado: admin no autenticado');
        return;
    }

    // ✅ FIX BUG IDEMPOTENCIA: guard contra doble click.
    // Antes, si el admin pulsaba "Guardar partido" 2 veces seguidas (por lentitud
    // o por error), se creaban DOS registros distintos (cada uno con id único
    // 'adm-Date.now()-rand') y los puntos se aplicaban DOS veces al ranking,
    // duplicando puntuaciones silenciosamente. El usuario veía 6 pts en lugar de 3.
    // Guard: bloqueamos durante 1.5s tras cada llamada exitosa.
    if (window._guardarPartidoAdminEnCurso) {
        console.warn('Doble click ignorado: guardarPartidoAdmin en curso');
        return;
    }
    window._guardarPartidoAdminEnCurso = true;
    setTimeout(() => { window._guardarPartidoAdminEnCurso = false; }, 1500);

    const modalidad=document.getElementById('adm-modalidad').value;
    const fecha=document.getElementById('adm-fecha').value;
    const pista=document.getElementById('adm-pista').value||'ADM';
    if (!fecha) { mostrarFeedbackAdmin('⚠️ Selecciona una fecha.','error'); return; }

    // ✅ FIX: gN declarado aquí arriba para que esté disponible en todos los bloques.
    // Antes estaba declarado con 'const' después del bloque equipos3 que ya lo usaba
    // para construir el marcador (línea ~1699), causando ReferenceError por temporal dead zone.
    const gN=id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'???';

    let idsA=[],idsB=[],idsG=[];
    document.querySelectorAll('.adm-jugador').forEach(sel=>{
        if (!sel.value) return;
        if (sel.dataset.equipo==='A') idsA.push(sel.value);
        else if (sel.dataset.equipo==='B') idsB.push(sel.value);
        else if (sel.dataset.equipo==='G') idsG.push(sel.value);
    });

    if (modalidad==='gamificado') {
        if (!idsG.length) { mostrarFeedbackAdmin('⚠️ Selecciona al menos un participante.','error'); return; }
    } else if (modalidad==='equipos3') {
        if (!idsA.length) { mostrarFeedbackAdmin('⚠️ Selecciona los 3 jugadores.','error'); return; }
        // idsB es vacío intencionalmente en australiana — no validar
    } else {
        if (!idsA.length||!idsB.length) { mostrarFeedbackAdmin('⚠️ Selecciona jugadores para ambos equipos.','error'); return; }
        const todos=[...idsA,...idsB];
        if (new Set(todos).size!==todos.length) { mostrarFeedbackAdmin('⚠️ Un jugador no puede estar en los dos equipos.','error'); return; }
    }

    // ✅ FIX BUG 9: leer MVPs separados (jugadores +3, entrenadores +2)
    const mvpIdsJ = leerMvpIds('adm-mvp-container');
    const mvpIdsE = Array.from(document.querySelectorAll('#adm-mvp-entrenadores-container .adm-mvp-check-e:checked')).map(cb => cb.value);
    const mvpIds  = [...new Set([...mvpIdsJ, ...mvpIdsE])];

    let jA=0,jB=0,marcador='0-0',puntosGamificados={},puntosAustraliana={};
    let juegosSoloAustraliana = {}; // ← nuevo: juegos ganados siendo el solo
    if (modalidad==='gamificado') {
        for (let i=1;i<=6;i++) {
            const sel=document.getElementById(`adm-j-G${i}`);
            const pts=parseInt(document.getElementById(`adm-gam-pts-${i}`)?.value)||0;
            if (sel?.value) puntosGamificados[sel.value]=pts;
        }
        marcador=document.getElementById('adm-gam-resultado')?.value||'ÉXITO 🏆';
    } else if (modalidad==='equipos3') {
        // ✅ Australiana: leer puntos totales + desglose solo
        const sels=[1,2,3].map(i=>document.getElementById(`adm-j-A${i}`));
        const pts=[1,2,3].map(i=>parseInt(document.getElementById(`adm-aus-pts-${i}`)?.value)||0);
        const solos=[1,2,3].map(i=>parseInt(document.getElementById(`adm-aus-solo-${i}`)?.value)||0);
        sels.forEach((sel,i)=>{
            if (sel?.value) {
                puntosAustraliana[sel.value]=pts[i];
                juegosSoloAustraliana[sel.value]=solos[i];
            }
        });
        idsA=Object.keys(puntosAustraliana);
        idsB=[];
        // Marcador: nombre:total(solo:N) si hay datos de solo
        const haySolo = Object.values(juegosSoloAustraliana).some(v=>v>0);
        const ganadores = Object.entries(puntosAustraliana).sort((a,b)=>b[1]-a[1]);
        marcador = ganadores.map(([id,p])=>{
            const s = juegosSoloAustraliana[id] || 0;
            return haySolo ? `${gN(id)}:${p}(solo:${s})` : `${gN(id)}:${p}`;
        }).join(' · ');
        jA=0; jB=0;
    } else {
        jA=parseInt(document.getElementById('adm-score-A')?.value)||0;
        jB=parseInt(document.getElementById('adm-score-B')?.value)||0;
        marcador=`${jA}-${jB}`;
    }

    const golpesPartido=leerGolpesAdmin();
    const allIds=modalidad==='gamificado'?idsG:modalidad==='equipos3'?[...idsA]:[...idsA,...idsB];

    let nombresStr='';
    if (modalidad==='dobles')         nombresStr=`${gN(idsA[0])}/${gN(idsA[1])} vs ${gN(idsB[0])}/${gN(idsB[1])}`;
    else if(modalidad==='individual') nombresStr=`${gN(idsA[0])} vs ${gN(idsB[0])}`;
    else if(modalidad==='trios')      nombresStr=`${idsA.map(gN).join('+')} vs ${idsB.map(gN).join('+')}`;
    else if(modalidad==='asimetrico') nombresStr=`⚡ ${idsA.map(gN).join('+')} vs ${idsB.map(gN).join('+')} [${idsA.length}v${idsB.length}]`;
    else if(modalidad==='equipos3')   nombresStr=`🔄 Australiana: ${allIds.map(gN).join(' · ')}`;
    else nombresStr=`🎮 Gamificado (${idsG.length} jugadores)`;

    const partidoArchivado={
        id:'adm-'+Date.now(),
        tipo:modalidad, gamified:modalidad==='gamificado',
        fecha, pista, nombres:nombresStr,
        ids:allIds, juegosA:jA, juegosB:jB, marcador,
        tamanoEquipoA: modalidad==='asimetrico' ? idsA.length : null,
        puntosGamificados:modalidad==='gamificado'?puntosGamificados:{},
        puntosAustraliana:modalidad==='equipos3'?puntosAustraliana:undefined,
        juegosSoloAustraliana:modalidad==='equipos3'?juegosSoloAustraliana:undefined,
        golpes:golpesPartido,
        mvpIds,
        mvpIdsJugadores:    [...mvpIdsJ],
        mvpIdsEntrenadores: [...mvpIdsE],
        mvpId:null,
        esAdmin:true,
        fin:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
    };

    // Aplicar puntos ranking + stats (siempre, independientemente del destino)
    aplicarPuntosPartido(partidoArchivado, idsA, idsB, idsG, false);
    aplicarMvps(mvpIdsJ, 3);
    mvpIdsE.filter(id => !mvpIdsJ.includes(id)).forEach(id => aplicarMvps([id], 2));

    // ── DESTINO: jornada archivada existente ─────────────────
    const destino = document.getElementById('adm-destino')?.value || 'sesion';
    const jornadaDestinoId = document.getElementById('adm-jornada-destino-id')?.value;

    if (destino === 'jornada-existente' && jornadaDestinoId) {
        const jornada = (db.historicoJornadas||[]).find(j => String(j.id) === String(jornadaDestinoId));
        if (!jornada) {
            mostrarFeedbackAdmin('❌ Jornada de destino no encontrada.', 'error');
            return;
        }
        if (!jornada.partidos) jornada.partidos = [];
        jornada.partidos.push(partidoArchivado);
        recalcularAsistentesJornada(jornada); // FIX-A2

        _saveDirectFirebase(() => {
            if(typeof renderRanking==='function') renderRanking();
            if(typeof renderRankingEspecialistas==='function') renderRankingEspecialistas();
            if(typeof renderAnalisisAvanzado==='function') renderAnalisisAvanzado();
            if(typeof renderHistoricoGeneral==='function') renderHistoricoGeneral();
            if(typeof renderAdmHistorialGlobal==='function') renderAdmHistorialGlobal();
        });
        if(typeof sincronizarTV==='function') sincronizarTV();

        const mvpNombresJ = mvpIdsJ.map(id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'?').join(', ');
        const mvpNombresE = mvpIdsE.map(id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'?').join(', ');
        const mvpStr = [mvpNombresJ && `🗳️ ${mvpNombresJ}`, mvpNombresE && `👨‍🏫 ${mvpNombresE}`].filter(Boolean).join(' · ');
        mostrarFeedbackAdmin(
            `✅ Partido añadido a la jornada del ${jornada.fecha}: ${nombresStr} → ${marcador}${mvpStr?' | 👑 '+mvpStr:''}`,
            'ok'
        );
        resetFormAdminParcial();
        return;
    }

    // ── DESTINO: cola de sesión (flujo original) ──────────────
    if (!db.partidosRecientes) db.partidosRecientes=[];
    db.partidosRecientes.push(partidoArchivado);
    if (!window.partidosFinalizadosHoy) window.partidosFinalizadosHoy=[];
    window.partidosFinalizadosHoy.push(partidoArchivado);
    admPartidosSesion.push(partidoArchivado);

    if (typeof saveDB==='function') saveDB();
    if (typeof renderRanking==='function') renderRanking();
    if (typeof renderRankingEspecialistas==='function') renderRankingEspecialistas();
    if (typeof renderAnalisisAvanzado==='function') renderAnalisisAvanzado();
    if (typeof renderHistoricoGeneral==='function') renderHistoricoGeneral();
    if (typeof renderHistorialHoy==='function') renderHistorialHoy();
    if (typeof sincronizarTV==='function') sincronizarTV();

    const mvpNombresJ = mvpIdsJ.map(id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'?').join(', ');
    const mvpNombresE = mvpIdsE.map(id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'?').join(', ');
    const mvpStr = [mvpNombresJ && `🗳️ ${mvpNombresJ}`, mvpNombresE && `👨‍🏫 ${mvpNombresE}`].filter(Boolean).join(' · ');
    mostrarFeedbackAdmin(`✅ Guardado en cola: ${nombresStr} → ${marcador}${mvpStr?' | 👑 '+mvpStr:''}`, 'ok');
    resetFormAdminParcial();
    renderAdmListaRegistrados();
}

function resetFormAdminParcial() {
    const sA=document.getElementById('adm-score-A'), sB=document.getElementById('adm-score-B');
    if (sA) sA.value=0; if (sB) sB.value=0;
    // ✅ Australiana fields
    for (let i=1;i<=3;i++) {
        const p=document.getElementById(`adm-aus-pts-${i}`); if(p) p.value=0;
        const s=document.getElementById(`adm-aus-solo-${i}`); if(s) s.value=0;
    }
    document.querySelectorAll('.adm-golpe-input').forEach(i=>i.value=0);
    for (let i=1;i<=6;i++) { const p=document.getElementById(`adm-gam-pts-${i}`); if(p) p.value=0; }
    document.querySelectorAll('#adm-mvp-container .adm-mvp-check').forEach(cb=>cb.checked=false);
    document.querySelectorAll('#adm-mvp-entrenadores-container .adm-mvp-check-e').forEach(cb=>cb.checked=false);
}

function mostrarFeedbackAdmin(msg, tipo) {
    const fb=document.getElementById('adm-feedback');
    if (!fb) return;
    fb.textContent=msg; fb.style.display='block';
    fb.style.background=tipo==='ok'?'#d4edda':'#f8d7da';
    fb.style.color=tipo==='ok'?'#155724':'#721c24';
    fb.style.border=`1px solid ${tipo==='ok'?'#c3e6cb':'#f5c6cb'}`;
    setTimeout(()=>fb.style.display='none', 4500);
}

// ── DESTINO: mostrar/ocultar selector de jornada existente ──
function actualizarDestinoAdmin() {
    const destino = document.getElementById('adm-destino')?.value;
    const divJornada = document.getElementById('adm-destino-jornada');
    if (!divJornada) return;
    if (destino === 'jornada-existente') {
        divJornada.style.display = 'block';
        rellenarJornadasDestino();
    } else {
        divJornada.style.display = 'none';
    }
}

function rellenarJornadasDestino() {
    const sel = document.getElementById('adm-jornada-destino-id');
    if (!sel) return;
    const historico = [...(db.historicoJornadas || [])].sort((a,b) => (b.id||0) - (a.id||0));
    if (!historico.length) {
        sel.innerHTML = '<option value="">No hay jornadas archivadas</option>';
        return;
    }
    sel.innerHTML = historico.map(j =>
        `<option value="${j.id}">${j.fecha || new Date(j.id).toLocaleDateString()} — ${(j.partidos||[]).length} partidos</option>`
    ).join('');
}

// ── LISTA SESIÓN ───────────────────────────────────────────
function renderAdmListaRegistrados() {
    const cont=document.getElementById('adm-lista-registrados');
    if (!cont) return;
    if (!admPartidosSesion.length) {
        cont.innerHTML='<p style="text-align:center;color:#999;padding:30px;font-style:italic;">Aún no se han registrado partidos en esta sesión.</p>';
        return;
    }
    const gN=id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'?';
    const _modoLabel = tipo => ({
        'dobles':'🎾 Dobles','individual':'🤺 Individual','trios':'🔱 Tríos',
        'gamificado':'🎮 Gamificado','asimetrico':'⚡ Asimétrico','equipos3':'🔄 Australiana'
    }[tipo] || (tipo || '🎾 Dobles'));
    cont.innerHTML=admPartidosSesion.map((p,idx)=>{
        const mvpNombres=getMvpIds(p).map(gN).filter(Boolean);
        return `<div class="adm-registro-item ${p.tipo}" id="adm-sesion-row-${idx}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;">
                <div style="flex:1;min-width:0;">
                    <span style="font-size:0.65rem;color:#888;text-transform:uppercase;font-weight:800;">${p.fecha} · ${_modoLabel(p.tipo)}</span><br>
                    <span style="font-weight:800;color:#001e3c;font-size:0.9rem;">${escapeHtml(p.nombres)}</span>
                    ${mvpNombres.length?`<div style="font-size:0.72rem;color:#C5A059;margin-top:3px;font-weight:700;">👑 MVP: ${mvpNombres.join(', ')}</div>`:''}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                    <span style="font-family:monospace;font-weight:900;font-size:1.05rem;color:#001e3c;
                                 background:#f0f7ff;padding:4px 10px;border-radius:6px;border:1px solid #cce5ff;">
                        ${p.marcador}
                    </span>
                    <div style="display:flex;gap:6px;">
                        <button class="adm-btn-edit" onclick="abrirEditarPartidoSesion(${idx})">✏️ Editar</button>
                        <button class="adm-btn-del"  onclick="eliminarPartidoSesion(${idx})">🗑️ Borrar</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── ESTADO TEMPORAL EDICIÓN ────────────────────────────────
let _editCtx=null;

function abrirEditarPartidoSesion(idx) {
    const p=admPartidosSesion[idx];
    if (!p) return;
    _editCtx={source:'sesion',sesionIdx:idx,partidoOrig:JSON.parse(JSON.stringify(p))};
    construirModalEdicion(p);
    document.getElementById('modal-editar-partido-admin').style.display='flex';
}

function abrirEditarPartidoHistorial(jornadaId, partidoId) {
    const jornada=(db.historicoJornadas||[]).find(j=>String(j.id)===String(jornadaId));
    if (!jornada) return;
    const p=(jornada.partidos||[]).find(x=>String(x.id)===String(partidoId));
    if (!p) return;
    _editCtx={source:'historial',jornadaId,partidoId,partidoOrig:JSON.parse(JSON.stringify(p))};
    construirModalEdicion(p);
    document.getElementById('modal-editar-partido-admin').style.display='flex';
}

function cerrarModalEditarPartido() {
    document.getElementById('modal-editar-partido-admin').style.display='none';
    _editCtx=null;
}

function construirModalEdicion(p) {
    const jugadores=(db.jugadores||[]).slice().sort((a,b)=>a.nombre.localeCompare(b.nombre));
    const optsBlank='<option value="">-- Jugador --</option>'+jugadores.map(j=>`<option value="${j.id}">${escapeHtml(j.nombre)}</option>`).join('');
    const gN=id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'???';
    const esGam=p.tipo==='gamificado'||p.gamified;
    const esAus=p.tipo==='equipos3' && (p.ids||[]).length===3;
    // ✅ Australiana: idsA = todos los ids (3 jugadores), idsB vacío; corte correcto para otros modos
    const _splitMitad = p.tamanoEquipoA != null ? Number(p.tamanoEquipoA) : Math.floor((p.ids||[]).length/2);
    const idsA=p.ids?p.ids.slice(0,esAus?(p.ids.length):_splitMitad):[];
    const idsB=p.ids&&!esAus?p.ids.slice(_splitMitad):[];
    const curMvpIds=getMvpIds(p);
    const golpeTipos=[{id:'ace',label:'🚀 ACE'},{id:'winner',label:'🔥 WINNER'},{id:'dejada',label:'🧤 DEJADA'},{id:'volea',label:'🎾 VOLEA'},{id:'smash',label:'💥 SMASH'},{id:'passing',label:'🎯 PASSING'}];

    let resultadoHTML='';
    if (esGam) {
        resultadoHTML=`<div class="form-group"><label class="form-label">🎮 Puntos por jugador</label>
            ${(p.ids||[]).map(id=>`
                <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;
                            background:#f8f9fa;border-radius:8px;margin-bottom:6px;border:1px solid #eee;">
                    <span style="font-weight:700;font-size:0.88rem;">${gN(id)}</span>
                    <input type="number" min="0" id="edit-gam-pts-${id}" value="${(p.puntosGamificados&&p.puntosGamificados[id])||0}"
                           style="width:60px;text-align:center;padding:5px;border:1px solid #ddd;border-radius:6px;font-weight:900;">
                </div>`).join('')}
            <label class="form-label" style="margin-top:10px;">Resultado general</label>
            <input type="text" id="edit-gam-resultado" class="atp-input" value="${p.marcador||'ÉXITO 🏆'}">
        </div>`;
    } else if (esAus) {
        // ✅ Australiana: puntos acumulados individuales + desglose solo
        const pts = p.puntosAustraliana || {};
        const soloData = p.juegosSoloAustraliana || {};
        // INDEX-B FIX: usar índice posicional en lugar del id del jugador para los inputs.
        // Si el admin cambia un jugador en el modal, el id nuevo no coincide con el id
        // del input DOM (que tiene el id viejo) y getElementById devuelve null → 0 puntos.
        resultadoHTML=`<div class="form-group"><label class="form-label">🔄 Juegos acumulados (Australiana)</label>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
                ${(p.ids||[]).map((id,i)=>`
                    <div style="text-align:center;flex:1;">
                        <div style="font-size:0.65rem;font-weight:800;color:#a78bfa;margin-bottom:4px;">${gN(id)}</div>
                        <input type="number" id="edit-aus-pts-pos-${i}" class="adm-score-input"
                               value="${pts[id]||0}" min="0" max="99">
                    </div>`).join('')}
            </div>
            <label class="form-label" style="color:#ff6b35;font-size:0.75rem;">⚡ Jugados como solo (opcional)</label>
            <div style="display:flex;gap:8px;">
                ${(p.ids||[]).map((id,i)=>`
                    <div style="text-align:center;flex:1;">
                        <div style="font-size:0.6rem;color:#ff6b35;font-weight:700;margin-bottom:3px;">${gN(id)}</div>
                        <input type="number" id="edit-aus-solo-pos-${i}" class="atp-input"
                               value="${soloData[id]||0}" min="0" max="99"
                               style="width:100%;text-align:center;padding:5px 2px;font-size:0.85rem;">
                    </div>`).join('')}
            </div>
        </div>`;
    } else {
        resultadoHTML=`<div class="form-group"><label class="form-label">📊 Resultado (juegos)</label>
            <div class="adm-resultado-box">
                <div style="text-align:center;">
                    <div style="font-size:0.65rem;font-weight:800;color:#555;margin-bottom:4px;">EQUIPO A</div>
                    <input type="number" id="edit-score-A" class="adm-score-input" value="${p.juegosA||0}" min="0">
                </div>
                <div style="font-size:1.4rem;font-weight:900;color:#ccc;">—</div>
                <div style="text-align:center;">
                    <div style="font-size:0.65rem;font-weight:800;color:#555;margin-bottom:4px;">EQUIPO B</div>
                    <input type="number" id="edit-score-B" class="adm-score-input" value="${p.juegosB||0}" min="0">
                </div>
            </div>
        </div>`;
    }

    const golpesActuales=p.golpes||{};
    const golpesHTML=(p.ids||[]).map(id=>`
        <div class="adm-golpe-row">
            <div class="adm-golpe-jugador-name">${escapeHtml(gN(id))}</div>
            <div class="adm-golpes-grid">
                ${golpeTipos.map(g=>`<div class="adm-golpe-item">
                    <label>${g.label}</label>
                    <input type="number" min="0" max="99" value="${(golpesActuales[id]&&golpesActuales[id][g.id])||0}"
                           id="edit-golpe-${id}-${g.id}" class="adm-golpe-input">
                </div>`).join('')}
            </div>
        </div>`).join('');

    // MVP checkboxes — solo jugadores del partido actual, pre-marcados
    // INDEX-1 FIX: separar checkboxes MVP jugadores (+3) y entrenadores (+2)
    // El modal original usaba un solo checkbox sin distinción de rol, lo que
    // hacía imposible preservar correctamente mvpIdsJugadores vs mvpIdsEntrenadores.
    const curMvpJSet = new Set((Array.isArray(p.mvpIdsJugadores) ? p.mvpIdsJugadores : curMvpIds).map(String));
    const curMvpESet = new Set((Array.isArray(p.mvpIdsEntrenadores) ? p.mvpIdsEntrenadores : []).map(String));
    const makeCheck = (j, cls, accent, sel) =>
        `<label style="display:flex;align-items:center;gap:8px;padding:4px;cursor:pointer;border-radius:6px;"
               onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">
            <input type="checkbox" value="${j.id}" class="${cls}"
                   ${sel.has(String(j.id))?'checked':''} style="width:15px;height:15px;cursor:pointer;accent-color:${accent};">
            <span style="font-size:0.85rem;font-weight:600;">${escapeHtml(j.nombre)}</span>
        </label>`;
    const mvpChecksJ = (p.ids||[]).map(id=>{const j=db.jugadores.find(x=>String(x.id)===id);return j?makeCheck(j,'edit-mvp-J-check','#10ac84',curMvpJSet):'';}).join('');
    const mvpChecksE = (p.ids||[]).map(id=>{const j=db.jugadores.find(x=>String(x.id)===id);return j?makeCheck(j,'edit-mvp-E-check','#C5A059',curMvpESet):'';}).join('');
    const mvpChecksHTML = mvpChecksJ; // legacy alias para compatibilidad

    document.getElementById('modal-editar-contenido').innerHTML=`
        <div class="form-group">
            <label class="form-label">📅 Fecha</label>
            <input type="date" id="edit-fecha" class="atp-input" value="${p.fecha||new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
            <label class="form-label">🎾 Modalidad</label>
            <input class="atp-input" value="${p.tipo||'dobles'}" disabled style="opacity:0.6;">
            <small style="color:#aaa;font-size:0.72rem;">La modalidad no se puede cambiar.</small>
        </div>
        <div class="form-group">
            <label class="form-label">👥 Jugadores</label>
            ${esGam
                ?(p.ids||[]).map((id,i)=>`<select class="atp-input edit-jugador-sel" data-pos="${i}" style="margin-bottom:6px;">
                    ${optsBlank.replace(`value="${id}"`,`value="${id}" selected`)}
                </select>`).join('')
                :esAus
                ?`<div style="display:flex;flex-direction:column;gap:6px;">
                    <div style="font-size:0.65rem;color:#a78bfa;font-weight:800;letter-spacing:1px;margin-bottom:2px;">🔄 AUSTRALIANA — 3 JUGADORES</div>
                    ${(p.ids||[]).map((id,i)=>`<select class="atp-input edit-jugador-A" data-pos="${i}" style="margin-bottom:2px;">
                        ${optsBlank.replace(`value="${id}"`,`value="${id}" selected`)}
                    </select>`).join('')}
                  </div>`
                :`<div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <div class="adm-equipo-col">
                        <div class="adm-equipo-label" style="background:#001e3c;color:#C5A059;">EQUIPO A</div>
                        ${idsA.map((id,i)=>`<select class="atp-input edit-jugador-A" data-pos="${i}" style="margin-bottom:4px;">
                            ${optsBlank.replace(`value="${id}"`,`value="${id}" selected`)}
                        </select>`).join('')}
                    </div>
                    <div style="display:flex;align-items:center;font-weight:900;color:#888;">VS</div>
                    <div class="adm-equipo-col">
                        <div class="adm-equipo-label" style="background:#C5A059;color:#001e3c;">EQUIPO B</div>
                        ${idsB.map((id,i)=>`<select class="atp-input edit-jugador-B" data-pos="${i}" style="margin-bottom:4px;">
                            ${optsBlank.replace(`value="${id}"`,`value="${id}" selected`)}
                        </select>`).join('')}
                    </div>
                  </div>`
            }
        </div>
        ${resultadoHTML}
        <!-- ── TIE-BREAK (solo modos NO gamificado) ── -->
        ${!esGam ? `
        <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:10px;">
                🎾 Tie-break
                <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:0.8rem;cursor:pointer;">
                    <input type="checkbox" id="edit-tb-activo" ${p.tiebreak?'checked':''}
                           onchange="toggleEditTB()"
                           style="width:16px;height:16px;cursor:pointer;accent-color:#0056b3;">
                    Activar modo tie-break
                </label>
            </label>
            <div id="edit-tb-section" style="display:${p.tiebreak?'block':'none'};margin-top:10px;
                 background:rgba(0,86,179,0.06);border:1px solid rgba(0,86,179,0.25);
                 border-radius:10px;padding:12px;">
                <div style="font-size:0.65rem;font-weight:900;color:#0056b3;letter-spacing:1px;margin-bottom:10px;">
                    Puntos del tie-break
                </div>
                <div class="adm-resultado-box">
                    <div style="text-align:center;">
                        <div style="font-size:0.62rem;font-weight:800;color:#555;margin-bottom:4px;">EQUIPO A</div>
                        <input type="number" id="edit-tb-A" class="adm-score-input"
                               value="${p.tbPuntosA||0}" min="0">
                    </div>
                    <div style="font-size:1.2rem;font-weight:900;color:#ccc;">TB</div>
                    <div style="text-align:center;">
                        <div style="font-size:0.62rem;font-weight:800;color:#555;margin-bottom:4px;">EQUIPO B</div>
                        <input type="number" id="edit-tb-B" class="adm-score-input"
                               value="${p.tbPuntosB||0}" min="0">
                    </div>
                </div>
                <div style="font-size:0.68rem;color:#888;margin-top:8px;font-style:italic;">
                    El ganador se determina: primero en llegar a 7 con ≥2 puntos de diferencia.
                    Si jA=jB=0 (solo TB), los puntos del TB son el resultado completo.
                </div>
            </div>
        </div>` : ''}
        <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;">
                🎯 Golpes ganadores
                <button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"
                        style="background:none;border:1px solid #ddd;border-radius:6px;padding:3px 10px;font-size:0.72rem;cursor:pointer;color:#666;">
                    mostrar/ocultar
                </button>
            </label>
            <div style="display:none;">${golpesHTML}</div>
        </div>
        <div class="form-group">
            <label class="form-label">👑 MVP — jugadores (+3pts) y entrenadores (+2pts)</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div>
                    <div style="font-size:0.65rem;font-weight:900;color:#10ac84;margin-bottom:5px;letter-spacing:1px;">🗳️ JUGADORES</div>
                    <div id="edit-mvp-container" style="border:1px solid #a7f3d0;border-radius:8px;padding:8px;max-height:130px;overflow-y:auto;">
                        ${mvpChecksJ||'<p style="color:#aaa;font-size:0.78rem;">Sin jugadores</p>'}
                    </div>
                </div>
                <div>
                    <div style="font-size:0.65rem;font-weight:900;color:#C5A059;margin-bottom:5px;letter-spacing:1px;">👨‍🏫 ENTRENADORES</div>
                    <div id="edit-mvp-E-container" style="border:1px solid #fcd34d;border-radius:8px;padding:8px;max-height:130px;overflow-y:auto;">
                        ${mvpChecksE||'<p style="color:#aaa;font-size:0.78rem;">Sin jugadores</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    document.getElementById('modal-editar-feedback').style.display='none';
}

function leerGolpesEdicion(ids) {
    const resultado={};
    (ids||[]).forEach(id=>{
        ['ace','winner','dejada','volea','smash','passing'].forEach(g=>{
            const val=parseInt(document.getElementById(`edit-golpe-${id}-${g}`)?.value)||0;
            if (val>0) { if(!resultado[id]) resultado[id]={}; resultado[id][g]=val; }
        });
    });
    return resultado;
}

// ── REVERTIR puntos + MVPs del partido ────────────────────
function revertirPuntosPartido(p) {
    const esGam=p.tipo==='gamificado'||p.gamified;
    const esAus=p.tipo==='equipos3' && p.ids && p.ids.length === 3;

    // ✅ Australiana: revertir desde puntosAustraliana
    if (esAus) {
        const pts = p.puntosAustraliana || {};
        const maxPts = Math.max(0, ...Object.values(pts).map(Number));
        const numMax = Object.values(pts).filter(v=>Number(v)===maxPts).length;
        const totAus = Object.values(pts).reduce((s,v)=>s+Number(v||0),0);
        const esEmpateAus = numMax > 1 && maxPts > 0;

        p.ids.forEach(id=>{
            // ✅ FIX: id puede ser number (de Firebase) — String() garantiza el find
            const idStr = String(id);
            const j=db.jugadores.find(x=>String(x.id)===idStr);
            if (!j||!j.stats) return;
            // A3 FIX: invitados acumulan stats de participación pero no puntos de ranking,
            // así que al revertir tampoco se les deben descontar stats ni puntos.
            if (j.esInvitado) return;
            j.stats.totales=Math.max(0,(j.stats.totales||0)-1);
            j.stats.australiana=Math.max(0,(j.stats.australiana||0)-1);
            const misAus=Number(pts[idStr]||0);
            const esMaxAus=misAus===maxPts&&maxPts>0;
            // ✅ Revertir bonus David vs Goliat con los mismos datos que se usaron al aplicar
            const soloRevData = p.juegosSoloAustraliana || {};
            const juegosSoloRev = Number(soloRevData[idStr] || 0);
            const haySoloRevData = Object.values(soloRevData).some(v => Number(v) > 0);
            let _bonusAusRev = 0;
            if (esMaxAus && !esEmpateAus && numMax === 1) {
                if (haySoloRevData) {
                    const juegosPareja = Math.max(0, misAus - juegosSoloRev);
                    _bonusAusRev = juegosSoloRev > juegosPareja ? 1 : 0;
                } else {
                    _bonusAusRev = 1; // heurística legacy
                }
            }
            if (totAus>0) {
                j.stats.juegosFavor =Math.max(0,(j.stats.juegosFavor||0)-misAus);
                j.stats.juegosContra=Math.max(0,(j.stats.juegosContra||0)-(totAus-misAus));
                if (esEmpateAus&&esMaxAus) j.puntosTotales=Math.max(0,(j.puntosTotales||0)-2);
                else if (esMaxAus) { j.puntosTotales=Math.max(0,(j.puntosTotales||0)-(3+_bonusAusRev)); j.stats.ganados=Math.max(0,(j.stats.ganados||0)-1); }
                else               { j.puntosTotales=Math.max(0,(j.puntosTotales||0)-1); j.stats.perdidos=Math.max(0,(j.stats.perdidos||0)-1); }
            }
            const g=(p.golpes&&p.golpes[idStr])||{};
            if (g.ace)     j.stats.aces    =Math.max(0,(j.stats.aces||0)-g.ace);
            if (g.winner)  j.stats.winners =Math.max(0,(j.stats.winners||0)-g.winner);
            if (g.smash)   j.stats.smashes =Math.max(0,(j.stats.smashes||0)-g.smash);
            if (g.volea)   j.stats.voleas  =Math.max(0,(j.stats.voleas||0)-g.volea);
            if (g.dejada)  j.stats.dejadas =Math.max(0,(j.stats.dejadas||0)-g.dejada);
            if (g.passing) j.stats.passings=Math.max(0,(j.stats.passings||0)-g.passing);
            // FIX-3: revertir incremento de habilidades causado por golpes
            if (j.habilidades) {
                const mapaHabR={ace:'Saque',winner:'Derecha',dejada:'Mental',volea:'Volea',smash:'Volea',passing:'Reves'};
                Object.entries(g).forEach(([gid,cnt])=>{
                    const skill=mapaHabR[gid];
                    if (skill&&cnt>0&&j.habilidades[skill]>5)
                        j.habilidades[skill]=parseFloat(Math.max(5,j.habilidades[skill]-cnt*0.1).toFixed(1));
                });
                const valsR=Object.values(j.habilidades);
                j.nivel=(valsR.reduce((a,b)=>a+b,0)/valsR.length).toFixed(1);
            }
        });
        revertirMvpsDual(p);
        return;
    }

    const _mitadRev = p.tamanoEquipoA != null
        ? Number(p.tamanoEquipoA)
        : Math.floor((p.ids||[]).length / 2);
    const idsA=(p.ids||[]).slice(0, _mitadRev).map(String);
    const idsB=(p.ids||[]).slice(_mitadRev).map(String);
    const allIds=p.ids||[];
    const jA=parseInt(p.juegosA)||0, jB=parseInt(p.juegosB)||0;
    const tbA=Number(p.tbPuntosA||0), tbB=Number(p.tbPuntosB||0);

    // Recalcular ganador igual que aplicarPuntosPartido (con TB)
    let ganaA=jA>jB, empate=jA===jB&&jA>0, marcadorVacio=jA===0&&jB===0;
    if (p.tiebreak) {
        // ✅ FIX BUG TB-ADMIN (simétrico a aplicarPuntosPartido):
        // El TB desempata SIEMPRE que tenga ganador claro, también con
        // jA=jB>0. Antes solo se consultaba si los dos eran 0-0,
        // dejando "5-5 TB 7-9" como empate falso al revertir.
        if (tbA>0||tbB>0) {
            let ganTBR=null;
            if (tbA>=7&&tbA-tbB>=2) ganTBR='A';
            else if (tbB>=7&&tbB-tbA>=2) ganTBR='B';
            else if (tbA>tbB) ganTBR='A';
            else if (tbB>tbA) ganTBR='B';
            if (ganTBR) {
                ganaA=ganTBR==='A';
                empate=false;
                marcadorVacio=false;
            } else if (jA===0&&jB===0) {
                empate=true; marcadorVacio=false;
            }
        } else if (jA===0&&jB===0) {
            marcadorVacio=true;
        }
    }

    allIds.forEach(id=>{
        // ✅ FIX: id puede ser number (de Firebase) — normalizar a String
        const idStr = String(id);
        const j=db.jugadores.find(x=>String(x.id)===idStr);
        if (!j||!j.stats) return;
        // A3 FIX: invitados no acumularon puntos ni stats de partido al aplicar,
        // así que al revertir tampoco hay nada que descontar. Evita dejar
        // puntosTotales o stats negativos si se elimina un partido con invitados.
        if (j.esInvitado) return;
        j.stats.totales=Math.max(0,(j.stats.totales||0)-1);
        if (esGam) {
            j.stats.gamificados=Math.max(0,(j.stats.gamificados||0)-1);
            const _ptsGamR = (p.puntosGamificados&&p.puntosGamificados[idStr])||0;
            const _allPtsR = Object.values(p.puntosGamificados||{}).map(Number);
            const _maxGamR = Math.max(0,..._allPtsR);
            const _numMaxR = _allPtsR.filter(v=>v===_maxGamR).length;
            const _esEmpR = _numMaxR>1 && _maxGamR>0;
            let _ptsRevR;
            if (_maxGamR===0)                             _ptsRevR=1;
            else if (_esEmpR&&_ptsGamR===_maxGamR)       _ptsRevR=2;
            else if (_ptsGamR===_maxGamR)                _ptsRevR=3;
            else if (_ptsGamR===0)                       _ptsRevR=0;
            else { _ptsRevR=Math.max(1,Math.round((_ptsGamR/_maxGamR)*3)); if(_ptsRevR>=3)_ptsRevR=2; }
            j.puntosTotales=Math.max(0,(j.puntosTotales||0)-_ptsRevR);
        } else {
            if (p.tipo==='dobles')     j.stats.dobles    =Math.max(0,(j.stats.dobles||0)-1);
            if (p.tipo==='individual') j.stats.simples   =Math.max(0,(j.stats.simples||0)-1);
            if (p.tipo==='trios')      j.stats.trios     =Math.max(0,(j.stats.trios||0)-1);
            if (p.tipo==='asimetrico') j.stats.asimetrico=Math.max(0,(j.stats.asimetrico||0)-1);
            const esA=idsA.includes(idStr); // idsA ya son strings (slice de p.ids normalizado arriba)
            j.stats.juegosFavor =Math.max(0,(j.stats.juegosFavor||0) -(esA?jA:jB));
            j.stats.juegosContra=Math.max(0,(j.stats.juegosContra||0)-(esA?jB:jA));
            if (!marcadorVacio) {
                const gane=esA?ganaA:!ganaA;
                const _tamA3=idsA.length, _tamB3=idsB.length;
                const _esDeseq3=_tamA3!==_tamB3;
                const _eqPeqEsA3=_tamA3<_tamB3;
                let _bonusRev=0;
                if (_esDeseq3&&gane&&!empate){const _esPeq3=esA?_eqPeqEsA3:!_eqPeqEsA3;if(_esPeq3)_bonusRev=1;}
                if (empate)      j.puntosTotales=Math.max(0,(j.puntosTotales||0)-2);
                else if (gane) { j.puntosTotales=Math.max(0,(j.puntosTotales||0)-(3+_bonusRev)); j.stats.ganados =Math.max(0,(j.stats.ganados||0)-1); }
                else           { j.puntosTotales=Math.max(0,(j.puntosTotales||0)-1); j.stats.perdidos=Math.max(0,(j.stats.perdidos||0)-1); }
            }
        }
        const g=(p.golpes&&p.golpes[idStr])||{};
        if (g.ace)     j.stats.aces    =Math.max(0,(j.stats.aces||0)-g.ace);
        if (g.winner)  j.stats.winners =Math.max(0,(j.stats.winners||0)-g.winner);
        if (g.smash)   j.stats.smashes =Math.max(0,(j.stats.smashes||0)-g.smash);
        if (g.volea)   j.stats.voleas  =Math.max(0,(j.stats.voleas||0)-g.volea);
        if (g.dejada)  j.stats.dejadas =Math.max(0,(j.stats.dejadas||0)-g.dejada);
        if (g.passing) j.stats.passings=Math.max(0,(j.stats.passings||0)-g.passing);
        // FIX-3: revertir incremento de habilidades causado por golpes
        if (j.habilidades) {
            const mapaHabR={ace:'Saque',winner:'Derecha',dejada:'Mental',volea:'Volea',smash:'Volea',passing:'Reves'};
            Object.entries(g).forEach(([gid,cnt])=>{
                const skill=mapaHabR[gid];
                if (skill&&cnt>0&&j.habilidades[skill]>5)
                    j.habilidades[skill]=parseFloat(Math.max(5,j.habilidades[skill]-cnt*0.1).toFixed(1));
            });
            const valsR=Object.values(j.habilidades);
            j.nivel=(valsR.reduce((a,b)=>a+b,0)/valsR.length).toFixed(1);
        }
    });
    // FIX-2: resetear rachas para los jugadores del partido.
    // No es posible reconstruir la racha exacta sin historial completo,
    // así que se resetean a 0 (valor neutro, igual que nueva temporada).
    (p.ids||[]).forEach(id=>{
        const j=db.jugadores.find(x=>String(x.id)===String(id));
        if (!j || j.esInvitado) return; // A3 FIX: invitados no tienen racha de ranking
        j.rachaVictorias=0;
        j.rachaDerrotas=0;
    });
    revertirMvpsDual(p);
}

// ── APLICAR puntos partido (MVP opcional y separado) ───────
function aplicarPuntosPartido(p, idsA, idsB, idsG, incluirMvp) {
    const esGam=p.tipo==='gamificado'||p.gamified;
    const esAus=p.tipo==='equipos3' && p.ids && p.ids.length === 3;
    const allIds=esGam?idsG:[...idsA,...idsB];
    const jA=parseInt(p.juegosA)||0, jB=parseInt(p.juegosB)||0;
    const ganaA=jA>jB, empate=jA===jB&&jA>0, marcadorVacio=jA===0&&jB===0;

    // ✅ Australiana: usar puntosAustraliana para calcular ganador y stats individuales
    if (esAus) {
        const pts = p.puntosAustraliana || {};
        const maxPts = Math.max(0, ...Object.values(pts).map(Number));
        const numMax = Object.values(pts).filter(v=>Number(v)===maxPts).length;
        const totAus = Object.values(pts).reduce((s,v)=>s+Number(v||0),0);
        const esEmpateAus = numMax > 1 && maxPts > 0;

        p.ids.forEach(id=>{
            // ✅ FIX: normalizar a String — p.ids de Firebase puede contener numbers
            const idStr = String(id);
            const j=db.jugadores.find(x=>String(x.id)===idStr);
            if (!j) return;
            if (!j.stats) j.stats={ganados:0,perdidos:0,totales:0,juegosFavor:0,juegosContra:0,dobles:0,simples:0,gamificados:0,trios:0,asimetrico:0,australiana:0,mvps:0,aces:0,winners:0,smashes:0,voleas:0,dejadas:0,passings:0};
            j.stats.totales=(j.stats.totales||0)+1;
            j.stats.australiana=(j.stats.australiana||0)+1;
            const misAus=Number(pts[idStr]||0);
            const esMaxAus=misAus===maxPts&&maxPts>0;
            const soloData = p.juegosSoloAustraliana || {};
            const juegosSoloEsteJugador = Number(soloData[idStr] || 0);
            const haySoloDatos = Object.values(soloData).some(v => Number(v) > 0);
            let _bonusAusSolo = 0;
            if (esMaxAus && !esEmpateAus && numMax === 1) {
                if (haySoloDatos) {
                    _bonusAusSolo = juegosSoloEsteJugador > (misAus - juegosSoloEsteJugador) ? 1 : 0;
                } else {
                    _bonusAusSolo = 1;
                }
            }
            if (totAus>0) {
                j.stats.juegosFavor =(j.stats.juegosFavor||0)+misAus;
                j.stats.juegosContra=(j.stats.juegosContra||0)+(totAus-misAus);
                // FIX-4: invitados acumulan stats pero no puntos de ranking (igual que live)
                if (!j.esInvitado) {
                    if (esEmpateAus&&esMaxAus) j.puntosTotales=(j.puntosTotales||0)+2;
                    else if (esMaxAus) { j.puntosTotales=(j.puntosTotales||0)+3+_bonusAusSolo; j.stats.ganados=(j.stats.ganados||0)+1; }
                    else               { j.puntosTotales=(j.puntosTotales||0)+1; j.stats.perdidos=(j.stats.perdidos||0)+1; }
                } else {
                    if (esMaxAus)  j.stats.ganados =(j.stats.ganados||0)+1;
                    else           j.stats.perdidos=(j.stats.perdidos||0)+1;
                }
            }
            const g=(p.golpes&&p.golpes[idStr])||{};
            if (g.ace)     j.stats.aces    =(j.stats.aces||0)+g.ace;
            if (g.winner)  j.stats.winners =(j.stats.winners||0)+g.winner;
            if (g.smash)   j.stats.smashes =(j.stats.smashes||0)+g.smash;
            if (g.volea)   j.stats.voleas  =(j.stats.voleas||0)+g.volea;
            if (g.dejada)  j.stats.dejadas =(j.stats.dejadas||0)+g.dejada;
            if (g.passing) j.stats.passings=(j.stats.passings||0)+g.passing;
            const mapaHab={ace:'Saque',winner:'Derecha',dejada:'Mental',volea:'Volea',smash:'Volea',passing:'Reves'};
            if (!j.habilidades) j.habilidades={Saque:5,Derecha:5,Reves:5,Volea:5,Mental:5};
            Object.entries(g).forEach(([gid,cnt])=>{
                const skill=mapaHab[gid];
                if (skill&&cnt>0&&j.habilidades[skill]<10)
                    j.habilidades[skill]=parseFloat(Math.min(10,j.habilidades[skill]+cnt*0.1).toFixed(1));
            });
            const vals=Object.values(j.habilidades);
            j.nivel=(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
            // FIX-1: actualizar rachas igual que finalizarPartido (solo ganador claro)
            if (totAus>0 && !esEmpateAus) {
                if (esMaxAus) { j.rachaVictorias=(j.rachaVictorias||0)+1; j.rachaDerrotas=0; }
                else          { j.rachaDerrotas=(j.rachaDerrotas||0)+1;   j.rachaVictorias=0; }
            }
        });
        if (incluirMvp) aplicarMvpsDual(p);
        return;
    }

    allIds.forEach(id=>{
        // ✅ FIX: normalizar a String — allIds puede venir de Firebase con numbers
        const idStr = String(id);
        const j=db.jugadores.find(x=>String(x.id)===idStr);
        if (!j) return;
        if (!j.stats) j.stats={ganados:0,perdidos:0,totales:0,juegosFavor:0,juegosContra:0,dobles:0,simples:0,gamificados:0,trios:0,asimetrico:0,australiana:0,mvps:0,aces:0,winners:0,smashes:0,voleas:0,dejadas:0,passings:0};
        j.stats.totales=(j.stats.totales||0)+1;
        if (esGam) {
            j.stats.gamificados=(j.stats.gamificados||0)+1;
            const _ptsGam = (p.puntosGamificados&&p.puntosGamificados[idStr])||0;
            const _allPts = Object.values(p.puntosGamificados||{}).map(Number);
            const _maxGam = Math.max(0,..._allPts);
            const _numMaxGam2 = _allPts.filter(v=>v===_maxGam).length;
            const _esEmpGam2 = _numMaxGam2>1 && _maxGam>0;
            let _ptsRanking;
            if (_maxGam===0)                               _ptsRanking=1;
            else if (_esEmpGam2&&_ptsGam===_maxGam)       _ptsRanking=2;
            else if (_ptsGam===_maxGam)                   _ptsRanking=3;
            else if (_ptsGam===0)                         _ptsRanking=0;
            else { _ptsRanking=Math.max(1,Math.round((_ptsGam/_maxGam)*3)); if(_ptsRanking>=3)_ptsRanking=2; }
            if (!j.esInvitado) j.puntosTotales=(j.puntosTotales||0)+_ptsRanking;
        } else {
            if (p.tipo==='dobles')     j.stats.dobles    =(j.stats.dobles||0)+1;
            if (p.tipo==='individual') j.stats.simples   =(j.stats.simples||0)+1;
            if (p.tipo==='trios')      j.stats.trios     =(j.stats.trios||0)+1;
            if (p.tipo==='asimetrico') j.stats.asimetrico=(j.stats.asimetrico||0)+1;
            const esA=idsA.includes(idStr);
            j.stats.juegosFavor =(j.stats.juegosFavor||0) +(esA?jA:jB);
            j.stats.juegosContra=(j.stats.juegosContra||0)+(esA?jB:jA);

            // ── Calcular ganador con TB ─────────────────────────────
            const tbA=Number(p.tbPuntosA||0), tbB=Number(p.tbPuntosB||0);
            let ganaAFinal=ganaA, empFinal=empate, vacioFinal=marcadorVacio;
            if (p.tiebreak) {
                // ✅ FIX BUG TB-ADMIN: el TB siempre desempata cuando hay puntos.
                // Antes solo se consultaba si jA===0 && jB===0, dejando que
                // partidos como "5-5 con TB 7-9" se sumaran como empate (todos +2)
                // cuando lo correcto es que B gane (+3 / +1).
                // Ahora replicamos la lógica de finalizarPartido (modo live):
                // si hay ganador claro en el TB, lo usa SIEMPRE.
                if (tbA>0||tbB>0) {
                    let ganTB=null;
                    if (tbA>=7&&tbA-tbB>=2) ganTB='A';
                    else if (tbB>=7&&tbB-tbA>=2) ganTB='B';
                    else if (tbA>tbB) ganTB='A';
                    else if (tbB>tbA) ganTB='B';
                    if (ganTB) {
                        ganaAFinal=ganTB==='A';
                        empFinal=false;
                        vacioFinal=false;
                    } else if (jA===0&&jB===0) {
                        // 0-0 sin ganador claro en TB: empate
                        empFinal=true; vacioFinal=false;
                    }
                    // Si hay juegos normales y el TB no tiene ganador claro,
                    // se queda con ganaA / empate calculados desde jA/jB.
                } else if (jA===0&&jB===0) {
                    // TB activado pero sin puntos en ninguno y 0-0: marcador vacío
                    vacioFinal=true;
                }
            }

            if (!vacioFinal) {
                const gane=esA?ganaAFinal:!ganaAFinal;
                const _tamA2=idsA.length, _tamB2=idsB.length;
                const _esDeseq=_tamA2!==_tamB2;
                const _eqPeqEsA2=_tamA2<_tamB2;
                let _bonus=0;
                if (_esDeseq&&gane&&!empFinal){const _esPeq=esA?_eqPeqEsA2:!_eqPeqEsA2;if(_esPeq)_bonus=1;}
                if (!j.esInvitado) {
                    if (empFinal)      j.puntosTotales=(j.puntosTotales||0)+2;
                    else if (gane) { j.puntosTotales=(j.puntosTotales||0)+3+_bonus; j.stats.ganados=(j.stats.ganados||0)+1; }
                    else           { j.puntosTotales=(j.puntosTotales||0)+1; j.stats.perdidos=(j.stats.perdidos||0)+1; }
                } else {
                    if (gane)  j.stats.ganados =(j.stats.ganados||0)+1;
                    else if(!empFinal) j.stats.perdidos=(j.stats.perdidos||0)+1;
                }
            }
        }
        const g=(p.golpes&&p.golpes[idStr])||{};
        if (g.ace)     j.stats.aces    =(j.stats.aces||0)+g.ace;
        if (g.winner)  j.stats.winners =(j.stats.winners||0)+g.winner;
        if (g.smash)   j.stats.smashes =(j.stats.smashes||0)+g.smash;
        if (g.volea)   j.stats.voleas  =(j.stats.voleas||0)+g.volea;
        if (g.dejada)  j.stats.dejadas =(j.stats.dejadas||0)+g.dejada;
        if (g.passing) j.stats.passings=(j.stats.passings||0)+g.passing;
        const mapaHab={ace:'Saque',winner:'Derecha',dejada:'Mental',volea:'Volea',smash:'Volea',passing:'Reves'};
        if (!j.habilidades) j.habilidades={Saque:5,Derecha:5,Reves:5,Volea:5,Mental:5};
        Object.entries(g).forEach(([gid,cnt])=>{
            const skill=mapaHab[gid];
            if (skill&&cnt>0&&j.habilidades[skill]<10)
                j.habilidades[skill]=parseFloat(Math.min(10,j.habilidades[skill]+cnt*0.1).toFixed(1));
        });
        const vals=Object.values(j.habilidades);
        j.nivel=(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
        // FIX-1: actualizar rachas igual que finalizarPartido
        // Gamificado no genera rachas (igual que en live)
        if (!esGam && !marcadorVacio) {
            const gane2 = idsA.includes(idStr) ? ganaA : !ganaA;
            const esEmp2 = empate;
            if (!esEmp2) {
                if (gane2) { j.rachaVictorias=(j.rachaVictorias||0)+1; j.rachaDerrotas=0; }
                else       { j.rachaDerrotas=(j.rachaDerrotas||0)+1;   j.rachaVictorias=0; }
            }
        }
    });
    if (incluirMvp) aplicarMvpsDual(p);
}

function toggleEditTB() {
    const cb = document.getElementById('edit-tb-activo');
    const sec = document.getElementById('edit-tb-section');
    if (sec) sec.style.display = cb?.checked ? 'block' : 'none';
}

// ── GUARDAR EDICIÓN ────────────────────────────────────────
function guardarEdicionPartido() {
    if (!_editCtx) return;
    const orig=_editCtx.partidoOrig;
    const esGam=orig.tipo==='gamificado'||orig.gamified;

    let nuevosIdsA=[],nuevosIdsB=[],nuevosIdsG=[];
    const esAusEdit = orig.tipo==='equipos3';
    if (esGam) document.querySelectorAll('.edit-jugador-sel').forEach(s=>{if(s.value)nuevosIdsG.push(s.value);});
    else {
        document.querySelectorAll('.edit-jugador-A').forEach(s=>{if(s.value)nuevosIdsA.push(s.value);});
        if (!esAusEdit) document.querySelectorAll('.edit-jugador-B').forEach(s=>{if(s.value)nuevosIdsB.push(s.value);});
    }
    const nuevosIds=esGam?nuevosIdsG:[...nuevosIdsA,...nuevosIdsB];
    if (!nuevosIds.length) { mostrarFeedbackModal('⚠️ Selecciona jugadores.','error'); return; }
    if (!esGam && !esAusEdit) {
        const todos=[...nuevosIdsA,...nuevosIdsB];
        if (new Set(todos).size!==todos.length) { mostrarFeedbackModal('⚠️ Un jugador no puede estar en ambos equipos.','error'); return; }
    }

    let nuevoJA=0,nuevoJB=0,nuevoMarcador='',nuevosPtsGam={},nuevosPtsAus={},nuevosSoloAus={};
    if (esGam) {
        orig.ids.forEach(id=>{nuevosPtsGam[id]=parseInt(document.getElementById(`edit-gam-pts-${id}`)?.value)||0;});
        nuevoMarcador=document.getElementById('edit-gam-resultado')?.value||'ÉXITO 🏆';
    } else if (esAusEdit) {
        // INDEX-B FIX: leer por índice posicional (edit-aus-pts-pos-N) en lugar de id del jugador.
        // El id del jugador puede haber cambiado si el admin editó los selects del modal.
        nuevosIds.forEach((id,i)=>{
            nuevosPtsAus[id]=parseInt(document.getElementById(`edit-aus-pts-pos-${i}`)?.value)||0;
            nuevosSoloAus[id]=parseInt(document.getElementById(`edit-aus-solo-pos-${i}`)?.value)||0;
        });
        const gNAus=id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'???';
        const haySolo2=Object.values(nuevosSoloAus).some(v=>v>0);
        nuevoMarcador=nuevosIds.map(id=>{
            const s=nuevosSoloAus[id]||0;
            return haySolo2?`${gNAus(id)}:${nuevosPtsAus[id]||0}(solo:${s})`:`${gNAus(id)}:${nuevosPtsAus[id]||0}`;
        }).join(' · ');
        nuevoJA=0; nuevoJB=0;
    } else {
        nuevoJA=parseInt(document.getElementById('edit-score-A')?.value)||0;
        nuevoJB=parseInt(document.getElementById('edit-score-B')?.value)||0;
        nuevoMarcador=`${nuevoJA}-${nuevoJB}`;
    }

    const nuevosGolpes=leerGolpesEdicion(nuevosIds);
    // INDEX-1 FIX: leer separadamente jugadores y entrenadores
    const nuevosMvpIdsJ = Array.from(document.querySelectorAll('#edit-mvp-container .edit-mvp-J-check:checked')).map(cb=>cb.value);
    const nuevosMvpIdsE = Array.from(document.querySelectorAll('#edit-mvp-E-container .edit-mvp-E-check:checked')).map(cb=>cb.value);
    const nuevosMvpIds = [...new Set([...nuevosMvpIdsJ, ...nuevosMvpIdsE])];
    const nuevaFecha=document.getElementById('edit-fecha')?.value||orig.fecha;

    // ── Leer tie-break (solo para no-gamificado) ──────────────
    const tbActivo = !esGam && (document.getElementById('edit-tb-activo')?.checked || false);
    const nuevoTbA = tbActivo ? (parseInt(document.getElementById('edit-tb-A')?.value)||0) : 0;
    const nuevoTbB = tbActivo ? (parseInt(document.getElementById('edit-tb-B')?.value)||0) : 0;
    // Marcador final incluye TB si activo
    if (!esGam && !esAusEdit && tbActivo) {
        nuevoMarcador = `${nuevoJA}-${nuevoJB} (TB ${nuevoTbA}-${nuevoTbB})`;
    }

    const gN=id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'???';

    let nuevoNombres='';
    if (orig.tipo==='dobles')         nuevoNombres=`${gN(nuevosIdsA[0])}/${gN(nuevosIdsA[1])} vs ${gN(nuevosIdsB[0])}/${gN(nuevosIdsB[1])}`;
    else if(orig.tipo==='individual') nuevoNombres=`${gN(nuevosIdsA[0])} vs ${gN(nuevosIdsB[0])}`;
    else if(orig.tipo==='trios')      nuevoNombres=`${nuevosIdsA.map(gN).join('+')} vs ${nuevosIdsB.map(gN).join('+')}`;
    else if(orig.tipo==='asimetrico') nuevoNombres=`⚡ ${nuevosIdsA.map(gN).join('+')} vs ${nuevosIdsB.map(gN).join('+')}`;
    else if(orig.tipo==='equipos3')   nuevoNombres=`🔄 Australiana: ${nuevosIds.map(gN).join(' · ')}`;
    else nuevoNombres=`🎮 Gamificado (${nuevosIdsG.length} jugadores)`;

    // 1. Revertir todo del original (puntos + MVPs)
    try { revertirPuntosPartido(orig); } catch(e) { console.error('revertir:', e); }

    // 2. Partido editado
    const partidoEditado={
        ...orig, fecha:nuevaFecha, ids:nuevosIds,
        juegosA:nuevoJA, juegosB:nuevoJB, marcador:nuevoMarcador,
        puntosGamificados:nuevosPtsGam, golpes:nuevosGolpes,
        puntosAustraliana: esAusEdit ? nuevosPtsAus : orig.puntosAustraliana,
        juegosSoloAustraliana: esAusEdit ? nuevosSoloAus : orig.juegosSoloAustraliana,
        mvpIds:nuevosMvpIds, mvpId:null,
        // INDEX-1 FIX: usar los arrays separados leidos directamente del modal
        mvpIdsJugadores:    [...nuevosMvpIdsJ],
        mvpIdsEntrenadores: [...nuevosMvpIdsE.filter(id => !nuevosMvpIdsJ.includes(id))],
        nombres:nuevoNombres, editadoAdmin:true,
        tamanoEquipoA: orig.tipo==='asimetrico' ? (nuevosIdsA.length || orig.tamanoEquipoA || null) : null,
        tiebreak:   tbActivo || false,
        tbPuntosA:  tbActivo ? nuevoTbA : undefined,
        tbPuntosB:  tbActivo ? nuevoTbB : undefined,
    };

    // 3. Aplicar puntos + MVPs del editado
    try {
        aplicarPuntosPartido(partidoEditado, esAusEdit?nuevosIds:nuevosIdsA, esAusEdit?[]:nuevosIdsB, nuevosIdsG, true);
    } catch(e) {
        console.error('aplicarPuntos:', e);
        mostrarFeedbackModal('⚠️ Error al calcular puntos: ' + e.message, 'error');
    }

    // 4. Actualizar fuente en memoria
    if (_editCtx.source==='sesion') {
        admPartidosSesion[_editCtx.sesionIdx]=partidoEditado;
        const ri=(db.partidosRecientes||[]).findIndex(x=>String(x.id)===String(orig.id));
        if(ri!==-1) db.partidosRecientes[ri]=partidoEditado;
        const wi=(window.partidosFinalizadosHoy||[]).findIndex(x=>String(x.id)===String(orig.id));
        if(wi!==-1) window.partidosFinalizadosHoy[wi]=partidoEditado;
    } else {
        const jornada=(db.historicoJornadas||[]).find(j=>String(j.id)===String(_editCtx.jornadaId));
        if(jornada&&jornada.partidos){
            const pIdx=jornada.partidos.findIndex(x=>String(x.id)===String(orig.id));
            if(pIdx!==-1) jornada.partidos[pIdx]=partidoEditado;
        }
    }

    // FIX-B: recalcular asistentes de jornada archivada
    if (_editCtx && _editCtx.source === 'historial') {
        const _jornEdic = (db.historicoJornadas||[]).find(j=>String(j.id)===String(_editCtx.jornadaId));
        if (_jornEdic) recalcularAsistentesJornada(_jornEdic);
    }

    // ✅ FIX CRÍTICO PERSISTENCIA: igual que guardarNuevoPartidoEnJornada,
    // usamos snapshot directo + _guardandoDB + grace period en lugar de saveDB()
    // para garantizar que los cambios persisten y el listener no los sobreescribe.
    if (!window._guardandoDB) window._guardandoDB = 0;
    window._guardandoDB++;
    const _editSnapshot = JSON.parse(JSON.stringify(db));

    mostrarFeedbackModal('⏳ Guardando en Firebase...', 'ok');

    database.ref('torneoPlatinum').set(_editSnapshot)
        .then(() => {
            window._guardandoDB = Math.max(0, window._guardandoDB - 1);
            window._njGuardadoReciente = Date.now();
            setTimeout(() => { window._njGuardadoReciente = null; }, 3500);
            console.log('✅ Partido editado guardado en Firebase');

            if(typeof renderRanking==='function') renderRanking();
            if(typeof renderRankingEspecialistas==='function') renderRankingEspecialistas();
            if(typeof renderAnalisisAvanzado==='function') renderAnalisisAvanzado();
            if(typeof renderHistoricoGeneral==='function') renderHistoricoGeneral();

            mostrarFeedbackModal('✅ Partido actualizado y guardado.', 'ok');
            setTimeout(()=>{ cerrarModalEditarPartido(); renderAdmListaRegistrados(); renderAdmHistorialGlobal(); }, 1400);
        })
        .catch(err => {
            window._guardandoDB = Math.max(0, window._guardandoDB - 1);
            console.error('Error guardando edición:', err);
            mostrarFeedbackModal('❌ Error al guardar: ' + err.message + '. Inténtalo de nuevo.', 'error');
            // AUDIT-FIX B1: NO limpiar _editCtx en el catch — el admin puede
            // reintentar guardar con los mismos datos. El modal sigue abierto
            // y muestra el error. Solo se limpia en éxito (cerrarModalEditarPartido).
        });
}

function mostrarFeedbackModal(msg,tipo) {
    const fb=document.getElementById('modal-editar-feedback');
    if (!fb) return;
    fb.textContent=msg; fb.style.display='block';
    fb.style.background=tipo==='ok'?'#d4edda':'#f8d7da';
    fb.style.color=tipo==='ok'?'#155724':'#721c24';
    fb.style.border=`1px solid ${tipo==='ok'?'#c3e6cb':'#f5c6cb'}`;
}

// ── ELIMINAR PARTIDO SESIÓN ────────────────────────────────
function eliminarPartidoSesion(idx) {
    const p=admPartidosSesion[idx];
    if (!p) return;
    if (!confirm(`🗑️ ¿Eliminar y revertir puntos de:\n"${p.nombres}" (${p.marcador})?`)) return;
    revertirPuntosPartido(p);
    admPartidosSesion.splice(idx,1);
    const ri=(db.partidosRecientes||[]).findIndex(x=>String(x.id)===String(p.id));
    if(ri!==-1) db.partidosRecientes.splice(ri,1);
    const wi=(window.partidosFinalizadosHoy||[]).findIndex(x=>String(x.id)===String(p.id));
    if(wi!==-1) window.partidosFinalizadosHoy.splice(wi,1);
    if(typeof saveDB==='function') saveDB();
    if(typeof renderRanking==='function') renderRanking();
    if(typeof renderRankingEspecialistas==='function') renderRankingEspecialistas();
    renderAdmListaRegistrados();
}

// ── CERRAR JORNADA MANUAL ─────────────────────────────────
function renderAdmPartidosParaJornada() {
    const cont=document.getElementById('adm-partidos-para-jornada');
    if (!cont) return;
    if (!admPartidosSesion.length) {
        cont.innerHTML='<p style="color:#999;font-size:0.8rem;text-align:center;padding:20px 0;">Registra partidos primero en la pestaña "Registrar Partido"</p>';
        return;
    }
    cont.innerHTML=admPartidosSesion.map((p,i)=>`
        <label style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:6px;border:1px solid #eee;margin-bottom:6px;cursor:pointer;">
            <input type="checkbox" id="adm-incl-${i}" value="${i}" checked style="width:18px;height:18px;cursor:pointer;">
            <span style="font-size:0.82rem;font-weight:700;color:#333;">
                ${escapeHtml(p.nombres)} <span style="color:#888;font-weight:600;">(${escapeHtml(p.marcador)})</span>
            </span>
        </label>`).join('');
}

function cerrarJornadaManual() {
    // AUDIT-FIX B2: guard — estas funciones solo son válidas con PIN correcto
    if (typeof adminDesbloqueado !== 'undefined' && !adminDesbloqueado) {
        console.warn('Acceso denegado: admin no autenticado');
        return;
    }

    const fecha=document.getElementById('adm-jornada-fecha').value;
    if (!fecha) { alert('⚠️ Selecciona una fecha.'); return; }

    // ✅ FIX MVP FANTASMA: leer solo los IDs del formulario admin, nunca de window.mvpIds*
    // Antes se mezclaban los MVPs de la jornada en vivo (window.mvpIdsJugadores) con los
    // del formulario, generando MVPs fantasma en el histórico.
    const mvpIdsJ = Array.from(document.querySelectorAll('#adm-jornada-mvpJ-container .adm-jornada-mvpJ-check:checked')).map(cb=>cb.value);
    const mvpIdsE = Array.from(document.querySelectorAll('#adm-jornada-mvp-container .adm-jornada-mvpE-check:checked')).map(cb=>cb.value);
    const mvpIds  = [...new Set([...mvpIdsJ, ...mvpIdsE])];

    const checks=document.querySelectorAll('#adm-partidos-para-jornada input[type=checkbox]:checked');
    const partidosIncluidos=Array.from(checks).map(cb=>admPartidosSesion[parseInt(cb.value)]).filter(Boolean);
    if (!partidosIncluidos.length) { alert('⚠️ No hay partidos seleccionados.'); return; }

    const gN = id => db.jugadores.find(j=>String(j.id)===id)?.nombre||'?';
    const mvpNombresJ = mvpIdsJ.map(gN);
    const mvpNombresE = mvpIdsE.map(gN);
    const mvpNombres  = mvpIds.map(gN);

    const mvpStr = [
        mvpNombresJ.length && `🗳️ ${mvpNombresJ.join(', ')}`,
        mvpNombresE.length && `👨‍🏫 ${mvpNombresE.join(', ')}`
    ].filter(Boolean).join(' · ');

    if (!confirm(`📅 ¿Archivar jornada del ${fecha} con ${partidosIncluidos.length} partido(s)?${mvpStr?'\n👑 MVPs: '+mvpStr:''}`)) return;

    // INDEX-3 FIX: los partidos de admPartidosSesion YA tienen sus MVPs aplicados
    // en guardarPartidoAdmin. Si el admin selecciona el mismo jugador como MVP de
    // jornada Y ya era MVP de algún partido, recibiría puntos dobles.
    // Filtramos de los IDs de jornada aquellos que ya fueron MVP en la sesión.
    const _idsYaMvpPartido = new Set(
        admPartidosSesion.flatMap(p => [
            ...(p.mvpIdsJugadores || []),
            ...(p.mvpIdsEntrenadores || [])
        ].map(String))
    );
    const mvpIdsJSinDup = mvpIdsJ.filter(id => !_idsYaMvpPartido.has(String(id)));
    const mvpIdsESinDup = mvpIdsE.filter(id => !_idsYaMvpPartido.has(String(id)));

    // Aplicar puntos MVP de jornada: solo los que no eran ya MVP de partido
    aplicarMvps(mvpIdsJSinDup, 3);
    mvpIdsESinDup.filter(id => !mvpIdsJSinDup.includes(id)).forEach(id => aplicarMvps([id], 2));

    const registroHistorico={
        // ✅ FIX: añadir sufijo aleatorio para evitar colisión de timestamps
        // si dos admins archivan al mismo tiempo (último bit de Date.now() puede coincidir).
        id: Date.now() + Math.floor(Math.random() * 1000), fecha,
        mvp: mvpNombres.join(', ') || '---',
        mvpIds,
        mvpId: null,
        // ✅ Solo los IDs del formulario — nunca de la sesión en vivo
        mvpIdsJugadores:    [...mvpIdsJ],
        mvpIdsEntrenadores: [...mvpIdsE],
        votosJugadoresMVP:  {},
        partidos:partidosIncluidos,
        jugadores:[...new Set(partidosIncluidos.flatMap(p=>p.ids))].length,
        asistentes: [...new Set(partidosIncluidos.flatMap(p=>(p.ids||[])))].map(id=>{
            const j=db.jugadores.find(x=>String(x.id)===String(id));
            return j?{id:j.id,nombre:j.nombre,esInvitado:!!j.esInvitado}:null;
        }).filter(Boolean),
        esAdmin:true
    };
    if (!db.historicoJornadas) db.historicoJornadas=[];
    db.historicoJornadas.push(registroHistorico);

    if(typeof saveDB==='function') saveDB();
    if(typeof renderHistoricoGeneral==='function') renderHistoricoGeneral();
    if(typeof renderRanking==='function') renderRanking();
    if(typeof renderRankingEspecialistas==='function') renderRankingEspecialistas();
    if(typeof sincronizarTV==='function') sincronizarTV();

    alert(`✅ Jornada del ${fecha} archivada.${mvpStr?' MVP(s): '+mvpStr:''}`);
    admPartidosSesion=[];
    renderAdmListaRegistrados();
    renderAdmPartidosParaJornada();
    renderJornadaMvpDual([], []);
}

// ══════════════════════════════════════════════════════════════
// MIGRACIÓN: jornada 26/04/2026 — gamificado → tie-break
// Convierte todos los partidos gamificados de esa jornada a
// modo dobles con tie-break activo, y recalcula el ranking.
// ══════════════════════════════════════════════════════════════
// ── RESTAURAR BACKUP JSON ──────────────────────────────────
// Solo modifica la jornada del 24/04/2026 y los puntos de jugadores.
// El resto de la DB (jornadas, partidos de otros días, convocatoria, etc.) no se toca.
function restaurarBackupJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const status = document.getElementById('backup-restore-status');
    if (status) status.textContent = '⏳ Leyendo archivo...';

    const reader = new FileReader();
    reader.onload = function(e) {
        let datos;
        try { datos = JSON.parse(e.target.result); }
        catch(err) {
            if (status) status.textContent = '❌ JSON inválido: ' + err.message;
            return;
        }

        const jugadoresBackup = Array.isArray(datos.jugadores)
            ? datos.jugadores
            : Object.values(datos.jugadores || {});

        if (!jugadoresBackup.length) {
            if (status) status.textContent = '❌ El archivo no contiene jugadores.';
            return;
        }

        // ── Construir mapa id → puntosTotales del backup ─────────────
        const puntosBackup = {};
        jugadoresBackup.forEach(j => {
            puntosBackup[String(j.id)] = j.puntosTotales || 0;
        });

        // ── Resumen de cambios ────────────────────────────────────────
        const jugActuales = Array.isArray(db.jugadores)
            ? db.jugadores : Object.values(db.jugadores || {});

        const cambios = jugActuales
            .map(j => {
                const nuevo = puntosBackup[String(j.id)];
                if (nuevo === undefined) return null;
                const viejo = j.puntosTotales || 0;
                return { nombre: j.nombre, viejo, nuevo, diff: nuevo - viejo };
            })
            .filter(Boolean)
            .filter(c => c.diff !== 0);

        const resumenCambios = cambios.length > 0
            ? cambios.map(c => `  • ${c.nombre}: ${c.viejo} → ${c.nuevo} (${c.diff > 0 ? '+' : ''}${c.diff})`).join('\n')
            : '  (ningún cambio en puntos)';

        if (!confirm(
            `📥 ACTUALIZAR PUNTOS DE RANKING\n\n` +
            `Archivo: ${file.name}\n\n` +
            `Cambios en puntosTotales:\n${resumenCambios}\n\n` +
            `⚠️ Solo se modifican los puntos. Jornadas, partidos, habilidades\n` +
            `y stats NO se tocan.\n\n¿Continuar?`
        )) {
            input.value = '';
            if (status) status.textContent = 'Cancelado.';
            return;
        }

        if (status) status.textContent = '⏳ Actualizando puntos...';

        // ── Solo actualizar puntosTotales en cada jugador ────────────
        // Usamos multi-path update para tocar únicamente ese campo
        const updates = {};
        jugActuales.forEach((j, idx) => {
            const nuevo = puntosBackup[String(j.id)];
            if (nuevo !== undefined) {
                updates[`torneoPlatinum/jugadores/${idx}/puntosTotales`] = nuevo;
            }
        });

        if (Object.keys(updates).length === 0) {
            if (status) status.textContent = '⚠️ No hay cambios que aplicar.';
            return;
        }

        database.ref().update(updates)
            .then(() => {
                if (status) {
                    status.textContent = `✅ Puntos actualizados: ${Object.keys(updates).length} jugadores.`;
                    status.style.color = '#155724';
                }
                input.value = '';
                // Actualizar db local y re-renderizar sin recargar
                jugActuales.forEach(j => {
                    const nuevo = puntosBackup[String(j.id)];
                    if (nuevo !== undefined) j.puntosTotales = nuevo;
                });
                if (typeof renderRanking === 'function') renderRanking();
                if (typeof renderRankingEspecialistas === 'function') renderRankingEspecialistas();
                if (typeof renderHistoricoGeneral === 'function') renderHistoricoGeneral();
                alert('✅ Puntos de ranking actualizados correctamente.\nEl ranking se ha refrescado.');
            })
            .catch(err => {
                console.error('Error actualizando puntos:', err);
                if (status) {
                    status.textContent = '❌ Error: ' + err.message;
                    status.style.color = '#721c24';
                }
                input.value = '';
            });
    };
    reader.readAsText(file);
}

function migrarJornada24Abril() {
    const FECHA_OBJETIVO = ['2026-04-24', '24/4/2026', '24/04/2026'];
    const jornada = (db.historicoJornadas || []).find(j =>
        FECHA_OBJETIVO.some(f => j.fecha === f)
    );

    if (!jornada) {
        alert('⚠️ No se encontró ninguna jornada del 26/04/2026 en el historial.');
        return;
    }

    const partidos = Array.isArray(jornada.partidos)
        ? jornada.partidos
        : Object.values(jornada.partidos || {});

    const gamificados = partidos.filter(p => p.tipo === 'gamificado' || p.gamified);
    if (!gamificados.length) {
        alert('⚠️ No hay partidos gamificados en la jornada del 26/04/2026. Ya puede estar migrada.');
        return;
    }

    const confirm1 = confirm(
        `🔄 MIGRACIÓN JORNADA 24/04/2026\n\n` +
        `Se encontraron ${gamificados.length} partido(s) gamificado(s).\n\n` +
        `Esta operación:\n` +
        `① Revertirá los puntos aplicados como gamificado\n` +
        `② Convertirá cada partido a modo dobles (o el modo que corresponda) con tie-break\n` +
        `③ Necesitarás editar cada partido para introducir los puntos TB reales\n\n` +
        `¿Continuar?`
    );
    if (!confirm1) return;

    // ── Paso 1: revertir puntos actuales de todos los partidos de la jornada ──
    partidos.forEach(p => {
        if (typeof revertirPuntosPartido === 'function') revertirPuntosPartido(p);
    });
    // Revertir MVPs de jornada
    if (typeof revertirMvpsDual === 'function') revertirMvpsDual(jornada);

    // ── Paso 2: convertir gamificados a dobles+tiebreak ──────────────────────
    const idx = Array.isArray(jornada.partidos) ? null : null;
    const arr = Array.isArray(jornada.partidos) ? jornada.partidos : Object.values(jornada.partidos || {});

    arr.forEach((p, i) => {
        if (p.tipo !== 'gamificado' && !p.gamified) return;

        // Determinar modo según número de jugadores
        const n = (p.ids || []).length;
        let nuevoTipo = 'dobles';
        let nuevoTamanoEquipoA = null;
        if (n === 2) { nuevoTipo = 'individual'; }
        else if (n === 4) { nuevoTipo = 'dobles'; nuevoTamanoEquipoA = 2; }
        else if (n === 6) { nuevoTipo = 'trios'; nuevoTamanoEquipoA = 3; }
        else if (n === 3) { nuevoTipo = 'dobles'; nuevoTamanoEquipoA = Math.ceil(n/2); }
        else { nuevoTipo = 'dobles'; nuevoTamanoEquipoA = Math.floor(n/2); }

        const gN = id => db.jugadores.find(j => String(j.id) === String(id))?.nombre || '???';
        const idsA = (p.ids || []).slice(0, nuevoTamanoEquipoA ?? Math.floor(n/2));
        const idsB = (p.ids || []).slice(nuevoTamanoEquipoA ?? Math.floor(n/2));
        let nombres = '';
        if (nuevoTipo === 'individual') nombres = `${gN(p.ids[0])} vs ${gN(p.ids[1])}`;
        else if (nuevoTipo === 'trios') nombres = `${idsA.map(gN).join('+')} vs ${idsB.map(gN).join('+')}`;
        else nombres = `${idsA.map(gN).join('/')} vs ${idsB.map(gN).join('/')}`;

        // Convertir in-place
        p.tipo         = nuevoTipo;
        p.gamified     = false;
        p.tiebreak     = true;
        p.tbPuntosA    = 0;   // Admin deberá editar para poner los reales
        p.tbPuntosB    = 0;
        p.juegosA      = 0;
        p.juegosB      = 0;
        p.marcador     = 'TB 0-0 (editar)';
        p.nombres      = nombres;
        p.tamanoEquipoA = nuevoTamanoEquipoA;
        delete p.puntosGamificados;
        if (Array.isArray(jornada.partidos)) {
            jornada.partidos[i] = p;
        }
    });

    // Si partidos era objeto Firebase, reconstruirlo como array
    if (!Array.isArray(jornada.partidos)) {
        jornada.partidos = Object.values(jornada.partidos || {});
    }

    // ── Paso 3: reaplicar MVPs de jornada ────────────────────────────────────
    if (typeof aplicarMvpsDual === 'function') aplicarMvpsDual(jornada);

    // ── Paso 4: guardar en Firebase ───────────────────────────────────────────
    _saveDirectFirebase(() => {
        if (typeof renderHistoricoGeneral === 'function') renderHistoricoGeneral();
        if (typeof renderRanking === 'function') renderRanking();
        if (typeof renderAdmHistorialGlobal === 'function') renderAdmHistorialGlobal();
    });

    alert(
        `✅ Migración completada.\n\n` +
        `${gamificados.length} partido(s) convertidos a tie-break.\n\n` +
        `⚠️ IMPORTANTE: Los puntos TB están en 0-0.\n` +
        `Abre cada partido con ✏️ Editar, marca "Activar tie-break" e introduce\n` +
        `los puntos reales de cada partido. Los puntos de ranking se recalcularán\n` +
        `automáticamente al guardar.`
    );
}

// ── HISTORIAL GLOBAL EDITABLE ──────────────────────────────
function renderAdmHistorialGlobal() {
    const cont=document.getElementById('adm-historial-global-container');
    if (!cont) return;
    const historico=db.historicoJornadas||[];
    if (!historico.length) { cont.innerHTML='<p style="text-align:center;color:#999;padding:30px;font-style:italic;">No hay jornadas archivadas.</p>'; return; }
    const ordenado=[...historico].sort((a,b)=>(b.id||0)-(a.id||0));
    const gN=id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'???';

    // ✅ FIX: normalizar fecha ISO "2026-04-17" → "17/4/2026"
    function _normFecha(f) {
        if (!f) return '—';
        const iso = f.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (iso) return `${parseInt(iso[3])}/${parseInt(iso[2])}/${iso[1]}`;
        return f;
    }

    cont.innerHTML=ordenado.map(jornada=>{
        const partidos=jornada.partidos||[];
        const fechaDisplay=_normFecha(jornada.fecha) || new Date(jornada.id).toLocaleDateString('es-ES');
        const jornadaId=jornada.id;
        // Display MVPs: soporte fuentes duales (jugadores + entrenadores) con fallback legacy
        const jornadaMvpDisplay=(()=>{
            const mJ = Array.isArray(jornada.mvpIdsJugadores)    && jornada.mvpIdsJugadores.length    ? `🗳️ ${jornada.mvpIdsJugadores.map(gN).join(', ')}` : '';
            const mE = Array.isArray(jornada.mvpIdsEntrenadores) && jornada.mvpIdsEntrenadores.length ? `👨‍🏫 ${jornada.mvpIdsEntrenadores.map(gN).join(', ')}` : '';
            if (mJ || mE) return [mJ, mE].filter(Boolean).join(' · ');
            if (Array.isArray(jornada.mvpIds)&&jornada.mvpIds.length) return jornada.mvpIds.map(gN).join(', ');
            if (jornada.mvp&&jornada.mvp!=='---') return jornada.mvp;
            return '';
        })();
        const curMvpIdsJornada=Array.isArray(jornada.mvpIds)?jornada.mvpIds:(jornada.mvpId?[String(jornada.mvpId)]:[]);

        const partidosHTML=!partidos.length
            ?'<p style="color:#aaa;font-size:0.8rem;font-style:italic;padding:10px 0;">Sin partidos registrados.</p>'
            :partidos.map(p=>{
                const colores={dobles:'#001e3c',individual:'#0056b3',trios:'#C5A059',gamificado:'#00d4ff',asimetrico:'#ff6b35',equipos3:'#a78bfa'};
                const color=colores[p.tipo]||'#001e3c';
                const pMvpNombres=getMvpIds(p).map(gN).filter(Boolean);
                const modoLabel = {
                    'dobles':'🎾 Dobles', 'individual':'🤺 Individual',
                    'trios':'🔱 Tríos', 'gamificado':'🎮 Gamificado',
                    'asimetrico':'⚡ Asimétrico', 'equipos3':'🔄 Australiana'
                }[p.tipo] || (p.gamified ? '🎮 Gamificado' : (p.tipo || '🎾 Dobles'));
                return `<div style="display:flex;justify-content:space-between;align-items:center;
                                padding:9px 12px;border-radius:8px;border-left:4px solid ${color};
                                background:#f8f9fa;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.65rem;color:#888;font-weight:800;text-transform:uppercase;">
                            ${modoLabel}${p.fecha?' · '+p.fecha:''}
                            ${pMvpNombres.length?`<span style="color:#C5A059;margin-left:6px;">👑 ${pMvpNombres.join(', ')}</span>`:''}
                        </div>
                        <div style="font-weight:800;color:#001e3c;font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            ${escapeHtml(p.nombres||'Partido')}
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                        <span style="font-family:monospace;font-weight:900;background:#fff;padding:3px 9px;border-radius:6px;border:1px solid #ddd;font-size:0.95rem;">
                            ${p.marcador||'0-0'}
                        </span>
                        <button class="adm-btn-edit" onclick="abrirEditarPartidoHistorial('${jornadaId}','${p.id}')">✏️</button>
                        <button class="adm-btn-del"  onclick="eliminarPartidoHistorial('${jornadaId}','${p.id}')">🗑️</button>
                    </div>
                </div>`;
            }).join('');

        return `<div class="adm-jornada-block">
            <div class="adm-jornada-header" onclick="toggleAdmJornada('adm-j-${jornadaId}')">
                <div>
                    <span style="font-weight:800;color:#001e3c;">📅 ${fechaDisplay}</span>
                    ${jornadaMvpDisplay?`<span style="font-size:0.72rem;color:#C5A059;font-weight:700;margin-left:8px;">👑 ${jornadaMvpDisplay}</span>`:''}
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:0.75rem;color:#888;font-weight:700;">${partidos.length} partidos</span>
                    <button class="adm-btn-del" onclick="event.stopPropagation();eliminarJornadaHistorial('${jornadaId}')"
                            style="font-size:0.68rem;padding:3px 8px;">🗑️ Jornada</button>
                    <span style="color:#aaa;font-size:0.9rem;">▼</span>
                </div>
            </div>
            <div class="adm-jornada-body" id="adm-j-${jornadaId}">
                ${partidosHTML}
                <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #eee;">
                    <label style="font-size:0.72rem;font-weight:800;color:#555;text-transform:uppercase;display:block;margin-bottom:8px;">
                        👑 MVPs de Jornada (edición)
                    </label>

                    <!-- MVP JUGADORES -->
                    <div style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:8px;padding:10px;margin-bottom:8px;">
                        <div style="font-size:0.68rem;font-weight:900;color:#065f46;letter-spacing:1px;margin-bottom:6px;">🗳️ MVP JUGADORES (+3 pts)</div>
                        <div id="jornada-mvpJ-checks-${jornadaId}" style="max-height:120px;overflow-y:auto;padding:4px;">
                            ${(db.jugadores||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(j=>`
                                <label style="display:flex;align-items:center;gap:8px;padding:3px 4px;cursor:pointer;border-radius:5px;"
                                       onmouseover="this.style.background='#d1fae5'" onmouseout="this.style.background=''">
                                    <input type="checkbox" value="${j.id}" class="jornada-mvpJ-check"
                                           ${(Array.isArray(jornada.mvpIdsJugadores)?jornada.mvpIdsJugadores:[]).includes(String(j.id))?'checked':''}
                                           style="width:15px;height:15px;cursor:pointer;accent-color:#10ac84;">
                                    <span style="font-size:0.85rem;font-weight:600;">${escapeHtml(j.nombre)}</span>
                                </label>`).join('')}
                        </div>
                    </div>

                    <!-- MVP ENTRENADORES -->
                    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px;margin-bottom:8px;">
                        <div style="font-size:0.68rem;font-weight:900;color:#92400e;letter-spacing:1px;margin-bottom:6px;">👨‍🏫 MVP ENTRENADORES (+2 pts)</div>
                        <div id="jornada-mvpE-checks-${jornadaId}" style="max-height:120px;overflow-y:auto;padding:4px;">
                            ${(db.jugadores||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(j=>`
                                <label style="display:flex;align-items:center;gap:8px;padding:3px 4px;cursor:pointer;border-radius:5px;"
                                       onmouseover="this.style.background='#fef3c7'" onmouseout="this.style.background=''">
                                    <input type="checkbox" value="${j.id}" class="jornada-mvpE-check"
                                           ${(Array.isArray(jornada.mvpIdsEntrenadores)?jornada.mvpIdsEntrenadores:[]).includes(String(j.id))?'checked':''}
                                           style="width:15px;height:15px;cursor:pointer;accent-color:#C5A059;">
                                    <span style="font-size:0.85rem;font-weight:600;">${escapeHtml(j.nombre)}</span>
                                </label>`).join('')}
                        </div>
                    </div>

                    <button onclick="guardarMvpJornada('${jornadaId}')" class="adm-btn-edit" style="width:100%;padding:7px;">
                        💾 Guardar MVPs de Jornada
                    </button>
                </div>

                <!-- ➕ AÑADIR PARTIDO A ESTA JORNADA -->
                <div style="margin-top:10px;padding-top:10px;border-top:2px dashed #c3e6cb;">
                    <button onclick="toggleFormNuevoPartidoHistorial('${jornadaId}')"
                            style="width:100%;padding:9px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:8px;
                                   color:#1b5e20;font-weight:800;font-size:0.82rem;cursor:pointer;letter-spacing:0.5px;">
                        ➕ Añadir partido a esta jornada
                    </button>
                    <div id="form-nuevo-partido-${jornadaId}" style="display:none;margin-top:10px;background:#f0fdf4;
                             border:1px solid #a7f3d0;border-radius:10px;padding:14px;">
                        <div style="font-size:0.72rem;font-weight:900;color:#065f46;letter-spacing:1px;margin-bottom:10px;">
                            ➕ NUEVO PARTIDO — ${fechaDisplay}
                        </div>

                        <!-- Modalidad -->
                        <div style="margin-bottom:8px;">
                            <label style="font-size:0.72rem;font-weight:700;color:#555;display:block;margin-bottom:3px;">🎾 Modalidad</label>
                            <select id="np-modalidad-${jornadaId}" class="atp-input" style="font-size:0.82rem;"
                                    onchange="actualizarFormNuevoPartidoHistorial('${jornadaId}')">
                                <option value="dobles">🎾 Dobles (2v2)</option>
                                <option value="individual">🤺 Individual (1v1)</option>
                                <option value="trios">🔱 Tríos (3v3)</option>
                                <option value="asimetrico">⚡ Asimétrico</option>
                                <option value="equipos3">🔄 Australiana (3 jug.)</option>
                                <option value="gamificado">🎮 Gamificado</option>
                            </select>
                        </div>

                        <!-- Pista -->
                        <div style="margin-bottom:8px;">
                            <label style="font-size:0.72rem;font-weight:700;color:#555;display:block;margin-bottom:3px;">🏟️ Pista (opcional)</label>
                            <input id="np-pista-${jornadaId}" type="text" class="atp-input" placeholder="Ej: 1" style="font-size:0.82rem;">
                        </div>

                        <!-- Jugadores dinámicos -->
                        <div id="np-jugadores-${jornadaId}" style="margin-bottom:8px;"></div>

                        <!-- Resultado dinámico -->
                        <div id="np-resultado-${jornadaId}" style="margin-bottom:8px;"></div>

                        <!-- Tie-break (modos no gamificado/australiana) -->
                        <div id="np-tb-${jornadaId}" style="margin-bottom:8px;display:none;">
                            <label style="font-size:0.72rem;font-weight:700;color:#555;display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                                🎾 Tie-break
                                <label style="display:flex;align-items:center;gap:5px;font-weight:600;font-size:0.78rem;cursor:pointer;">
                                    <input type="checkbox" id="np-tb-activo-${jornadaId}"
                                           onchange="toggleNpTB('${jornadaId}')"
                                           style="width:15px;height:15px;cursor:pointer;accent-color:#0056b3;">
                                    Activar modo tie-break
                                </label>
                            </label>
                            <div id="np-tb-section-${jornadaId}" style="display:none;background:rgba(0,86,179,0.06);
                                 border:1px solid rgba(0,86,179,0.25);border-radius:8px;padding:10px;margin-top:6px;">
                                <div style="font-size:0.62rem;font-weight:900;color:#0056b3;margin-bottom:8px;">Puntos del tie-break</div>
                                <div style="display:flex;align-items:center;gap:12px;">
                                    <div style="text-align:center;">
                                        <div style="font-size:0.6rem;font-weight:800;color:#555;margin-bottom:3px;">EQUIPO A</div>
                                        <input type="number" id="np-tb-A-${jornadaId}" value="0" min="0"
                                               class="atp-input" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;">
                                    </div>
                                    <span style="font-size:1rem;font-weight:900;color:#aaa;">TB</span>
                                    <div style="text-align:center;">
                                        <div style="font-size:0.6rem;font-weight:800;color:#555;margin-bottom:3px;">EQUIPO B</div>
                                        <input type="number" id="np-tb-B-${jornadaId}" value="0" min="0"
                                               class="atp-input" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;">
                                    </div>
                                </div>
                                <div style="font-size:0.65rem;color:#888;margin-top:6px;font-style:italic;">
                                    Si juegos son 0-0, los puntos TB son el resultado del partido.
                                </div>
                            </div>
                        </div>

                        <!-- MVP -->
                        <div style="margin-bottom:10px;">
                            <label style="font-size:0.72rem;font-weight:700;color:#555;display:block;margin-bottom:3px;">👑 MVP jugadores (+3pts)</label>
                            <div id="np-mvpJ-${jornadaId}" style="max-height:90px;overflow-y:auto;border:1px solid #eee;border-radius:6px;padding:4px;background:white;">
                                ${(db.jugadores||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(j=>`
                                <label style="display:flex;align-items:center;gap:6px;padding:2px 4px;cursor:pointer;font-size:0.82rem;">
                                    <input type="checkbox" value="${j.id}" class="np-mvpJ-check-${jornadaId}" style="cursor:pointer;">
                                    ${escapeHtml(j.nombre)}
                                </label>`).join('')}
                            </div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:0.72rem;font-weight:700;color:#555;display:block;margin-bottom:3px;">👨‍🏫 MVP entrenadores (+2pts)</label>
                            <div id="np-mvpE-${jornadaId}" style="max-height:90px;overflow-y:auto;border:1px solid #eee;border-radius:6px;padding:4px;background:white;">
                                ${(db.jugadores||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(j=>`
                                <label style="display:flex;align-items:center;gap:6px;padding:2px 4px;cursor:pointer;font-size:0.82rem;">
                                    <input type="checkbox" value="${j.id}" class="np-mvpE-check-${jornadaId}" style="cursor:pointer;">
                                    ${escapeHtml(j.nombre)}
                                </label>`).join('')}
                            </div>
                        </div>

                        <div style="display:flex;gap:8px;">
                            <button onclick="guardarNuevoPartidoEnJornada('${jornadaId}')"
                                    style="flex:2;padding:10px;background:#10ac84;color:white;border:none;border-radius:8px;
                                           font-weight:900;font-size:0.82rem;cursor:pointer;">
                                💾 Guardar y aplicar puntos
                            </button>
                            <button onclick="toggleFormNuevoPartidoHistorial('${jornadaId}')"
                                    style="flex:1;padding:10px;background:#eee;color:#555;border:none;border-radius:8px;
                                           font-weight:700;font-size:0.8rem;cursor:pointer;">
                                Cancelar
                            </button>
                        </div>
                        <div id="np-feedback-${jornadaId}" style="display:none;margin-top:8px;padding:8px;border-radius:6px;font-size:0.8rem;font-weight:700;text-align:center;"></div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function toggleAdmJornada(id) {
    const el=document.getElementById(id);
    if (el) el.classList.toggle('open');
}

// ── FORMULARIO INLINE: NUEVO PARTIDO EN JORNADA ARCHIVADA ──

function toggleFormNuevoPartidoHistorial(jornadaId) {
    const form = document.getElementById(`form-nuevo-partido-${jornadaId}`);
    if (!form) return;
    const visible = form.style.display !== 'none';
    form.style.display = visible ? 'none' : 'block';
    if (!visible) {
        // Al abrir, construir el formulario de jugadores según modalidad inicial (dobles)
        actualizarFormNuevoPartidoHistorial(jornadaId);
        // Mostrar sección TB (dobles es la modalidad inicial)
        const tbCont = document.getElementById(`np-tb-${jornadaId}`);
        if (tbCont) tbCont.style.display = 'block';
    }
}

function actualizarFormNuevoPartidoHistorial(jornadaId) {
    const modalidad = document.getElementById(`np-modalidad-${jornadaId}`)?.value || 'dobles';
    const jugadoresCont = document.getElementById(`np-jugadores-${jornadaId}`);
    const resultadoCont = document.getElementById(`np-resultado-${jornadaId}`);
    if (!jugadoresCont || !resultadoCont) return;

    const opts = '<option value="">-- Jugador --</option>' +
        (db.jugadores||[]).slice().sort((a,b)=>a.nombre.localeCompare(b.nombre))
        .map(j=>`<option value="${j.id}">${escapeHtml(j.nombre)}</option>`).join('');

    const sel = (equipo, pos, label) =>
        `<div style="margin-bottom:4px;">
            <div style="font-size:0.65rem;font-weight:800;color:#555;margin-bottom:2px;">${label}</div>
            <select class="atp-input np-jugador-${jornadaId}" data-equipo="${equipo}" style="font-size:0.82rem;">${opts}</select>
        </div>`;

    let jugHtml = '', resHtml = '';

    if (modalidad === 'dobles') {
        jugHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="border-left:3px solid #001e3c;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#001e3c;margin-bottom:4px;">EQUIPO A</div>
                ${sel('A',1,'Jugador 1')}${sel('A',2,'Jugador 2')}
            </div>
            <div style="border-left:3px solid #C5A059;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#C5A059;margin-bottom:4px;">EQUIPO B</div>
                ${sel('B',1,'Jugador 3')}${sel('B',2,'Jugador 4')}
            </div></div>`;
        resHtml = `<div style="display:flex;gap:8px;align-items:center;">
            <input id="np-score-A-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;" placeholder="A">
            <span style="font-weight:900;color:#aaa;">—</span>
            <input id="np-score-B-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;" placeholder="B">
        </div>`;
    } else if (modalidad === 'individual') {
        jugHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>${sel('A',1,'Jugador A')}</div>
            <div>${sel('B',1,'Jugador B')}</div></div>`;
        resHtml = `<div style="display:flex;gap:8px;align-items:center;">
            <input id="np-score-A-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;">
            <span style="font-weight:900;color:#aaa;">—</span>
            <input id="np-score-B-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;">
        </div>`;
    } else if (modalidad === 'trios') {
        jugHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="border-left:3px solid #001e3c;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#001e3c;margin-bottom:4px;">EQUIPO A</div>
                ${sel('A',1,'J1')}${sel('A',2,'J2')}${sel('A',3,'J3')}
            </div>
            <div style="border-left:3px solid #C5A059;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#C5A059;margin-bottom:4px;">EQUIPO B</div>
                ${sel('B',1,'J4')}${sel('B',2,'J5')}${sel('B',3,'J6')}
            </div></div>`;
        resHtml = `<div style="display:flex;gap:8px;align-items:center;">
            <input id="np-score-A-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;">
            <span style="font-weight:900;color:#aaa;">—</span>
            <input id="np-score-B-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;">
        </div>`;
    } else if (modalidad === 'asimetrico') {
        jugHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="border-left:3px solid #ff6b35;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#ff6b35;margin-bottom:4px;">⚡ EQUIPO A</div>
                ${sel('A',1,'J1')}${sel('A',2,'J2 (opcional)')}${sel('A',3,'J3 (opcional)')}
            </div>
            <div style="border-left:3px solid #C5A059;padding-left:8px;">
                <div style="font-size:0.65rem;font-weight:900;color:#C5A059;margin-bottom:4px;">EQUIPO B</div>
                ${sel('B',1,'J4')}${sel('B',2,'J5 (opcional)')}
            </div></div>`;
        resHtml = `<div style="display:flex;gap:8px;align-items:center;">
            <input id="np-score-A-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;">
            <span style="font-weight:900;color:#aaa;">—</span>
            <input id="np-score-B-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="width:60px;text-align:center;font-size:1.1rem;font-weight:900;">
        </div>`;
    } else if (modalidad === 'equipos3') {
        jugHtml = `<div style="font-size:0.65rem;font-weight:800;color:#a78bfa;margin-bottom:4px;">🔄 3 jugadores — la australiana rota automáticamente</div>
            ${sel('A',1,'Jugador 1')}${sel('A',2,'Jugador 2')}${sel('A',3,'Jugador 3')}
            <div style="margin-top:8px;background:#f5f0ff;border-radius:8px;padding:10px;">
                <div style="font-size:0.65rem;font-weight:700;color:#a78bfa;margin-bottom:6px;">🎾 Juegos acumulados (totales de todas las rondas):</div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
                    <div><div style="font-size:0.6rem;color:#a78bfa;font-weight:700;margin-bottom:2px;">J1</div><input id="np-aus-0-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="text-align:center;font-size:0.9rem;font-weight:900;"></div>
                    <div><div style="font-size:0.6rem;color:#a78bfa;font-weight:700;margin-bottom:2px;">J2</div><input id="np-aus-1-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="text-align:center;font-size:0.9rem;font-weight:900;"></div>
                    <div><div style="font-size:0.6rem;color:#a78bfa;font-weight:700;margin-bottom:2px;">J3</div><input id="np-aus-2-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="text-align:center;font-size:0.9rem;font-weight:900;"></div>
                </div>
                <div style="background:#fff8f0;border-radius:6px;padding:8px;">
                    <div style="font-size:0.65rem;font-weight:700;color:#ff6b35;margin-bottom:4px;">⚡ Juegos ganados <b>siendo solo</b> (opcional — para el bonus David vs Goliat)</div>
                    <div style="font-size:0.6rem;color:#888;margin-bottom:6px;">Si el ganador jugó más rondas solo que en pareja, recibe +1pt bonus.</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
                        <div><div style="font-size:0.6rem;color:#ff6b35;font-weight:700;margin-bottom:2px;">J1 solo</div><input id="np-aus-solo-0-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="text-align:center;font-size:0.9rem;"></div>
                        <div><div style="font-size:0.6rem;color:#ff6b35;font-weight:700;margin-bottom:2px;">J2 solo</div><input id="np-aus-solo-1-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="text-align:center;font-size:0.9rem;"></div>
                        <div><div style="font-size:0.6rem;color:#ff6b35;font-weight:700;margin-bottom:2px;">J3 solo</div><input id="np-aus-solo-2-${jornadaId}" type="number" min="0" class="atp-input" value="0" style="text-align:center;font-size:0.9rem;"></div>
                    </div>
                </div>
            </div>`;
        resHtml = '';
    } else if (modalidad === 'gamificado') {
        jugHtml = `<div style="font-size:0.65rem;font-weight:800;color:#00d4ff;margin-bottom:4px;">🎮 Selecciona participantes y sus puntos</div>
            ${[1,2,3,4,5,6].map(i=>`
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
                <select class="atp-input np-jugador-${jornadaId}" data-equipo="G" style="flex:2;font-size:0.82rem;">${opts}</select>
                <input id="np-gam-pts-${i}-${jornadaId}" type="number" min="0" value="0" class="atp-input"
                       style="width:55px;text-align:center;font-size:0.9rem;font-weight:900;" placeholder="pts">
            </div>`).join('')}`;
        resHtml = `<input id="np-gam-resultado-${jornadaId}" type="text" class="atp-input"
                          value="ÉXITO 🏆" style="font-size:0.82rem;" placeholder="Resultado general">`;
    }

    jugadoresCont.innerHTML = `<label style="font-size:0.72rem;font-weight:700;color:#555;display:block;margin-bottom:4px;">👥 Jugadores</label>${jugHtml}`;
    resultadoCont.innerHTML = resHtml ? `<label style="font-size:0.72rem;font-weight:700;color:#555;display:block;margin-bottom:4px;">📊 Resultado</label>${resHtml}` : '';

    // ── Tie-break (todos los modos menos gamificado y australiana) ──
    const tbCont = document.getElementById(`np-tb-${jornadaId}`);
    if (tbCont) {
        const muestraTB = !['gamificado','equipos3'].includes(modalidad);
        tbCont.style.display = muestraTB ? 'block' : 'none';
        // Reset al cambiar modalidad
        const cbTB = document.getElementById(`np-tb-activo-${jornadaId}`);
        if (cbTB) { cbTB.checked = false; }
        const secTB = document.getElementById(`np-tb-section-${jornadaId}`);
        if (secTB) { secTB.style.display = 'none'; }
    }
}

function toggleNpTB(jornadaId) {
    const cb  = document.getElementById(`np-tb-activo-${jornadaId}`);
    const sec = document.getElementById(`np-tb-section-${jornadaId}`);
    if (sec) sec.style.display = cb?.checked ? 'block' : 'none';
}

function guardarNuevoPartidoEnJornada(jornadaId) {
    // ✅ FIX BUG IDEMPOTENCIA: guard contra doble click. Mismo problema que en
    // guardarPartidoAdmin: dos clicks rápidos creaban dos registros con ids
    // distintos, duplicando puntos en el ranking. Bloqueamos por jornada 1.5s.
    if (!window._guardarNuevoPartidoEnCurso) window._guardarNuevoPartidoEnCurso = {};
    if (window._guardarNuevoPartidoEnCurso[jornadaId]) {
        console.warn('Doble click ignorado: guardarNuevoPartidoEnJornada en curso');
        return;
    }
    window._guardarNuevoPartidoEnCurso[jornadaId] = true;
    setTimeout(() => { window._guardarNuevoPartidoEnCurso[jornadaId] = false; }, 1500);

    const jornada = (db.historicoJornadas||[]).find(j => String(j.id) === String(jornadaId));
    if (!jornada) return;

    const gN = id => db.jugadores.find(j=>String(j.id)===id)?.nombre||'???';
    const modalidad = document.getElementById(`np-modalidad-${jornadaId}`)?.value || 'dobles';
    const pista = document.getElementById(`np-pista-${jornadaId}`)?.value || 'ADM';
    const fecha = jornada.fecha || new Date(jornada.id).toLocaleDateString();

    // Leer jugadores
    let idsA=[], idsB=[], idsG=[];
    document.querySelectorAll(`.np-jugador-${jornadaId}`).forEach(sel => {
        if (!sel.value) return;
        const eq = sel.dataset.equipo;
        if (eq==='A') idsA.push(sel.value);
        else if (eq==='B') idsB.push(sel.value);
        else if (eq==='G') idsG.push(sel.value);
    });

    // Validación
    const feedback = id => {
        const el = document.getElementById(`np-feedback-${jornadaId}`);
        if (el) { el.textContent=id; el.style.display='block'; el.style.background='#f8d7da'; el.style.color='#721c24'; }
    };
    if (modalidad==='gamificado' && !idsG.length) return feedback('⚠️ Selecciona al menos un participante.');
    if (modalidad==='equipos3'  && !idsA.length)  return feedback('⚠️ Selecciona los 3 jugadores.');
    if (!['gamificado','equipos3'].includes(modalidad) && (!idsA.length||!idsB.length)) return feedback('⚠️ Selecciona jugadores en ambos equipos.');

    // Leer resultado
    let jA=0, jB=0, marcador='0-0', puntosGamificados={}, puntosAustraliana={}, juegosSoloAustraliana={};

    if (modalidad === 'gamificado') {
        [1,2,3,4,5,6].forEach((i,idx) => {
            const sel = document.querySelectorAll(`.np-jugador-${jornadaId}`)[idx];
            if (sel?.value) {
                const pts = parseInt(document.getElementById(`np-gam-pts-${i}-${jornadaId}`)?.value)||0;
                puntosGamificados[sel.value] = pts;
            }
        });
        marcador = document.getElementById(`np-gam-resultado-${jornadaId}`)?.value || 'ÉXITO 🏆';
    } else if (modalidad === 'equipos3') {
        const sels = document.querySelectorAll(`.np-jugador-${jornadaId}`);
        sels.forEach((sel, i) => {
            if (sel?.value) {
                puntosAustraliana[sel.value]      = parseInt(document.getElementById(`np-aus-${i}-${jornadaId}`)?.value)||0;
                juegosSoloAustraliana[sel.value]  = parseInt(document.getElementById(`np-aus-solo-${i}-${jornadaId}`)?.value)||0;
            }
        });
        idsA = Object.keys(puntosAustraliana); idsB = [];
        const haySolo = Object.values(juegosSoloAustraliana).some(v => v > 0);
        const maxP = Math.max(0, ...Object.values(puntosAustraliana).map(Number));
        marcador = Object.entries(puntosAustraliana)
            .sort((a,b) => b[1]-a[1])
            .map(([id,p]) => {
                const s = juegosSoloAustraliana[id] || 0;
                const esGanador = Number(p)===maxP && maxP>0;
                return haySolo
                    ? `${gN(id)}:${p}(solo:${s})${esGanador?' 🏆':''}`
                    : `${gN(id)}:${p}${esGanador?' 🏆':''}`;
            }).join(' · ');
    } else {
        jA = parseInt(document.getElementById(`np-score-A-${jornadaId}`)?.value)||0;
        jB = parseInt(document.getElementById(`np-score-B-${jornadaId}`)?.value)||0;
        marcador = `${jA}-${jB}`;
    }

    // ── Tie-break ──────────────────────────────────────────────
    const tbActivo = !['gamificado','equipos3'].includes(modalidad) &&
        (document.getElementById(`np-tb-activo-${jornadaId}`)?.checked || false);
    const npTbA = tbActivo ? (parseInt(document.getElementById(`np-tb-A-${jornadaId}`)?.value)||0) : 0;
    const npTbB = tbActivo ? (parseInt(document.getElementById(`np-tb-B-${jornadaId}`)?.value)||0) : 0;
    if (tbActivo && !['gamificado','equipos3'].includes(modalidad)) {
        marcador = jA === 0 && jB === 0
            ? `TB ${npTbA}-${npTbB}`
            : `${jA}-${jB} (TB ${npTbA}-${npTbB})`;
    }

    const allIds = modalidad==='gamificado' ? idsG : modalidad==='equipos3' ? [...idsA] : [...idsA,...idsB];
    if (!allIds.length) return feedback('⚠️ No hay jugadores seleccionados.');

    // Nombres
    const gNN = ids => ids.map(gN).join('+');
    let nombresStr = '';
    if (modalidad==='dobles')         nombresStr = `${gN(idsA[0])}/${gN(idsA[1])} vs ${gN(idsB[0])}/${gN(idsB[1])}`;
    else if (modalidad==='individual') nombresStr = `${gN(idsA[0])} vs ${gN(idsB[0])}`;
    else if (modalidad==='trios')      nombresStr = `${gNN(idsA)} vs ${gNN(idsB)}`;
    else if (modalidad==='asimetrico') nombresStr = `⚡ ${gNN(idsA)} vs ${gNN(idsB)} [${idsA.length}v${idsB.length}]`;
    else if (modalidad==='equipos3')   nombresStr = `🔄 Australiana: ${allIds.map(gN).join(' · ')}`;
    else                               nombresStr = `🎮 Gamificado (${idsG.length} jugadores)`;

    // MVPs
    const mvpIdsJ = Array.from(document.querySelectorAll(`.np-mvpJ-check-${jornadaId}:checked`)).map(cb=>cb.value);
    const mvpIdsE = Array.from(document.querySelectorAll(`.np-mvpE-check-${jornadaId}:checked`)).map(cb=>cb.value);
    const mvpIds  = [...new Set([...mvpIdsJ,...mvpIdsE])];

    const partido = {
        id: 'adm-' + Date.now() + '-' + Math.floor(Math.random()*1000),
        tipo: modalidad, gamified: modalidad==='gamificado',
        fecha, pista, nombres: nombresStr,
        ids: allIds, juegosA: jA, juegosB: jB, marcador,
        tamanoEquipoA: modalidad==='asimetrico' ? idsA.length : null,
        puntosGamificados: modalidad==='gamificado' ? puntosGamificados : {},
        puntosAustraliana: modalidad==='equipos3'   ? puntosAustraliana : undefined,
        juegosSoloAustraliana: modalidad==='equipos3' ? juegosSoloAustraliana : undefined,
        golpes: {}, mvpIds, mvpIdsJugadores: [...mvpIdsJ], mvpIdsEntrenadores: [...mvpIdsE],
        mvpId: null, esAdmin: true,
        tiebreak:  tbActivo || false,
        tbPuntosA: tbActivo ? npTbA : undefined,
        tbPuntosB: tbActivo ? npTbB : undefined,
        fin: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
    };

    // ✅ Aplicar puntos ranking + stats + MVPs con try/catch
    try {
        aplicarPuntosPartido(partido, idsA, idsB, idsG, false);
    } catch(e) {
        console.error('aplicarPuntosPartido error:', e);
        feedback(`⚠️ Error al calcular puntos: ${e.message}. El partido se guardará de todas formas.`);
    }

    try {
        aplicarMvps(mvpIdsJ, 3);
        mvpIdsE.filter(id=>!mvpIdsJ.includes(id)).forEach(id=>aplicarMvps([id],2));
    } catch(e) { console.error('aplicarMvps error:', e); }

    // Insertar en la jornada archivada
    if (!jornada.partidos) jornada.partidos = [];
    jornada.partidos.push(partido);
    try { recalcularAsistentesJornada(jornada); } catch(e) { console.warn(e); }

    // Mostrar feedback inmediatamente
    const fbEl = document.getElementById(`np-feedback-${jornadaId}`);
    if (fbEl) {
        fbEl.textContent = `⏳ Guardando: ${nombresStr} → ${marcador}...`;
        fbEl.style.display = 'block';
        fbEl.style.background = '#fff3cd';
        fbEl.style.color = '#856404';
    }

    // ✅ FIX CRÍTICO PERSISTENCIA: en lugar de saveDB() (que depende de window.*
    // y puede ser bloqueado por _guardandoDB), hacemos un snapshot profundo de db
    // y lo subimos directamente. Activamos _guardandoDB para bloquear el listener
    // y _njGuardadoReciente para el grace period post-guardado.
    if (!window._guardandoDB) window._guardandoDB = 0;
    window._guardandoDB++;
    const _dbSnapshot = JSON.parse(JSON.stringify(db));

    database.ref('torneoPlatinum').set(_dbSnapshot)
        .then(() => {
            window._guardandoDB = Math.max(0, window._guardandoDB - 1);
            // Grace period: bloquear el listener 3.5s para que Firebase propague
            window._njGuardadoReciente = Date.now();
            setTimeout(() => { window._njGuardadoReciente = null; }, 3500);
            console.log('✅ Partido guardado en Firebase:', nombresStr);

            try { if(typeof renderRanking==='function') renderRanking(); } catch(e) {}
            try { if(typeof renderRankingEspecialistas==='function') renderRankingEspecialistas(); } catch(e) {}
            try { if(typeof renderHistoricoGeneral==='function') renderHistoricoGeneral(); } catch(e) {}
            try { if(typeof sincronizarTV==='function') sincronizarTV(); } catch(e) {}
            renderAdmHistorialGlobal();
            alert(`✅ Partido añadido: ${nombresStr} → ${marcador}`);
        })
        .catch(err => {
            window._guardandoDB = Math.max(0, window._guardandoDB - 1);
            console.error('Error guardando partido en Firebase:', err);
            // Revertir el partido añadido para no dejar estado inconsistente
            jornada.partidos = jornada.partidos.filter(p => p.id !== partido.id);
            if (fbEl) {
                fbEl.textContent = `❌ Error al guardar: ${err.message}. Inténtalo de nuevo.`;
                fbEl.style.background = '#f8d7da';
                fbEl.style.color = '#721c24';
            }
        });
}


// ✅ FIX PERSISTENCIA ADMIN: helper que guarda directamente en Firebase con
// snapshot profundo + _guardandoDB + grace period, evitando la race condition
// donde el listener sobreescribe los cambios antes de que Firebase los propague.
function _saveDirectFirebase(onSuccess, onError) {
    if (!window._guardandoDB) window._guardandoDB = 0;
    window._guardandoDB++;
    const snap = JSON.parse(JSON.stringify(db));
    return database.ref('torneoPlatinum').set(snap)
        .then(() => {
            window._guardandoDB = Math.max(0, window._guardandoDB - 1);
            window._njGuardadoReciente = Date.now();
            setTimeout(() => { window._njGuardadoReciente = null; }, 3500);
            if (typeof onSuccess === 'function') onSuccess();
        })
        .catch(err => {
            window._guardandoDB = Math.max(0, window._guardandoDB - 1);
            console.error('Firebase save error:', err);
            if (typeof onError === 'function') onError(err);
            else alert('❌ Error al guardar: ' + err.message);
        });
}

function eliminarPartidoHistorial(jornadaId,partidoId) {
    const jornada=(db.historicoJornadas||[]).find(j=>String(j.id)===String(jornadaId));
    if (!jornada) return;
    const p=(jornada.partidos||[]).find(x=>String(x.id)===String(partidoId));
    if (!p) return;
    if (!confirm(`🗑️ ¿Eliminar "${p.nombres}" (${p.marcador}) y revertir sus puntos?`)) return;
    revertirPuntosPartido(p);
    jornada.partidos=jornada.partidos.filter(x=>String(x.id)!==String(partidoId));
    recalcularAsistentesJornada(jornada);
    _saveDirectFirebase(() => {
        if(typeof renderRanking==='function') renderRanking();
        if(typeof renderRankingEspecialistas==='function') renderRankingEspecialistas();
        if(typeof renderHistoricoGeneral==='function') renderHistoricoGeneral();
        renderAdmHistorialGlobal();
        alert('✅ Partido eliminado y puntos revertidos.');
    });
}

function eliminarJornadaHistorial(jornadaId) {
    const jornada=(db.historicoJornadas||[]).find(j=>String(j.id)===String(jornadaId));
    if (!jornada) return;
    const fecha=jornada.fecha||new Date(jornada.id).toLocaleDateString();
    if (!confirm(`⚠️ ¿Eliminar la jornada completa del ${fecha}?\nSe revertirán los puntos de TODOS sus partidos. No hay marcha atrás.`)) return;
    (jornada.partidos||[]).forEach(p=>revertirPuntosPartido(p));
    // Revertir también el bonus MVP de jornada usando fuentes duales
    revertirMvpsDual(jornada);
    db.historicoJornadas=(db.historicoJornadas||[]).filter(j=>String(j.id)!==String(jornadaId));
    _saveDirectFirebase(() => {
        if(typeof renderRanking==='function') renderRanking();
        if(typeof renderRankingEspecialistas==='function') renderRankingEspecialistas();
        if(typeof renderHistoricoGeneral==='function') renderHistoricoGeneral();
        renderAdmHistorialGlobal();
        alert('✅ Jornada eliminada.');
    });
}

function guardarMvpJornada(jornadaId) {
    const jornada=(db.historicoJornadas||[]).find(j=>String(j.id)===String(jornadaId));
    if (!jornada) return;

    // Leer selección separada jugadores / entrenadores
    const checksJ=document.querySelectorAll(`#jornada-mvpJ-checks-${jornadaId} .jornada-mvpJ-check:checked`);
    const checksE=document.querySelectorAll(`#jornada-mvpE-checks-${jornadaId} .jornada-mvpE-check:checked`);
    const nuevosJ=Array.from(checksJ).map(cb=>String(cb.value));
    const nuevosE=Array.from(checksE).map(cb=>String(cb.value));

    // Revertir puntos anteriores (dual)
    revertirMvpsDual(jornada);

    // Aplicar nuevos: jugadores +3, entrenadores +2
    // ASIMETRÍA-2 FIX: si alguien está en ambas listas, recibe +3 (jugador)
    // y NO recibe +2 adicional de entrenador. Antes se sumaban ambos (+5).
    nuevosJ.forEach(id=>{
        const j=(db.jugadores||[]).find(x=>String(x.id)===id);
        if(j){
            if (!j.esInvitado) j.puntosTotales=(j.puntosTotales||0)+3;
            j.stats=j.stats||{}; j.stats.mvps=(j.stats.mvps||0)+1;
        }
    });
    nuevosE.filter(id => !nuevosJ.includes(id)).forEach(id=>{
        const j=(db.jugadores||[]).find(x=>String(x.id)===id);
        if(j && !j.esInvitado) {
            j.puntosTotales=(j.puntosTotales||0)+2;
            // ✅ FIX BUG RANKING ICONO MVP-E desde admin: incrementar contador
            // separado para entrenadores. Antes solo se sumaban los puntos pero
            // no se actualizaba stats.mvpsEntrenador, así el ranking nunca
            // mostraba el icono 👨‍🏫 para MVPs asignados desde admin.
            j.stats=j.stats||{};
            j.stats.mvpsEntrenador=(j.stats.mvpsEntrenador||0)+1;
        }
    });

    // Persistir
    jornada.mvpIdsJugadores=[...nuevosJ];
    jornada.mvpIdsEntrenadores=[...nuevosE];
    jornada.votosJugadoresMVP={};
    const todos=[...new Set([...nuevosJ,...nuevosE])];
    jornada.mvpIds=[...todos];
    jornada.mvpId=null;
    jornada.mvp=todos.map(id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'?').join(', ')||'---';

    const rJ=nuevosJ.map(id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'?').join(', ')||'ninguno';
    const rE=nuevosE.map(id=>db.jugadores.find(j=>String(j.id)===id)?.nombre||'?').join(', ')||'ninguno';
    _saveDirectFirebase(() => {
        if(typeof renderRanking==='function') renderRanking();
        if(typeof renderRankingEspecialistas==='function') renderRankingEspecialistas();
        if(typeof renderHistoricoGeneral==='function') renderHistoricoGeneral();
        renderAdmHistorialGlobal();
        alert(`✅ MVPs guardados.\n🗳️ Jugadores: ${rJ}\n👨‍🏫 Entrenadores: ${rE}`);
    });
}

// ── Hook showSection para pestaña admin ───────────────────
const _origEjecutar = window.ejecutarActualizacionesPestaña;
window.ejecutarActualizacionesPestaña = function(id) {
    if (typeof _origEjecutar === 'function') _origEjecutar(id);
    if (id === 'admin-historico') {
        if (!adminDesbloqueado) {
            document.getElementById('admin-pin-screen').style.display = 'block';
            document.getElementById('admin-panel').style.display = 'none';
        } else {
            inicializarAdminPanel();
        }
    }
};

/**
 * ✅ FIX BUG RANKING ICONO MVP-E retroactivo:
 *
 * Recalcula stats.mvpsEntrenador para TODOS los jugadores desde cero,
 * leyendo el histórico de jornadas y los MVPs en vivo de la jornada actual.
 *
 * Por qué es necesario:
 *   El campo stats.mvpsEntrenador se introdujo recientemente. Los MVPs
 *   asignados antes de ese campo (especialmente desde admin-panel) no
 *   incrementaron el contador, así que el ranking no muestra el icono
 *   👨‍🏫 para esos jugadores aunque tengan los puntos +2 sumados.
 *
 *   Esta función recorre db.historicoJornadas y db.mvpIdsEntrenadores y
 *   recalcula el contador exacto. Idempotente: se puede ejecutar
 *   cuántas veces se quiera y siempre da el mismo resultado.
 *
 * Llamada automática:
 *   Se ejecuta una vez al cargar la app (si el rol es admin/árbitro y
 *   hay datos), reparando los datos antiguos. También se expone en
 *   window.recalcularMvpsEntrenador() para llamada manual desde DevTools.
 */
function recalcularMvpsEntrenador() {
    if (!db || !Array.isArray(db.jugadores)) return { ok: false, motivo: 'sin db' };

    // 1. Resetear contador de todos los jugadores
    db.jugadores.forEach(j => {
        if (!j.stats) j.stats = {};
        j.stats.mvpsEntrenador = 0;
    });

    // 2. Recorrer histórico de jornadas
    const historico = Array.isArray(db.historicoJornadas)
        ? db.historicoJornadas
        : Object.values(db.historicoJornadas || {});

    let totalIncrementos = 0;
    historico.forEach(jor => {
        if (!jor) return;
        const idsJ = Array.isArray(jor.mvpIdsJugadores)
            ? jor.mvpIdsJugadores.map(String)
            : [];
        const idsE = Array.isArray(jor.mvpIdsEntrenadores)
            ? jor.mvpIdsEntrenadores.map(String)
            : [];

        // Cada entrenador (que NO sea también jugador, para no doble-contar)
        // recibe +1 en su contador
        idsE.filter(id => !idsJ.includes(id)).forEach(id => {
            const j = db.jugadores.find(x => String(x.id) === id);
            if (j && !j.esInvitado) {
                j.stats.mvpsEntrenador = (j.stats.mvpsEntrenador || 0) + 1;
                totalIncrementos++;
            }
        });
    });

    // 3. MVPs en vivo de la jornada actual (si los hay)
    const mvpEHoy = Array.isArray(window.mvpIdsEntrenadores)
        ? window.mvpIdsEntrenadores.map(String)
        : [];
    const mvpJHoy = Array.isArray(window.mvpIdsJugadores)
        ? window.mvpIdsJugadores.map(String)
        : [];
    mvpEHoy.filter(id => !mvpJHoy.includes(id)).forEach(id => {
        const j = db.jugadores.find(x => String(x.id) === id);
        if (j && !j.esInvitado) {
            j.stats.mvpsEntrenador = (j.stats.mvpsEntrenador || 0) + 1;
            totalIncrementos++;
        }
    });

    console.log(`✅ recalcularMvpsEntrenador: ${totalIncrementos} contadores recalculados.`);
    return { ok: true, incrementos: totalIncrementos };
}
window.recalcularMvpsEntrenador = recalcularMvpsEntrenador;

/**
 * Auto-ejecuta la migración una vez al cargar la app.
 * Solo para admins/árbitros (que pueden persistir los cambios).
 * Marca un flag en db para no re-ejecutar en cada carga.
 */
function _autoRecalcularMvpsEntrenadorSiNecesario() {
    // Esperar a que llegue el primer snapshot Firebase
    if (!db || !Array.isArray(db.jugadores) || db.jugadores.length === 0) {
        setTimeout(_autoRecalcularMvpsEntrenadorSiNecesario, 1500);
        return;
    }
    // Si ya se hizo la migración, salir
    if (db._mvpsEntrenadorMigrado === true) return;
    // Solo admins/árbitros migran (los demás solo leen)
    if (window.rolUsuario !== 'admin' && window.rolUsuario !== 'arbitro') return;

    console.log('🔄 Ejecutando migración stats.mvpsEntrenador retroactiva...');
    const resultado = recalcularMvpsEntrenador();
    if (resultado.ok) {
        db._mvpsEntrenadorMigrado = true;
        if (typeof saveDB === 'function') saveDB();
        if (typeof renderRanking === 'function') renderRanking();
        console.log(`✅ Migración completada: ${resultado.incrementos} incrementos aplicados.`);
    }
}

// Disparar la migración tras la carga inicial (con un pequeño delay para
// que llegue el snapshot Firebase y el rol esté determinado).
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(_autoRecalcularMvpsEntrenadorSiNecesario, 3000);
        });
    } else {
        setTimeout(_autoRecalcularMvpsEntrenadorSiNecesario, 3000);
    }
}

