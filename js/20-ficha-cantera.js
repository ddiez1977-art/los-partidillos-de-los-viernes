/* ============================================================
   ATP PLATINUM — 20-ficha-cantera.js
   Ficha de jugador detallada, render de cantera, invitados, skills
   ── Refactor: extraído de script.js (líneas [(6463, 6927)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function verFicha(id) {
    const idBusqueda = String(id);
    const j = db.jugadores.find(x => String(x.id) === idBusqueda);
    if (!j) return alert("❌ Error: Jugador no localizado en la cantera.");
    
    jugadorEnFicha = j; 
    
    const modal = document.getElementById('modal-ficha');
    const txtNombre = document.getElementById('ficha-nombre');
    const contHabs = document.getElementById('habilidades-container');

    if (!modal || !txtNombre || !contHabs) return;

    if (!j.stats) j.stats = {};
    if (!j.statsAcumuladas) j.statsAcumuladas = {};
    if (!j.habilidades) j.habilidades = { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 };

    const jornadadActivaYSinCerrar = window.jornadaActiva && !window.jornadaCerrada;

    let s = {
        totales:     Number(j.stats.totales     || 0),
        ganados:     Number(j.stats.ganados     || 0),
        perdidos:    Number(j.stats.perdidos    || 0),
        juegosFavor: Number(j.stats.juegosFavor || 0),
        juegosContra:Number(j.stats.juegosContra|| 0),
        mvps:        Number(j.stats.mvps        || 0),
        dobles:      Number(j.stats.dobles      || 0),
        simples:     Number(j.stats.simples     || 0),
        trios:       Number(j.stats.trios       || 0),
        gamificados: Number(j.stats.gamificados || 0),
        asimetrico:  Number(j.stats.asimetrico  || 0),
        australiana: Number(j.stats.australiana || 0)
    };

    // ✅ FIX: Durante una jornada activa, los golpes de hoy están en
    // golpesGanadoresHoy (se suman más abajo en el bloque EN VIVO).
    // statsAcumuladas ya contiene jornadas anteriores cerradas.
    // Si sumáramos statsAcumuladas aquí Y golpesGanadoresHoy abajo,
    // los golpes de hoy se contarían dos veces.
    // Solución: durante jornada activa, partimos solo de stats.aces etc.
    // (historial permanente). Los de hoy se añaden en el bloque EN VIVO.
    let golpes;
    if (jornadadActivaYSinCerrar) {
        // Solo historial permanente — los de hoy se suman en el bloque EN VIVO
        golpes = {
            ace:     Number(j.stats.aces     || 0),
            winner:  Number(j.stats.winners  || 0),
            dejada:  Number(j.stats.dejadas  || 0),
            volea:   Number(j.stats.voleas   || 0),
            smash:   Number(j.stats.smashes  || 0),
            passing: Number(j.stats.passings || 0)
        };
    } else {
        // Jornada cerrada o sin jornada: statsAcumuladas + stats son la verdad completa
        golpes = {
            ace:     Number(j.statsAcumuladas.ace     || 0) + Number(j.stats.aces     || 0),
            winner:  Number(j.statsAcumuladas.winner  || 0) + Number(j.stats.winners  || 0),
            dejada:  Number(j.statsAcumuladas.dejada  || 0) + Number(j.stats.dejadas  || 0),
            volea:   Number(j.statsAcumuladas.volea   || 0) + Number(j.stats.voleas   || 0),
            smash:   Number(j.statsAcumuladas.smash   || 0) + Number(j.stats.smashes  || 0),
            passing: Number(j.statsAcumuladas.passing || 0) + Number(j.stats.passings || 0)
        };
    }

    const puntosTotales = j.puntosTotales || 0;
    const victoriasTriosPersistentes = j.victoriasTrios || 0;

    if (jornadadActivaYSinCerrar) {
        // ✅ FIX BUG MVP-3: eliminado s.mvps++ manual.
        // confirmarMVPJugadores() y asignarMVPEntrenadores() ya escriben stats.mvps
        // en tiempo real. Sumar aquí causaba doble conteo: stats.mvps (permanente)
        // + 1 extra en cada apertura de ficha durante jornada activa.
        // s.mvps se inicializa arriba con j.stats.mvps y es ya el valor correcto.

        (window.partidosFinalizadosHoy || []).forEach(p => {
            const listaIds = (p.ids || []).map(String);
            if (listaIds.includes(idBusqueda)) {
                s.totales++;
                
                const esGamificado = p.gamified || p.tipo === 'gamificado';
                const tipoNorm = p.tipo
                    ? p.tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    : '';

                if (esGamificado) {
                    s.gamificados++;
                    // ✅ Registrar ganado/perdido en gamificado (proporcional)
                    if (p.puntosGamificados && Object.keys(p.puntosGamificados).length > 0) {
                        const _vfAllG = Object.values(p.puntosGamificados).map(Number);
                        const _vfMaxG = Math.max(0, ..._vfAllG);
                        const _vfMisG = Number(p.puntosGamificados[idBusqueda] || 0);
                        const _vfNumM = _vfAllG.filter(v => v === _vfMaxG).length;
                        if (_vfMaxG > 0 && _vfNumM === 1) {
                            if (_vfMisG === _vfMaxG) s.ganados++; else s.perdidos++;
                        }
                    }
                } else if (tipoNorm === 'trios') {
                    s.trios++;
                } else if (tipoNorm === 'asimetrico') {
                    s.asimetrico = (s.asimetrico || 0) + 1;
                } else if (tipoNorm === 'dobles') {
                    s.dobles++;
                } else if (tipoNorm === 'equipos3') {
                    s.australiana = (s.australiana || 0) + 1;
                } else {
                    s.simples++;
                }

                // ✅ equipos3 usa puntosAustraliana; el resto usa juegosA/B con corte de equipo
                if (!esGamificado) {
                    if (tipoNorm === 'equipos3') {
                        const pts = p.puntosAustraliana || {};
                        const maxPts = Math.max(0, ...Object.values(pts).map(Number));
                        const numMax = Object.values(pts).filter(v => Number(v) === maxPts).length;
                        const totAus = Object.values(pts).reduce((s, v) => s + Number(v || 0), 0);
                        const misAus = Number(pts[idBusqueda] || 0);
                        const esMaxAus = misAus === maxPts && maxPts > 0;
                        if (totAus > 0) {
                            s.juegosFavor  += misAus;
                            s.juegosContra += totAus - misAus;
                            if (numMax === 1) {
                                if (esMaxAus) s.ganados++; else s.perdidos++;
                            }
                        }
                    } else {
                        const idx = listaIds.indexOf(idBusqueda);
                        const _mitadFicha = p.tamanoEquipoA != null
                            ? Number(p.tamanoEquipoA)
                            : Math.floor(listaIds.length / 2);
                        const esEquipoA = idx < _mitadFicha;
                        const jA = parseInt(p.juegosA || 0);
                        const jB = parseInt(p.juegosB || 0);

                        if (esEquipoA) {
                            s.juegosFavor += jA; s.juegosContra += jB;
                            if (jA > jB) s.ganados++; else if (jA < jB) s.perdidos++;
                        } else {
                            s.juegosFavor += jB; s.juegosContra += jA;
                            if (jB > jA) s.ganados++; else if (jB < jA) s.perdidos++;
                        }
                    }
                }
            }
        });

        // Golpes de hoy — solo se añaden durante jornada activa
        // ✅ FIX: String(j.id) para coincidir con la clave normalizada por modG
        const golpesHoy = window.golpesGanadoresHoy?.[String(j.id)] || {};
        Object.keys(golpesHoy).forEach(k => {
            if (golpes[k] !== undefined) golpes[k] += (golpesHoy[k] || 0);
        });
    }

    // --- RENDERIZADO (intacto) ---
    txtNombre.innerText = `PERFIL: ${j.nombre.toUpperCase()}`;
    let htmlStats = '';
    
    if (s.totales === 0 && puntosTotales === 0 && s.mvps === 0) {
        htmlStats += `
            <div style="text-align:center; padding:20px; opacity:0.6; font-style:italic; border: 1px dashed rgba(255,255,255,0.2); border-radius: 10px; margin-bottom: 20px;">
                Jugador nuevo. ¡Necesita debutar en la pista!
            </div>`;
    } else {
        htmlStats += `
            <div style="background:var(--atp-gold, #C5A059); color:black; text-align:center; padding:10px; border-radius:10px; margin-bottom:15px; font-weight:900; box-shadow: 0 4px 0 #8a6b32;">
                🏆 PUNTOS RANKING: ${puntosTotales} | 👑 MVP: ${s.mvps}x
            </div>

            <!-- MVP detalle fuente -->
            ${(() => {
                // Contar MVPs por fuente en histórico de jornadas
                let cntJ = 0, cntE = 0;
                const idB = String(j.id);
                (db.historicoJornadas || []).forEach(jo => {
                    if (Array.isArray(jo.mvpIdsJugadores)    && jo.mvpIdsJugadores.map(String).includes(idB))    cntJ++;
                    if (Array.isArray(jo.mvpIdsEntrenadores) && jo.mvpIdsEntrenadores.map(String).includes(idB)) cntE++;
                });
                // Añadir jornada activa si es MVP hoy
                const mvpJhoy = Array.isArray(window.mvpIdsJugadores)    && window.mvpIdsJugadores.includes(idB);
                const mvpEhoy = Array.isArray(window.mvpIdsEntrenadores) && window.mvpIdsEntrenadores.includes(idB);
                if (mvpJhoy) cntJ++;
                if (mvpEhoy) cntE++;
                if (cntJ === 0 && cntE === 0) return '';
                return `<div style="display:flex;gap:8px;margin-bottom:12px;">
                    ${cntJ > 0 ? `<div style="flex:1;background:#f0fdf9;border:1px solid #10ac84;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:0.6rem;color:#065f46;font-weight:900;text-transform:uppercase;">🗳️ Jugadores</div><div style="font-size:1.4rem;font-weight:900;color:#10ac84;">${cntJ}x</div><div style="font-size:0.55rem;color:#6b7280;">+3pts c/u</div></div>` : ''}
                    ${cntE > 0 ? `<div style="flex:1;background:#fffbeb;border:1px solid #C5A059;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:0.6rem;color:#92400e;font-weight:900;text-transform:uppercase;">👨‍🏫 Entrenadores</div><div style="font-size:1.4rem;font-weight:900;color:#C5A059;">${cntE}x</div><div style="font-size:0.55rem;color:#6b7280;">+2pts c/u</div></div>` : ''}
                </div>`;
            })()}

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                <div style="background:rgba(0,30,60,0.05); padding:10px; border-radius:12px; text-align:center; border:1px solid #eee;">
                    <div style="font-size:0.65rem; color:#888; font-weight:bold; text-transform:uppercase;">Efectividad (${s.totales})</div>
                    <div style="display:flex; justify-content:space-around; margin-top:8px;">
                        <div><span style="font-size:1.4rem; font-weight:900; color:#2e7d32;">${s.ganados}</span><br><span style="font-size:0.5rem; font-weight:bold;">WINS</span></div>
                        <div><span style="font-size:1.4rem; font-weight:900; color:#d9534f;">${s.perdidos}</span><br><span style="font-size:0.5rem; font-weight:bold;">LOSS</span></div>
                    </div>
                </div>
                
                <div style="background:rgba(0,30,60,0.05); padding:10px; border-radius:12px; text-align:center; border:1px solid #eee;">
                    <div style="font-size:0.65rem; color:#888; font-weight:bold; text-transform:uppercase; margin-bottom:8px;">Modos jugados</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; font-size:0.55rem;">
                        <div style="background:#f0f4ff;border-radius:6px;padding:5px 2px;"><b style="font-size:1rem; color:var(--atp-navy);">${s.simples}</b><br>🤺 IND</div>
                        <div style="background:#f0f4ff;border-radius:6px;padding:5px 2px;"><b style="font-size:1rem; color:var(--atp-navy);">${s.dobles}</b><br>🎾 DOB</div>
                        <div style="background:#fff8f0;border-radius:6px;padding:5px 2px;"><b style="font-size:1rem; color:#ff9f43;">${s.trios}</b><br>🔱 3v3</div>
                        <div style="background:#fff0ea;border-radius:6px;padding:5px 2px;"><b style="font-size:1rem; color:#ff6b35;">${s.asimetrico}</b><br>⚡ ASIM</div>
                        <div style="background:#f5f0ff;border-radius:6px;padding:5px 2px;"><b style="font-size:1rem; color:#a78bfa;">${s.australiana}</b><br>🔄 AUS</div>
                        <div style="background:#e8f9f7;border-radius:6px;padding:5px 2px;"><b style="font-size:1rem; color:#008ba8;">${s.gamificados}</b><br>🎮 GAM</div>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; background:var(--atp-navy); color:white; padding:12px; border-radius:12px; margin-bottom:20px; text-align:center;">
                <div style="border-right:1px solid rgba(255,255,255,0.1);">🚀 Aces<br><b style="font-size:1rem;">${golpes.ace}</b></div>
                <div style="border-right:1px solid rgba(255,255,255,0.1);">🔥 Winner<br><b style="font-size:1rem;">${golpes.winner}</b></div>
                <div>🧤 Dejadas<br><b style="font-size:1rem;">${golpes.dejada}</b></div>
                <div style="border-right:1px solid rgba(255,255,255,0.1); border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;">🎾 Voleas<br><b style="font-size:1rem;">${golpes.volea}</b></div>
                <div style="border-right:1px solid rgba(255,255,255,0.1); border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;">💥 Smash<br><b style="font-size:1rem;">${golpes.smash}</b></div>
                <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;">🎯 Pass<br><b style="font-size:1rem;">${golpes.passing}</b></div>
            </div>`;
    }

    htmlStats += `
        <h4 style="border-bottom:2px solid var(--atp-gold); padding-bottom:5px; margin-bottom:15px; font-size:0.8rem; color:var(--atp-navy);">HABILIDADES TÉCNICAS</h4>
        <div id="lista-habilidades-interactivas"></div>
    `;

    contHabs.innerHTML = htmlStats;
    
    if (typeof renderHabilidadesBarras === 'function') {
        renderHabilidadesBarras();
    }
    
    modal.style.display = 'flex';
}

function renderHabilidadesBarras() {
    const lista = document.getElementById('lista-habilidades-interactivas');
    if (!lista || !jugadorEnFicha) return;

    lista.innerHTML = Object.entries(jugadorEnFicha.habilidades).map(([skill, value]) => {
        const porcentaje = Math.min(100, value * 10);
        return `
            <div style="margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:0.8rem;">
                    <span style="font-weight:600;">${skill.toUpperCase()}</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button onclick="modSkill('${skill}', -0.5)" style="width:24px; height:24px; border:none; background:#d9534f; color:white; border-radius:4px; cursor:pointer;">-</button>
                        <span style="font-family:monospace; font-weight:bold; min-width:35px; text-align:center;">${value.toFixed(1)}</span>
                        <button onclick="modSkill('${skill}', 0.5)" style="width:24px; height:24px; border:none; background:#5cb85c; color:white; border-radius:4px; cursor:pointer;">+</button>
                    </div>
                </div>
                <div style="background:#eee; height:10px; border-radius:5px; overflow:hidden; border:1px solid #ddd;">
                    <div style="background:linear-gradient(90deg, var(--atp-blue), #00d4ff); width:${porcentaje}%; height:100%; transition:width 0.3s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
}


// 3. CERRAR FICHA
function cerrarFicha() {
    const modal = document.getElementById('modal-ficha');
    if (modal) modal.style.display = 'none';
    jugadorEnFicha = null;
    // Refrescamos la cantera al cerrar por si hubo cambios de media o rango
    renderCantera();
}

// Variable global de control
let jugadorEnFicha = null;

// 1. RENDERIZADO DE LA LISTA DE JUGADORES (CANTERA)
function renderCantera() {
    const cont = document.getElementById('lista-total-jugadores');
    if (!cont) return;

    if (!db.jugadores || db.jugadores.length === 0) {
        cont.innerHTML = `
            <div style="text-align:center; padding:40px 20px; opacity:0.6; font-size:0.9rem;">
                <p>Aún no hay jugadores en la cantera.<br>
                <small>Pulsa "PASAR LISTA" para agregar jugadores</small></p>
            </div>`;
        return;
    }

    // Orden alfabético para una búsqueda humana más rápida
    const lista = [...db.jugadores].sort((a, b) => a.nombre.localeCompare(b.nombre));

    // ── Aviso C1: jugadores nuevos sin clasificar ────────────────
    const sinClasificar = db.jugadores.filter(j =>
        j.esInvitado === undefined || j.esInvitado === null
    );
    let bannerHtml = '';
    if (sinClasificar.length > 0) {
        const nombres = sinClasificar.map(j => `<strong>${escapeHtml(j.nombre)}</strong>`).join(', ');
        bannerHtml = `
        <div style="background:#fffbeb; border:1px solid #f59e0b; border-radius:10px;
                    padding:12px 16px; margin-bottom:16px; display:flex; gap:12px; align-items:flex-start;">
            <span style="font-size:1.2rem; flex-shrink:0;">⚠️</span>
            <div>
                <div style="font-weight:900; color:#92400e; font-size:0.82rem; margin-bottom:4px;">
                    JUGADORES SIN CLASIFICAR
                </div>
                <div style="font-size:0.78rem; color:#78350f; line-height:1.5;">
                    ${nombres} se han registrado desde el portal público y aún no están clasificados.<br>
                    Decide si son jugadores de ranking o invitados pulsando el botón <b>👨‍👧 INVITADO</b> en su tarjeta.
                </div>
            </div>
        </div>`;
    }

    const tarjetas = lista.map(j => {
        // Escudo para habilidades inexistentes
        const habs = j.habilidades || { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 };
        const valores = Object.values(habs).map(v => parseFloat(v) || 0);
        const media = (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1);
        
        // Sistema de Rangos dinámico
        let rango = "Amateur";
        let colorRango = "#999";
        if (media >= 9.0) { rango = "Élite / Pro"; colorRango = "var(--atp-gold, #C5A059)"; }
        else if (media >= 7.0) { rango = "Avanzado"; colorRango = "var(--atp-blue, #001e3c)"; }

        const esPresenteHoy = (window.jugadoresHoy || []).some(h => String(h.id) === String(j.id));
        const esInvitado = !!j.esInvitado;
        // C1: sin clasificar = vino del portal público sin esInvitado definido
        const sinClasif = (j.esInvitado === undefined || j.esInvitado === null);
        const borderColor = sinClasif ? '#ef4444' : (esInvitado ? '#f59e0b' : colorRango);
        const badgeSinClasif = sinClasif
            ? '<span style="background:#ef4444; color:white; font-size:0.55rem; padding:2px 7px; border-radius:10px; font-weight:900; letter-spacing:0.5px;">❓ SIN CLASIFICAR</span>'
            : '';
        return `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; 
                border-left: 6px solid ${borderColor};
                ${sinClasif ? 'background:rgba(239,68,68,0.04); border:1px solid rgba(239,68,68,0.3);' : ''}
                ${esPresenteHoy && !sinClasif ? 'background: rgba(0, 212, 255, 0.05); border-right: 2px solid #00d4ff;' : ''}
                ${esInvitado ? 'opacity:0.85;' : ''}">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                        <h3 style="margin:0; font-size: 1.1rem; color: var(--atp-navy);">${escapeHtml(j.nombre.toUpperCase())}</h3>
                        ${badgeSinClasif}
                        ${!sinClasif && esInvitado 
                            ? '<span style="background:#f59e0b; color:white; font-size:0.55rem; padding:2px 7px; border-radius:10px; font-weight:900; letter-spacing:0.5px;">👨‍👧 INVITADO</span>' 
                            : ''}
                        ${esPresenteHoy ? '<span style="background:#00d4ff; color:white; font-size:0.55rem; padding:2px 6px; border-radius:10px; font-weight:900;">EN PISTA</span>' : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <small style="color:${sinClasif ? '#ef4444' : (esInvitado ? '#f59e0b' : colorRango)}; font-weight:bold; text-transform: uppercase; font-size: 0.65rem;">
                            ${sinClasif ? '⚠️ Clasifica este jugador antes de la próxima jornada' : (esInvitado ? 'JORNADA LÚDICA — sin ranking' : rango + ' • Media ' + media)}
                        </small>
                    </div>
                    <div style="font-size:0.75rem; margin-top:6px; color:#666;">
                        ${esInvitado && !sinClasif
                            ? '<span style="color:#f59e0b; font-style:italic;">No computa en ranking</span>' 
                            : 'Puntos de Ranking: <strong style="color:var(--atp-navy);">' + (j.puntosTotales || 0) + '</strong>'}
                    </div>
                </div>
                
                <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                    <button onclick="toggleInvitado('${j.id}')" 
                            title="${esInvitado ? 'Pasar a jugador activo de ranking' : 'Marcar como invitado / jornada lúdica'}"
                            style="background:${esInvitado ? '#fef3c7' : '#f3f4f6'}; color:${esInvitado ? '#92400e' : '#6b7280'}; 
                                   border:1px solid ${esInvitado ? '#fcd34d' : '#e5e7eb'}; 
                                   padding:8px 10px; border-radius:8px; cursor:pointer; font-size:0.75rem; font-weight:700;">
                        ${esInvitado ? '⬆️ RANKING' : '👨‍👧 INVITADO'}
                    </button>
                    <button onclick="verFicha('${j.id}')" 
                            style="background:var(--atp-blue); color:white; border:none; padding:10px 15px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:0.75rem; display:flex; align-items:center; gap:5px;">
                        📊 <span>FICHA</span>
                    </button>
                    <button onclick="eliminarJugador('${j.id}')" 
                            style="background:#fee2e2; color:#ef4444; border:1px solid #fecaca; padding:10px; border-radius:8px; cursor:pointer; font-size:0.8rem;">
                        🗑️
                    </button>
                </div>
            </div>`;
    }).join('');

    cont.innerHTML = bannerHtml + tarjetas;
}


// ==========================================
// TOGGLE INVITADO — Marcar/desmarcar jugador como invitado lúdico
// Los invitados juegan con normalidad pero NO computan en el ranking.
// ==========================================
function toggleInvitado(id) {
    const idStr = String(id);
    const j = db.jugadores.find(x => String(x.id) === idStr);
    if (!j) return;

    const sinClasificar = (j.esInvitado === undefined || j.esInvitado === null);
    const eraInvitado = !!j.esInvitado;
    j.esInvitado = !eraInvitado;

    // Sincronizar también en jugadoresHoy si está presente hoy
    const jHoy = (window.jugadoresHoy || []).find(x => String(x.id) === idStr);
    if (jHoy) jHoy.esInvitado = j.esInvitado;

    saveDB();
    if (typeof renderCantera === 'function') renderCantera();
    if (typeof renderRanking === 'function') renderRanking();
    // FIX: si el jugador está en la jornada activa, refrescar su tag
    if (jHoy && typeof renderPresentes === 'function') renderPresentes();

    let accion;
    if (sinClasificar) {
        accion = '👨‍👧 Clasificado como INVITADO lúdico.\nNo acumulará puntos de ranking.\n\nSi en realidad es un jugador de ranking, pulsa "⬆️ RANKING" en su tarjeta.';
    } else {
        accion = j.esInvitado
            ? '👨‍👧 Marcado como INVITADO lúdico.\nNo aparecerá en el ranking ni acumulará puntos.'
            : '⬆️ Restaurado como jugador activo de ranking.';
    }
    alert(accion);
}

// 2. GESTIÓN DE HABILIDADES (MODIFICACIÓN)
function modSkill(skill, delta) {
    if (!jugadorEnFicha || !jugadorEnFicha.habilidades) return;
    
    // 1. Parseo seguro para evitar el bug "5" + 0.5 = "50.5"
    let valorActual = parseFloat(jugadorEnFicha.habilidades[skill]) || 0;
    let nuevoValor = valorActual + delta;
    
    // 2. Límites estrictos 0-10 con precisión de un decimal
    nuevoValor = Math.max(0, Math.min(10, parseFloat(nuevoValor.toFixed(1))));
    
    // 3. Actualizar objeto en memoria (jugadorEnFicha es una referencia)
    jugadorEnFicha.habilidades[skill] = nuevoValor;
    
    // --- 🚀 MEJORA V2: RE-CÁLCULO DE NIVEL GLOBAL ---
    // Si cambias habilidades, el nivel del jugador (su "peso" en el ranking) debe cambiar
    const todasLasHabs = Object.values(jugadorEnFicha.habilidades);
    const suma = todasLasHabs.reduce((acc, val) => acc + val, 0);
    const nuevoNivelGlobal = (suma / todasLasHabs.length).toFixed(1);
    jugadorEnFicha.nivel = nuevoNivelGlobal;
    // ------------------------------------------------
    
    // 4. Sincronizar con la DB principal (Busqueda por ID robusta)
    const jIndex = db.jugadores.findIndex(x => String(x.id) === String(jugadorEnFicha.id));
    if (jIndex !== -1) {
        db.jugadores[jIndex].habilidades = { ...jugadorEnFicha.habilidades };
        db.jugadores[jIndex].nivel = nuevoNivelGlobal;
    }
    
    // 5. Persistencia y refresco de UI
    saveDB();
    if (typeof renderHabilidadesBarras === 'function') renderHabilidadesBarras(); 
    
    // 6. Actualizar el banner de la ficha (para ver el nivel cambiar en vivo)
    const txtNombre = document.getElementById('ficha-nombre');
    if (txtNombre) {
        txtNombre.innerText = `PERFIL: ${jugadorEnFicha.nombre.toUpperCase()} (Nivel ${nuevoNivelGlobal})`;
    }

    // 7. Dependencia con el Ranking de Especialistas
    if (typeof renderRankingEspecialistas === 'function') {
        renderRankingEspecialistas();
    }
    
    console.log(`📈 ${skill} -> ${nuevoValor} | Nuevo Nivel Global: ${nuevoNivelGlobal}`);
}


