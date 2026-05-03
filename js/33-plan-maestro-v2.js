/* ============================================================
   ATP PLATINUM — 33-plan-maestro-v2.js
   Rotación inteligente 2.0 — Elite matchmaking
   ── Refactor: extraído de script.js (líneas [(10714, 11055)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function optimizarCuartetoV2(grupo) {
    // Intenta evitar repetir compañeros del partido anterior
    // grupo = [j1, j2, j3, j4] ordenados por ratingElite
    if (grupo.length < 4) return grupo;

    const [a, b, c, d] = grupo;

    // Opción 1: a+b vs c+d (los dos mejores juntos)
    // Opción 2: a+c vs b+d (equilibrado por nivel)
    // Opción 3: a+d vs b+c (máxima mezcla)
    const opciones = [
        [a, b, c, d],
        [a, c, b, d],
        [a, d, b, c]
    ];

    // Penalizar si han jugado juntos antes
    let mejorOpcion = opciones[0];
    let menorPenalizacion = Infinity;

    opciones.forEach(opt => {
        let penalizacion = 0;
        const compA = opt[0].historialParejas || [];
        const compB = opt[2].historialParejas || [];
        if (compA.includes(opt[1].id.toString())) penalizacion += 2;
        if (compB.includes(opt[3].id.toString())) penalizacion += 2;
        if (penalizacion < menorPenalizacion) {
            menorPenalizacion = penalizacion;
            mejorOpcion = opt;
        }
    });

    return mejorOpcion;
}

// ==========================================
// ROTACIÓN INTELIGENTE 2.0 (ELITE MATCHMAKING)
// ==========================================
// ============================================================
// ROTACIÓN INTELIGENTE 2.0: INTEGRACIÓN TOTAL Y RE-PLANIFICACIÓN
// ============================================================
function generarPlanMaestroV2() {
    if (typeof limpiezaSeguridadJornada === 'function') limpiezaSeguridadJornada(true);

    const contenedor = document.getElementById('resultado-planificacion');
    const estrategia = document.getElementById('estrategia-rotacion')?.value || 'dobles';

    window.planesTemporales = [];
    if (contenedor) contenedor.innerHTML = "";

    const totalPistasConfig = parseInt(document.getElementById('plan-pistas-totales')?.value) || 2;
    const ocupadas = window.partidosAbiertos.length;
    const _pistasOcupadas = new Set(window.partidosAbiertos.map(p => String(p.pista)));

    // ✅ FIX: leer las cajas de pistas marcadas como activas, igual que V1.
    // Antes V2 ignoraba las cajas y usaba todas las pistas 1..N libres físicamente,
    // lo que hacía que lanzara partidos en pistas no disponibles o no reservadas.
    const filasPistasV2 = document.querySelectorAll('.fila-pistas-hora');
    let _pistasActivasNums = [];

    if (filasPistasV2.length > 0) {
        // Tomar la primera hora (V2 genera un único bloque, no multi-hora)
        const primerFila = filasPistasV2[0];
        const cajasActivas = primerFila.querySelectorAll('.caja-pista-check.activa');
        _pistasActivasNums = Array.from(cajasActivas)
            .map(c => { const m = c.textContent.trim().match(/\d+/); return m ? parseInt(m[0]) : null; })
            .filter(n => n !== null);
    }

    // Fallback: si no hay cajas marcadas, usar todas las pistas libres físicamente
    const _pistasLibresNums = (_pistasActivasNums.length > 0
        ? _pistasActivasNums
        : Array.from({length: totalPistasConfig}, (_, i) => i + 1)
    ).filter(n => !_pistasOcupadas.has(String(n)));

    const pistasLibresFisicas = _pistasLibresNums.length;

    if (pistasLibresFisicas <= 0) return alert("⚠️ No hay pistas disponibles libres. Marca pistas activas en la configuración o finaliza un partido.");

    const disponiblesHoy = (window.jugadoresHoy || []).filter(j => !j.pausado && !estaJugando(j.id));
    if (disponiblesHoy.length < 2) return alert("⚠️ No hay jugadores suficientes libres.");

    // 1. CÁLCULO ELITE + VENGANZA
    let poolElite = disponiblesHoy.map(j => {
        const perfil = db.jugadores.find(x => x.id.toString() === j.id.toString());
        const habs = perfil?.habilidades || { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 };
        const media = Object.values(habs).reduce((a, b) => a + b, 0) / 5;

        const historial = (window.partidosFinalizadosHoy || []).filter(p => p.ids?.includes(j.id.toString()));
        let bonusVenganza = 0;
        if (historial.length > 0) {
            const ult = historial[historial.length - 1];
            let gane = false;
            if (ult.tipo === 'equipos3' && ult.puntosAustraliana) {
                // ✅ Australiana: determinar si ganó por acumulados
                const pts = ult.puntosAustraliana;
                const maxPts = Math.max(0, ...Object.values(pts).map(Number));
                const misAus = Number(pts[j.id.toString()] || 0);
                const numMax = Object.values(pts).filter(v => Number(v) === maxPts).length;
                gane = misAus === maxPts && maxPts > 0 && numMax === 1;
            } else {
                const _mitadE = ult.tamanoEquipoA != null
                    ? Number(ult.tamanoEquipoA)
                    : Math.floor(ult.ids.length / 2);
                const esEquipoA = ult.ids.indexOf(j.id.toString()) < _mitadE;
                gane = esEquipoA ? (ult.juegosA > ult.juegosB) : (ult.juegosB > ult.juegosA);
            }
            if (!gane) bonusVenganza = 1.5;
        }

        const rating = media + ((j.descansosSeguidos || 0) * 3) + bonusVenganza - (historial.length * 0.5);
        return {
            ...j,
            ratingElite: isNaN(rating) ? media : rating,
            historialParejas: obtenerCompañerosDeHoy(j.id)
        };
    });
    poolElite.sort((a, b) => b.ratingElite - a.ratingElite);

    // 2. CONSTRUCCIÓN INTELIGENTE DE PARTIDOS
    let partidosSugeridosBloque = [];
    let copiaPool = [...poolElite];

    let html = `<div style="padding:10px; border-radius:8px; background:var(--atp-navy); color:white; margin-bottom:15px; text-align:center;">
                <span style="color:var(--atp-gold); font-weight:bold;">🚀 MODO ELITE & VENGANZA 🔥</span></div>`;

    for (let p = 1; p <= pistasLibresFisicas; p++) {
        // Número real de pista del club para este slot
        const _numPistaRealV2 = _pistasLibresNums[p - 1] || p;

        const disponiblesAhora = copiaPool.filter(j => !estaJugando(j.id) && !j.pausado);

        if (disponiblesAhora.length < 2) break;

        const decision = decidirModalidad(disponiblesAhora.length, estrategia);
        const nReq = decision.nReq;

        if (nReq < 2 || disponiblesAhora.length < nReq) break;

        const grupo = disponiblesAhora.splice(0, nReq);
        const idsGrupo = new Set(grupo.map(g => g.id.toString()));
        copiaPool = copiaPool.filter(j => !idsGrupo.has(j.id.toString()));

        let pObj = { tipo: '', ids: [], nombres: '' };

        if (nReq === 6) {
            pObj.tipo = 'trios';
            const opt = optimizarTrioV2(grupo);
            pObj.ids = opt.map(c => c.id.toString());
            pObj.p1=pObj.ids[0]; pObj.p2=pObj.ids[1]; pObj.p3=pObj.ids[2];
            pObj.p4=pObj.ids[3]; pObj.p5=pObj.ids[4]; pObj.p6=pObj.ids[5];
            const eA = opt.slice(0, 3);
            const eB = opt.slice(3, 6);

            // ✅ FIX: Detectar venganza en tríos comprobando perdioUltimo en jugadoresHoy.
            // Antes solo los dobles generaban nombres con 🔥, por lo que cargarSugerenciaEnPista()
            // nunca detectaba venganza en tríos (busca '🔥' en pObj.nombres).
            const hayVenganzaTrio = opt.some(g => {
                const jHoy = window.jugadoresHoy.find(x => x.id.toString() === g.id.toString());
                return jHoy && jHoy.perdioUltimo;
            });

            const prefijoTrio = hayVenganzaTrio ? '🔥 ' : '🔱 ';
            const sufijoTrio  = hayVenganzaTrio ? ' 🔥' : '';
            pObj.nombres = `${prefijoTrio}${eA[0].nombre}+${eA[1].nombre}+${eA[2].nombre} vs ${eB[0].nombre}+${eB[1].nombre}+${eB[2].nombre}${sufijoTrio}`;
            pObj.esVenganza = hayVenganzaTrio;

        } else if (nReq === 4) {
            pObj.tipo = 'dobles';
            const opt = optimizarCuartetoV2(grupo);
            pObj.ids = opt.map(c => c.id.toString());
            pObj.p1=opt[0].id; pObj.p2=opt[1].id; pObj.p3=opt[2].id; pObj.p4=opt[3].id;
            // ✅ FIX BUG: el nombre del dobles siempre tenía 🔥 hardcodeado aunque nadie
            // hubiera perdido. Detectamos venganza igual que en el bloque de tríos.
            const hayVenganzaDobles = opt.some(g => {
                const jHoy = window.jugadoresHoy.find(x => x.id.toString() === g.id.toString());
                return jHoy && jHoy.perdioUltimo;
            });
            const prefijoD = hayVenganzaDobles ? '🔥 ' : '';
            const sufijoD  = hayVenganzaDobles ? ' 🔥' : '';
            pObj.nombres = `${prefijoD}${opt[0].nombre}/${opt[1].nombre} vs ${opt[2].nombre}/${opt[3].nombre}${sufijoD}`;
            pObj.esVenganza = hayVenganzaDobles;

        } else if (decision.modo === 'asimetrico') {
            // ✅ Rama asimétrico en V2: corte desde tamanoEquipoA calculado en decidirModalidad
            const corteA = decision.tamanoEquipoA ?? Math.ceil(grupo.length / 2);
            pObj.tipo = 'asimetrico';
            pObj.tamanoEquipoA = corteA;
            pObj.ids = grupo.map(g => g.id.toString());
            ['p1','p2','p3','p4','p5','p6'].forEach((k, i) => { pObj[k] = grupo[i]?.id || null; });
            const nombA = grupo.slice(0, corteA).map(g => g.nombre).join('+');
            const nombB = grupo.slice(corteA).map(g => g.nombre).join('+');
            const hayVenganzaAsim = grupo.some(g => {
                const jHoy = window.jugadoresHoy.find(x => x.id.toString() === g.id.toString());
                return jHoy && jHoy.perdioUltimo;
            });
            pObj.nombres = hayVenganzaAsim
                ? `🔥 ⚡ ${nombA} vs ${nombB} [${corteA}v${grupo.length - corteA}] 🔥`
                : `⚡ ${nombA} vs ${nombB} [${corteA}v${grupo.length - corteA}]`;
            pObj.esVenganza = hayVenganzaAsim;

        } else if (nReq === 3) {
            pObj.tipo = 'equipos3';
            pObj.ids = grupo.map(g => g.id.toString());
            pObj.p1=grupo[0].id; pObj.p2=grupo[1].id; pObj.p3=grupo[2].id;
            // ✅ Australiana: texto correcto (pareja J1+J2 vs solo J3) y tamanoEquipoA=null (no aplica)
            pObj.nombres = `🔄 ${grupo[0].nombre}+${grupo[1].nombre} vs ${grupo[2].nombre} [Australiana]`;
            pObj.tamanoEquipoA = null; // australiana no usa corte fijo — rota dinámicamente

        } else {
            pObj.tipo = 'individual';
            pObj.ids = grupo.map(g => g.id.toString());
            pObj.p1=grupo[0].id; pObj.p2=grupo[1].id;
            pObj.nombres = `${grupo[0].nombre} vs ${grupo[1].nombre}`;
        }

        pObj.pistaSugerida = _numPistaRealV2; // número real de pista sugerida por el plan
        partidosSugeridosBloque.push(pObj);

        html += `
            <div class="card" style="margin-bottom:8px; padding:12px; border-left:5px solid var(--atp-gold); background:white;">
                <small style="color:#888;">PISTA ${_numPistaRealV2} - ${{ trios:'🔱 TRÍOS', dobles:'🎾 DOBLES', individual:'🤺 INDIVIDUAL', equipos3:'🔄 AUSTRALIANA', asimetrico:'⚡ ASIMÉTRICO', gamificado:'🎮 GAMIFICADO' }[pObj.tipo] || pObj.tipo.toUpperCase()}</small><br>
                <b>${pObj.nombres}</b>
            </div>`;
    }

    const descansanV2 = copiaPool.filter(j => !estaJugando(j.id) && !j.pausado);
    if (descansanV2.length > 0) {
        html += `
            <div style="margin-top:8px; color:#d9534f; font-size:0.75rem; padding:8px; background:rgba(217,83,79,0.05); border-radius:6px;">
                🥤 Descansan: ${descansanV2.map(d => d.nombre).join(', ')}
            </div>`;
    }

    const idxPlan = window.planesTemporales.push(partidosSugeridosBloque) - 1;
    html += `
        <button class="btn-primary-atp"
            onclick="window.cargarSugerenciaEnPista(${idxPlan}, this)"
            style="width:100%; margin-top:10px; background:var(--atp-gold); color:black; font-weight:900; padding:12px; border:none; border-radius:8px; cursor:pointer; font-size:0.85rem; text-transform:uppercase;">
            🚀 LANZAR ELITE A PISTAS
        </button>`;

    contenedor.innerHTML = html;
}


// ==========================================
// FUNCIONES AUXILIARES PARA ROTACIÓN 2.0
// ==========================================

/**
 * Busca los compañeros que ha tenido un jugador en la jornada actual
 * para evitar que repitan pareja en el siguiente bloque.
 */
function obtenerCompañerosDeHoy(idJugador) {
    const idStr = idJugador.toString();
    const historial = window.partidosFinalizadosHoy || [];
    let comps = [];

    historial.forEach(p => {
        const modo = resolverModoPartido(p);

        // ✅ FIX CRÍTICO: p.ids puede contener numbers (de Firebase round-trip).
        // Sin String(), p.ids.includes(idStr) usa === estricto y nunca encuentra al jugador.
        // Normalizamos a string ANTES de cualquier includes o push para garantizar
        // que el sistema antirepetición de parejas funcione correctamente.
        const pIdsStr = (p.ids || []).map(String);

        // ✅ Australiana: rastrear TODAS las combinaciones de pareja que han jugado juntos
        if (p.tipo === 'equipos3' && pIdsStr.length === 3 && pIdsStr.includes(idStr)) {
            pIdsStr.forEach(otherId => {
                if (otherId !== idStr) comps.push(otherId); // ya es string
            });
            return;
        }

        // Rastreamos compañeros en partidos por equipos (dobles, tríos, asimétrico)
        // No en individual ni gamificado donde no hay "equipo propio"
        const esPartidoEquipo = modo.esDobles || modo.esTrio || modo.esAsimetrico;

        if (esPartidoEquipo && pIdsStr.includes(idStr)) {
            const idx  = pIdsStr.indexOf(idStr);
            // ✅ Usar tamanoEquipoA para el corte correcto en asimétrico
            const mitad = modo.mitadEquipo;
            const esEquipoA = idx < mitad;

            const inicio = esEquipoA ? 0 : mitad;
            const fin    = esEquipoA ? mitad : pIdsStr.length;

            for (let i = inicio; i < fin; i++) {
                if (pIdsStr[i] !== idStr) {
                    comps.push(pIdsStr[i]); // ya es string
                }
            }
        }
    });

    return comps;
}

// ✅ NUEVA función auxiliar para tríos, análoga a optimizarCuartetoV2()
function optimizarTrioV2(grupo) {
    // grupo = [j1, j2, j3, j4, j5, j6] ordenados por ratingElite
    // Objetivo: minimizar repetición de compañeros del turno anterior
    // Probamos las dos distribuciones más equilibradas por nivel:
    //   Opción A: [0,3,5] vs [1,2,4]  (distribución original)
    //   Opción B: [0,2,4] vs [1,3,5]  (intercalada)
    //   Opción C: [0,1,5] vs [2,3,4]  (extremos juntos)
    if (grupo.length < 6) return grupo;

    const opciones = [
        [grupo[0], grupo[3], grupo[5], grupo[1], grupo[2], grupo[4]], // A
        [grupo[0], grupo[2], grupo[4], grupo[1], grupo[3], grupo[5]], // B
        [grupo[0], grupo[1], grupo[5], grupo[2], grupo[3], grupo[4]]  // C
    ];

    let mejorOpcion = opciones[0];
    let menorPenalizacion = Infinity;

    opciones.forEach(opt => {
        let penalizacion = 0;
        // Equipo A: posiciones 0,1,2 — Equipo B: posiciones 3,4,5
        const equipoA = [opt[0], opt[1], opt[2]];
        const equipoB = [opt[3], opt[4], opt[5]];

        // Penalizar si dos miembros del mismo equipo ya jugaron juntos hoy
        [[0,1],[0,2],[1,2]].forEach(([i, k]) => {
            const compA = equipoA[i].historialParejas || [];
            const compB = equipoB[i]?.historialParejas || [];
            if (compA.includes(equipoA[k].id.toString())) penalizacion += 2;
            if (compB.includes(equipoB[k]?.id.toString())) penalizacion += 2;
        });

        if (penalizacion < menorPenalizacion) {
            menorPenalizacion = penalizacion;
            mejorOpcion = opt;
        }
    });

    return mejorOpcion;
}

