/* ============================================================
   ATP PLATINUM — 09-tiebreak.js
   Motor de tie-break completo
   ── Refactor: extraído de script.js (líneas [(3349, 3596)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

// ============================================================
// TIE-BREAK ENGINE
// Reglas:
//   - Puntuación numérica simple (1, 2, 3…)
//   - Gana el primero en llegar a 7 con ≥2 de diferencia
//   - Si igualan a 6, se juega hasta diferencia de 2
//   - Cambio de lado cuando la suma de puntos es múltiplo de 6
//   - Primer saque: servicio único desde deuce (equipo/jugador A)
//     Luego se alternan de 2 en 2
// ============================================================

/**
 * Calcula el estado completo del tie-break a partir de los puntos actuales.
 * @param {number} pA - Puntos del equipo/jugador A
 * @param {number} pB - Puntos del equipo/jugador B
 * @returns {{ ganador: 'A'|'B'|null, cambioLado: boolean, quienSaca: 'A'|'B', descripcionSaque: string }}
 */
function calcularEstadoTiebreak(pA, pB) {
    const total = pA + pB;

    // ── Ganador ──────────────────────────────────────────────
    let ganador = null;
    if (pA >= 7 && pA - pB >= 2) ganador = 'A';
    else if (pB >= 7 && pB - pA >= 2) ganador = 'B';
    // Extensión tras 6-6
    else if (pA >= 6 && pB >= 6 && pA - pB >= 2) ganador = 'A';
    else if (pA >= 6 && pB >= 6 && pB - pA >= 2) ganador = 'B';

    // ── Cambio de lado ───────────────────────────────────────
    // Se produce cuando la suma de puntos es múltiplo de 6 (y no es 0)
    const cambioLado = total > 0 && total % 6 === 0;

    // ── Quién saca ───────────────────────────────────────────
    // Punto 0 → A saca (saque inicial desde deuce)
    // Puntos 1-2 → B saca
    // Puntos 3-4 → A saca
    // Puntos 5-6 → B saca  …se alternan de 2 en 2
    // Fórmula: bloque = Math.floor(total / 2); A si par, B si impar
    // Excepción: punto 0 (bloque 0) → A saca (ya cumple: 0 es par → A ✅)
    const bloque = Math.floor(total / 2);
    const quienSaca = bloque % 2 === 0 ? 'A' : 'B';

    // Descripción del saque
    let descripcionSaque;
    if (total === 0) {
        descripcionSaque = 'Saque inicial — lado deuce (equipo A)';
    } else {
        const sacadorLetra = quienSaca;
        const ladoSaque = total % 2 === 0 ? 'deuce' : 'ventaja';
        descripcionSaque = `Saca equipo ${sacadorLetra} — lado ${ladoSaque}`;
    }

    return { ganador, cambioLado, quienSaca, descripcionSaque, total };
}

/** Activa/desactiva el modo tie-break en un partido por ID */
function toggleTiebreak(idPartido) {
    const p = window.partidosAbiertos.find(x => String(x.id) === String(idPartido));
    if (!p) return;

    if (p.tiebreak) {
        // Desactivar — preguntar para no perder puntos accidentalmente
        if (!confirm('⚠️ ¿Desactivar el tie-break?\n\nLos puntos registrados se borrarán y el partido volverá al marcador normal.')) return;
        delete p.tiebreak;
        delete p.tbPuntosA;
        delete p.tbPuntosB;
        // No tocamos juegosA/juegosB — se restaura el marcador previo
        p.marcador = (p.juegosA || 0) + ' - ' + (p.juegosB || 0);
    } else {
        // Activar
        p.tiebreak = true;
        p.tbPuntosA = 0;
        p.tbPuntosB = 0;
        p.marcador = 'TB 0-0';
    }

    saveDB();
    renderPistas();
    if (typeof renderControlPistas === 'function') renderControlPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof sincronizarTV === 'function') sincronizarTV();
}

/** Suma o resta un punto de tie-break al equipo indicado */
function cambiarPuntoTiebreak(idPartido, equipo, delta) {
    const p = window.partidosAbiertos.find(x => String(x.id) === String(idPartido));
    if (!p || !p.tiebreak) return;

    if (equipo === 'A') {
        p.tbPuntosA = Math.max(0, (p.tbPuntosA || 0) + delta);
    } else {
        p.tbPuntosB = Math.max(0, (p.tbPuntosB || 0) + delta);
    }

    const pA = p.tbPuntosA || 0;
    const pB = p.tbPuntosB || 0;
    const estado = calcularEstadoTiebreak(pA, pB);

    // Actualizar marcador visible
    p.marcador = `TB ${pA}-${pB}`;

    // Alertas de cambio de lado (solo al sumar, no al restar)
    if (delta > 0 && estado.cambioLado) {
        // No bloqueamos con alert — mostramos un toast si existe
        if (typeof mostrarToastGlobal === 'function') {
            mostrarToastGlobal('🔄 ¡Cambio de lado!');
        } else {
            // Fallback sin bloquear UI
            setTimeout(() => alert(`🔄 ¡Cambio de lado! (${pA + pB} puntos jugados)`), 50);
        }
    }

    // Ganador automático
    if (estado.ganador) {
        p.marcador = `TB ${pA}-${pB} ✓`;
    }

    saveDB();
    renderPistas();
    if (typeof renderControlPistas === 'function') renderControlPistas();
    if (typeof actualizarVistaPistas === 'function') actualizarVistaPistas();
    if (typeof sincronizarTV === 'function') sincronizarTV();
}

/**
 * Genera el bloque HTML del tie-break para usar en renderPistas y renderControlPistas.
 * @param {object} p - Partido
 * @param {boolean} darkMode - true para control de pistas (fondo oscuro), false para pistas normales
 * @returns {string} HTML
 */
function _htmlTiebreak(p, darkMode) {
    const pA = p.tbPuntosA || 0;
    const pB = p.tbPuntosB || 0;
    const estado = calcularEstadoTiebreak(pA, pB);
    const id = p.id;

    const bg         = darkMode ? 'rgba(0,0,0,0.35)' : '#f0f4ff';
    const border     = darkMode ? '1px solid rgba(204,255,0,0.25)' : '1px solid #c3cfff';
    const colorNum   = darkMode ? '#ccff00' : '#001e3c';
    const colorLabel = darkMode ? 'rgba(255,255,255,0.45)' : '#555';
    const colorSaque = darkMode ? '#00d4ff' : '#0056b3';
    const colorInfo  = darkMode ? 'rgba(255,255,255,0.35)' : '#888';
    const btnSize    = darkMode ? '44px' : '38px';
    const numSize    = darkMode ? '2.8rem' : '2.3rem';

    // Indicador de saque: flecha al lado del sacador
    const sacaA = estado.quienSaca === 'A';
    const sacaB = estado.quienSaca === 'B';
    const iconSaque = `<span style="font-size:0.7rem; color:${colorSaque}; font-weight:900;">🎾</span>`;

    // Aviso cambio de lado
    const avisoLado = estado.cambioLado
        ? `<div style="text-align:center; margin-bottom:8px; padding:4px 10px;
                       background:rgba(197,160,89,0.15); border:1px solid rgba(197,160,89,0.4);
                       border-radius:6px; font-size:0.7rem; font-weight:900; color:#C5A059;">
               🔄 CAMBIO DE LADO
           </div>`
        : '';

    // Aviso ganador
    const avisoGanador = estado.ganador
        ? `<div style="text-align:center; margin-bottom:8px; padding:6px 10px;
                       background:rgba(204,255,0,0.15); border:1px solid rgba(204,255,0,0.5);
                       border-radius:6px; font-size:0.75rem; font-weight:900; color:#ccff00;">
               🏆 GANADOR TIE-BREAK: EQUIPO ${estado.ganador}
           </div>`
        : '';

    return `
    <div style="background:rgba(204,255,0,0.06); border:1px solid rgba(204,255,0,0.3);
                border-radius:10px; padding:12px 14px; margin-bottom:10px;">

        <!-- Header TB -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-size:0.7rem; font-weight:900; color:#ccff00; letter-spacing:1.5px; text-transform:uppercase;">
                🎾 TIE-BREAK
            </span>
            <span style="font-size:0.65rem; color:${colorInfo};">
                ${estado.descripcionSaque}
            </span>
        </div>

        ${avisoGanador}
        ${avisoLado}

        <!-- Marcador TB -->
        <div style="display:flex; align-items:center; gap:12px; background:${bg};
                    border:${border}; border-radius:10px; padding:12px 14px; margin-bottom:10px;">

            <!-- Equipo A -->
            <div style="flex:1; text-align:center;">
                <div style="font-size:0.55rem; font-weight:900; color:${colorLabel};
                            margin-bottom:4px; letter-spacing:1px;">
                    ${sacaA ? iconSaque + ' ' : ''}EQUIPO A
                </div>
                <div style="font-size:${numSize}; font-weight:900; color:${colorNum};
                            line-height:1; margin-bottom:8px;
                            ${estado.ganador === 'A' ? 'color:#ccff00;' : ''}">
                    ${pA}
                </div>
                <div style="display:flex; justify-content:center; gap:6px;">
                    <button onclick="cambiarPuntoTiebreak('${id}','A',1)"
                        style="width:${btnSize}; height:${btnSize}; border:none; background:#10ac84;
                               color:white; border-radius:7px; font-size:1.2rem; font-weight:900; cursor:pointer;">+</button>
                    <button onclick="cambiarPuntoTiebreak('${id}','A',-1)"
                        style="width:${btnSize}; height:${btnSize}; border:none; background:#ee5253;
                               color:white; border-radius:7px; font-size:1.2rem; font-weight:900; cursor:pointer;">−</button>
                </div>
            </div>

            <!-- Separador -->
            <div style="font-size:0.85rem; color:${colorInfo}; font-weight:900;">VS</div>

            <!-- Equipo B -->
            <div style="flex:1; text-align:center;">
                <div style="font-size:0.55rem; font-weight:900; color:${colorLabel};
                            margin-bottom:4px; letter-spacing:1px;">
                    ${sacaB ? iconSaque + ' ' : ''}EQUIPO B
                </div>
                <div style="font-size:${numSize}; font-weight:900; color:${colorNum};
                            line-height:1; margin-bottom:8px;
                            ${estado.ganador === 'B' ? 'color:#ccff00;' : ''}">
                    ${pB}
                </div>
                <div style="display:flex; justify-content:center; gap:6px;">
                    <button onclick="cambiarPuntoTiebreak('${id}','B',1)"
                        style="width:${btnSize}; height:${btnSize}; border:none; background:#10ac84;
                               color:white; border-radius:7px; font-size:1.2rem; font-weight:900; cursor:pointer;">+</button>
                    <button onclick="cambiarPuntoTiebreak('${id}','B',-1)"
                        style="width:${btnSize}; height:${btnSize}; border:none; background:#ee5253;
                               color:white; border-radius:7px; font-size:1.2rem; font-weight:900; cursor:pointer;">−</button>
                </div>
            </div>
        </div>

        <!-- Info extra: cambios de lado próximos -->
        <div style="font-size:0.6rem; color:${colorInfo}; text-align:center;">
            Próximo cambio en: ${6 - ((pA + pB) % 6)} punto${6 - ((pA + pB) % 6) !== 1 ? 's' : ''}
            · Total jugados: ${pA + pB}
        </div>

        <!-- Botón desactivar TB -->
        <button class="btn-tiebreak-desactivar" onclick="${darkMode ? `toggleTiebreak('${id}'); renderControlPistas()` : `toggleTiebreak('${id}')`}">
            ✕ Desactivar tie-break
        </button>
    </div>`;
}

