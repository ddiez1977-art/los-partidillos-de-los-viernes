/* ============================================================
   ATP PLATINUM — 24-plan-maestro.js
   Plan maestro v1, decisión de modalidad, finalizar turno, notificaciones, copiar a WhatsApp
   ── Refactor: extraído de script.js (líneas [(7788, 8279)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function finalizarTurno(sobrantesEnEsteTurno) {
    // A los que se quedaron fuera, les sumamos un punto de prioridad
    (window.jugadoresHoy || []).forEach(j => {
        // ✅ FIX: String() en ambos lados — Firebase puede deserializar IDs
        // como number en unos jugadores y string en otros. Sin coerción, el find
        // nunca matchea y el sistema de prioridad de rotación queda roto.
        if (sobrantesEnEsteTurno.find(s => String(s.id) === String(j.id))) {
            j.descansosSeguidos = (j.descansosSeguidos || 0) + 1;
        } else {
            j.descansosSeguidos = 0; // Si jugaron, resetean prioridad
        }
    });

    saveDB(); // ← IMPORTANTE: Guardamos el cambio de prioridad
}



// 🛡️ DEPENDENCIA GLOBAL VITAL: Necesaria para que cargarSugerenciaEnPista() funcione al hacer clic
window.planesTemporales = window.planesTemporales || [];


// ==========================================
// MOTOR DE DECISIÓN DE MODALIDAD (COMPARTIDO)
// Decide cuántos jugadores necesita una pista
// dado el total de disponibles y la estrategia
// ==========================================
function decidirModalidad(totalDisponibles, estrategia) {
    // ─── Estrategias fijas: no se mezclan con lógica de tríos ───────────────
    if (estrategia === 'individual') {
        return { nReq: 2, modo: 'individual' };
    }

    if (estrategia === 'equipos3') {
        if (totalDisponibles >= 3) return { nReq: 3, modo: 'equipos3' };
        return { nReq: 2, modo: 'individual' };
    }

    // ✅ Modo asimétrico: 3v2 si hay 5, 2v1 si hay 3, fallback individual si solo hay 2
    if (estrategia === 'asimetrico') {
        if (totalDisponibles >= 5) return { nReq: 5, modo: 'asimetrico', tamanoEquipoA: 3 }; // 3v2
        if (totalDisponibles >= 3) return { nReq: 3, modo: 'asimetrico', tamanoEquipoA: 2 }; // 2v1
        if (totalDisponibles >= 2) return { nReq: 2, modo: 'individual' }; // sin desigualdad → individual
        return { nReq: 0, modo: null };
    }

    // ✅ FIX: Si el usuario eligió explícitamente 'trios', respetamos esa
    // elección sin condiciones adicionales de número de jugadores.
    if (estrategia === 'trios') {
        if (totalDisponibles >= 6) return { nReq: 6, modo: 'trios' };
        // Si no hay suficientes para un trío completo, caemos a dobles o individual
        if (totalDisponibles >= 4) return { nReq: 4, modo: 'dobles' };
        if (totalDisponibles >= 2) return { nReq: 2, modo: 'individual' };
        return { nReq: 0, modo: null };
    }

    // ─── Estrategia 'dobles' (por defecto) ──────────────────────────────────
    // ✅ FIX: Los bloques de tríos automáticos ahora solo se activan cuando
    // la estrategia es 'dobles'. Antes se ejecutaban para CUALQUIER estrategia
    // porque estaban al principio de la función, antes del check de estrategia.

    // Casos donde un trío encaja perfectamente (nadie se queda sin jugar)
    const casosTrioPerfecto = [6, 10, 14, 18];
    if (casosTrioPerfecto.includes(totalDisponibles)) {
        return { nReq: 6, modo: 'trios' };
    }

    // Si al hacer dobles sobran exactamente 3 jugadores, mejor hacer un trío
    if (totalDisponibles >= 6) {
        const sobranteSiHacemosDobles = totalDisponibles % 4;
        if (sobranteSiHacemosDobles === 3) {
            return { nReq: 6, modo: 'trios' };
        }
        // Con 7 jugadores, trío es más justo que dejar 3 en el banquillo
        if (totalDisponibles === 7) {
            return { nReq: 6, modo: 'trios' };
        }
        return { nReq: 4, modo: 'dobles' };
    }

    if (totalDisponibles >= 4) return { nReq: 4, modo: 'dobles' };
    if (totalDisponibles >= 2) return { nReq: 2, modo: 'individual' };

    return { nReq: 0, modo: null };
}

function generarPlanMaestro() {
    // 🛡️ PASO 0: LIMPIEZA DE SEGURIDAD
    if (typeof limpiezaSeguridadJornada === 'function') limpiezaSeguridadJornada(true);

    // 1. CAPTURA DE TIEMPOS Y ESTRATEGIA
    const horasInput = document.getElementById('plan-hours');
    const horas = parseInt(horasInput?.value, 10) || 1;
    const totalMinutos = horas * 60;
    
    const duracionBloque = parseInt(document.getElementById('plan-duracion')?.value) || 20;
    const estrategia = document.getElementById('estrategia-rotacion')?.value || 'dobles';
    const descanso = parseInt(document.getElementById('plan-descanso')?.value) || 5;

    // 2. LECTURA DE CAJAS DE PISTAS
    const configPistas = [];      // nº de pistas activas por hora
    const configPistasNums = [];  // números de pistas disponibles por hora
    const filasPistas = document.querySelectorAll('.fila-pistas-hora');

    if (filasPistas.length > 0) {
        filasPistas.forEach(fila => {
            const activasCajas = fila.querySelectorAll('.caja-pista-check.activa');
            configPistas.push(activasCajas.length);
            const nums = Array.from(activasCajas).map(c => {
                const m = c.textContent.trim().match(/\d+/);
                return m ? parseInt(m[0]) : null;
            }).filter(n => n !== null);
            configPistasNums.push(nums);
        });
    }

    // ✅ FIX BUG V1: si no hay cajas marcadas (ninguna pista activa),
    // el plan generaba 0 partidos en silencio. Igual que V2, usamos
    // las pistas físicamente libres como fallback.
    const _pistasOcupadasV1 = new Set((window.partidosAbiertos || []).map(p => String(p.pista)));
    const _pistasLibresV1 = Array.from({ length: parseInt(document.getElementById('plan-pistas-totales')?.value) || 2 }, (_, i) => i + 1)
        .filter(n => !_pistasOcupadasV1.has(String(n)));

    const ningunaActiva = configPistas.every(n => n === 0);
    if (ningunaActiva || filasPistas.length === 0) {
        // Fallback: tratar todas las pistas libres físicas como activas en cada hora
        for (let i = 0; i < Math.max(1, filasPistas.length || 1); i++) {
            configPistas[i] = _pistasLibresV1.length;
            configPistasNums[i] = [..._pistasLibresV1];
        }
    }

    // 3. FILTRADO DE DISPONIBLES
    // Los invitados se separan del pool: participan si hay huecos sobrantes,
    // pero NO afectan al cálculo de quórum ni a la lógica de rotación/descansos.
    const disponiblesHoy = (window.jugadoresHoy || []).filter(j =>
        !j.pausado && !estaJugando(j.id)
    );
    const disponiblesRanking  = disponiblesHoy.filter(j => !j.esInvitado);
    const disponiblesInvitado = disponiblesHoy.filter(j =>  j.esInvitado);

    if (disponiblesRanking.length < 2 && disponiblesHoy.length < 2) {
        return alert("⚠️ Necesitas al menos 2 jugadores libres para planificar.");
    }

    // 4. CÁLCULO DE RATING DINÁMICO
    // Primero los jugadores de ranking (ordenados por nivel/rating),
    // luego los invitados al final del pool para que sean "relleno de huecos".
    function calcularPool(lista) {
        return lista.map(j => {
            const habs = j.habilidades || { Saque: 5, Derecha: 5, Reves: 5, Volea: 5, Mental: 5 };
            const mediaHab = Object.values(habs).reduce((a, b) => a + b, 0) / 5;
            let juegosF = 0, juegosC = 0, partidosJugados = 0;
            (window.partidosFinalizadosHoy || []).forEach(p => {
                if (p.ids?.includes(j.id.toString())) {
                    partidosJugados++;
                    if (p.tipo === 'equipos3' && p.puntosAustraliana) {
                        const pts = p.puntosAustraliana;
                        const misAus = Number(pts[j.id.toString()] || 0);
                        const totalAus = Object.values(pts).reduce((s, v) => s + Number(v || 0), 0);
                        juegosF += misAus; juegosC += totalAus - misAus;
                    } else if (p.juegosA !== undefined && p.juegosB !== undefined) {
                        const _mitadRating = p.tamanoEquipoA != null
                            ? Number(p.tamanoEquipoA) : Math.floor(p.ids.length / 2);
                        const esEquipoA = p.ids.indexOf(j.id.toString()) < _mitadRating;
                        juegosF += esEquipoA ? p.juegosA : p.juegosB;
                        juegosC += esEquipoA ? p.juegosB : p.juegosA;
                    }
                }
            });
            const bonusEspera = (j.descansosSeguidos || 0) * 2.5;
            const ratingHoy = mediaHab + ((juegosF - juegosC) * 0.15) - (partidosJugados * 0.5) + bonusEspera;
            return { ...j, ratingHoy: isNaN(ratingHoy) ? mediaHab : ratingHoy, nivelNum: parseFloat(j.nivel) || 0 };
        });
    }

    const poolRanking = calcularPool(disponiblesRanking).sort((a, b) =>
        b.nivelNum !== a.nivelNum ? b.nivelNum - a.nivelNum : b.ratingHoy - a.ratingHoy
    );
    const poolInvitados = calcularPool(disponiblesInvitado);
    const poolData = [...poolRanking, ...poolInvitados];

    // 5. GENERACIÓN DE TURNOS
    let html = "";
    let tiempoUsado = 0;
    let bloqueIdx = 0;
    window.planesTemporales = [];
    let copiaPool = [...poolData];

    while (tiempoUsado + duracionBloque <= totalMinutos) {
        const horaIndex = Math.floor(tiempoUsado / 60);
        const pistasAhora = configPistas[horaIndex] !== undefined 
            ? configPistas[horaIndex] 
            : (configPistas[0] || 2);

        // Números reales de pista para este tramo horario
        const numsAhora = (configPistasNums[horaIndex] && configPistasNums[horaIndex].length > 0)
            ? configPistasNums[horaIndex]
            : Array.from({length: pistasAhora}, (_, i) => i + 1);

        if (pistasAhora === 0) {
            tiempoUsado += (duracionBloque + descanso);
            bloqueIdx++;
            continue;
        }

        // ✅ FIX: disponiblesTurno ya NO se calcula aquí una sola vez.
        // Se recalcula dentro del bucle de pistas para capturar los jugadores
        // asignados en pistas anteriores del mismo bloque.
        // Solo inicializamos partidosSugeridos aquí.
        let partidosSugeridos = [];

        const colorBloque = bloqueIdx % 2 === 0 ? 'var(--atp-gold)' : 'var(--atp-blue)';
        html += `
            <div class="card" style="border:1px solid #ddd; margin-bottom:12px; background:white; border-left:5px solid ${colorBloque}; box-shadow:0 2px 5px rgba(0,0,0,0.1); padding:12px; border-radius:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <b style="color:var(--atp-navy)">🕒 BLOQUE ${bloqueIdx + 1} (${pistasAhora} pistas)</b>
                    <span style="font-size:0.7rem; color:#666; font-weight:bold;">⏳ T+${tiempoUsado} min</span>
                </div>`;

        for (let p = 1; p <= pistasAhora; p++) {
            const numPistaReal = numsAhora[p - 1] || p; // número real de pista del club

            // ✅ FIX: Recalculamos disponibles en cada iteración de pista.
            // Esto evita que la pista 2 intente usar jugadores ya asignados
            // a la pista 1 dentro del mismo bloque. El filtro contra
            // estaJugando() también captura cambios de otros dispositivos.
            const disponiblesAhora = copiaPool.filter(j => !estaJugando(j.id) && !j.pausado);

            const decision = decidirModalidad(disponiblesAhora.length, estrategia);
            const nReq = decision.nReq;
            const modo = decision.modo;

            if (nReq < 2 || disponiblesAhora.length < nReq) {
                html += `<span style="opacity:0.4; font-style:italic;">🚫 <b>PISTA ${numPistaReal}:</b> Sin jugadores suficientes</span><br>`;
                continue;
            }

            // ✅ FIX: Extraemos de disponiblesAhora (ya filtrado) y eliminamos
            // esos mismos IDs de copiaPool para la siguiente iteración de pista.
            const grupo = disponiblesAhora.splice(0, nReq);
            const idsGrupo = new Set(grupo.map(g => g.id.toString()));
            copiaPool = copiaPool.filter(j => !idsGrupo.has(j.id.toString()));

            const pObj = {
                tipo: modo,
                ids: grupo.map(g => g.id.toString()),
                p1: grupo[0]?.id || null,
                p2: grupo[1]?.id || null,
                p3: grupo[2]?.id || null,
                p4: grupo[3]?.id || null,
                p5: grupo[4]?.id || null,
                p6: grupo[5]?.id || null,
                // ✅ FIX: propagar tamanoEquipoA desde decidirModalidad
                // para que cargarSugerenciaEnPista lo persista correctamente
                tamanoEquipoA: decision.tamanoEquipoA ?? null
            };

            if (modo === 'trios') {
                html += `🔱 <b>PISTA ${numPistaReal}:</b> ${escapeHtml(grupo[0].nombre)}+${escapeHtml(grupo[1].nombre)}+${escapeHtml(grupo[2].nombre)} vs ${escapeHtml(grupo[3].nombre)}+${escapeHtml(grupo[4].nombre)}+${escapeHtml(grupo[5].nombre)}<br>`;
                pObj.nombres = `🔱 ${grupo[0].nombre}+${grupo[1].nombre}+${grupo[2].nombre} vs ${grupo[3].nombre}+${grupo[4].nombre}+${grupo[5].nombre}`;
            } else if (modo === 'asimetrico') {
                const corteA = decision.tamanoEquipoA ?? Math.ceil(grupo.length / 2);
                const nombA = grupo.slice(0, corteA).map(j => escapeHtml(j.nombre)).join('+');
                const nombB = grupo.slice(corteA).map(j => escapeHtml(j.nombre)).join('+');
                html += `⚡ <b>PISTA ${numPistaReal}:</b> ${nombA} vs ${nombB} [${corteA}v${grupo.length - corteA}]<br>`;
                pObj.nombres = `⚡ ${grupo.slice(0, corteA).map(j => j.nombre).join('+')} vs ${grupo.slice(corteA).map(j => j.nombre).join('+')}`;
            } else if (modo === 'dobles') {
                html += `🎾 <b>PISTA ${numPistaReal}:</b> ${escapeHtml(grupo[0].nombre)}/${escapeHtml(grupo[1].nombre)} vs ${escapeHtml(grupo[2].nombre)}/${escapeHtml(grupo[3].nombre)}<br>`;
                pObj.nombres = `${grupo[0].nombre}/${grupo[1].nombre} vs ${grupo[2].nombre}/${grupo[3].nombre}`;
            } else if (modo === 'equipos3') {
                html += `🔄 <b>PISTA ${numPistaReal}:</b> ${escapeHtml(grupo[0].nombre)}+${escapeHtml(grupo[1].nombre)} vs ${escapeHtml(grupo[2].nombre)} [Australiana]<br>`;
                pObj.nombres = `🔄 ${grupo[0].nombre}+${grupo[1].nombre} vs ${grupo[2].nombre} [Australiana]`;
            } else {
                html += `🤺 <b>PISTA ${numPistaReal}:</b> ${escapeHtml(grupo[0].nombre)} vs ${escapeHtml(grupo[1].nombre)}<br>`;
                pObj.nombres = `${grupo[0].nombre} vs ${grupo[1].nombre}`;
            }

            pObj.pistaSugerida = numPistaReal; // número real de pista sugerida por el plan
            partidosSugeridos.push(pObj);
        }

        // ✅ FIX: Los jugadores que descansan son los que quedan en copiaPool
        // tras asignar todas las pistas del bloque. Antes se leían de
        // disponiblesTurno que ya no existe como variable de bloque.
        const descansanBloque = copiaPool.filter(j => !estaJugando(j.id) && !j.pausado);
        if (descansanBloque.length > 0) {
            html += `
                <div style="margin-top:8px; color:#d9534f; font-size:0.75rem; border-top:1px dashed #eee; padding-top:4px;">
                    🥤 Descansan: ${descansanBloque.map(d => escapeHtml(d.nombre)).join(', ')}
                </div>`;
        }

        const idxPlan = window.planesTemporales.push(partidosSugeridos) - 1;

        html += `
            <div style="display:flex; gap:8px; margin-top:10px;">
                <button class="btn-bloque-plan" 
                    onclick="window.cargarSugerenciaEnPista(${idxPlan}, this)" 
                    style="flex:2; padding:10px; background:var(--atp-gold); color:black; border:none; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:900; text-transform:uppercase;">
                    🚀 LANZAR BLOQUE ${bloqueIdx + 1} A TV
                </button>
                <button 
                    onclick="notificarProximosPartidos(${idxPlan})"
                    style="flex:1; padding:10px; background:var(--atp-navy); color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.7rem; font-weight:bold;">
                    📢 AVISAR
                </button>
            </div>
        </div>`;

        // Rotación circular del pool para el siguiente bloque
        tiempoUsado += (duracionBloque + descanso);
        bloqueIdx++;
        const primero = copiaPool.shift();
        if (primero !== undefined) copiaPool.push(primero);
    }

    // 6. RENDER FINAL
    const resultadoDiv = document.getElementById('resultado-planificacion');
    if (resultadoDiv) {
        resultadoDiv.innerHTML = html || `
            <p style="text-align:center; padding:40px; color:#999; font-style:italic; border:2px dashed #ddd; border-radius:10px;">
                ⚙️ Ajusta los parámetros y pulsa GENERAR PLAN.
            </p>`;
    }
}

function notificarProximosPartidos(index) {
    const sugerencias = window.planesTemporales[index];
    if (!sugerencias) return;

    const listaParaTV = sugerencias.map(s => {
        // --- 🛡️ BÚSQUEDA ROBUSTA DE NOMBRES ---
        const getNombre = (id) => {
            if (!id) return "?";
            const j = db.jugadores.find(jug => jug.id.toString() === id.toString());
            return j ? j.nombre : "?";
        };

        const n1 = getNombre(s.p1);
        const n2 = getNombre(s.p2);
        const n3 = getNombre(s.p3);
        const n4 = getNombre(s.p4);
        const n5 = getNombre(s.p5); // ✅ Soporte Trío
        const n6 = getNombre(s.p6); // ✅ Soporte Trío

        // --- 🔥 DETECCIÓN DE MODO VENGANZA ---
        const esVenganza = (s.nombres && s.nombres.includes("🔥")) || s.esVenganza === true;
        const icono = esVenganza ? "🔥 " : "🎾 ";

        // --- 🔱 CONSTRUCCIÓN DE TEXTO SEGÚN MODALIDAD ---
        let textoPartido = "";

        if (s.tipo === 'trios' || (s.p5 && s.p6 && n5 !== "?" && n6 !== "?")) {
            // Formato Tríos: J1+J2+J3 VS J4+J5+J6
            textoPartido = `🔱 ${n1}+${n2}+${n3} VS ${n4}+${n5}+${n6}`;

        } else if (s.tipo === 'asimetrico') {
            // ✅ FIX Fix 10: rama asimétrico en notificarProximosPartidos (TV broadcast)
            // Usamos tamanoEquipoA guardado en pObj para reconstruir el corte correcto
            const corteTV = s.tamanoEquipoA ?? Math.ceil(s.ids.length / 2);
            const allNombres = [n1, n2, n3, n4, n5, n6].filter((n, i) => i < s.ids.length && n !== '?');
            const eqATV = allNombres.slice(0, corteTV).join('+');
            const eqBTV = allNombres.slice(corteTV).join('+');
            textoPartido = `${icono}⚡ ${eqATV} vs ${eqBTV} [${corteTV}v${s.ids.length - corteTV}]`;

        } else if (s.tipo === 'dobles' || (s.p1 && s.p2 && s.p3 && s.p4)) {
            // Formato Dobles: J1/J2 VS J3/J4
            textoPartido = `${icono}${n1}/${n2} VS ${n3}/${n4}`;

        } else if (s.tipo === 'equipos3') {
            // ✅ Australiana: pareja inicial vs solo
            textoPartido = `${icono}🔄 ${n1}+${n2} vs ${n3} [Australiana]`;

        } else {
            // Formato Individual: J1 VS J2
            textoPartido = `${icono}${n1} VS ${n2}`;
        }

        // Si es venganza y no es trío/asimétrico, añadir emoji al final también
        if (esVenganza && s.tipo !== 'trios' && s.tipo !== 'asimetrico') {
            textoPartido = textoPartido + " 🔥";
        }

        return {
            texto: textoPartido,
            venganza: esVenganza,
            tipo: s.tipo || 'individual',
            pistaSugerida: s.pista || null
        };
    });

    // 1. Envío por BroadcastChannel (Inmediato)
    if (window.tvChannel) {
        window.tvChannel.postMessage({
            action: 'SHOW_ANNOUNCEMENT',
            titulo: "📢 PRÓXIMOS ENTRAR",
            subtitulo: "Por favor, acérquense a sus pistas asignadas",
            partidos: listaParaTV,
            duracion: 12000,
            timestamp: Date.now()
        });
    }

    // 2. Persistencia de Respaldo (Sync dual)
    localStorage.setItem('atp_tv_announcement', JSON.stringify({
        partidos: listaParaTV,
        ts: Date.now(),
        leido: false
    }));

    console.log(`📺 TV BROADCAST: ${listaParaTV.length} partidos anunciados.`);
}

function copiarPlanWhatsApp() {
    // Fuente primaria: window.planesTemporales (datos estructurados, inmunes a artefactos DOM).
    // Si no existe, caer al DOM como fallback.
    const URL_FANS = "https://los-partidillos-de-los-viernes.netlify.app/fans/fans.html";
    const _presentesPlan = (window.jugadoresHoy || []).filter(j => !j.pausado).length;
    const _modoLabel = t => ({ trios:'🔱 TRÍOS', dobles:'🎾 DOBLES', individual:'🤺 INDIVIDUAL',
        equipos3:'🔄 AUSTRALIANA', asimetrico:'⚡ ASIMÉTRICO', gamificado:'🎮 GAMIFICADO' }[t] || t?.toUpperCase() || '');
    const _gn = id => (db.jugadores || []).find(x => String(x.id) === String(id))?.nombre || '???';

    let texto = "🎾 *PLANIFICACIÓN ATP MASTER* 🎾\n";
    if (_presentesPlan > 0) texto += `👥 ${_presentesPlan} jugadores disponibles\n`;
    texto += "\n";

    let bloques = 0;

    // Fuente robusta: datos estructurados en memoria
    if (Array.isArray(window.planesTemporales) && window.planesTemporales.length > 0) {
        window.planesTemporales.forEach((bloque, bi) => {
            if (!Array.isArray(bloque) || bloque.length === 0) return;
            bloques++;
            if (window.planesTemporales.length > 1) texto += `*── BLOQUE ${bi + 1} ──*\n`;
            const descansanBloque = (window.jugadoresHoy || []).filter(j => {
                const enBloque = bloque.some(p => (p.ids || []).map(String).includes(String(j.id)));
                return !enBloque && !j.pausado;
            });
            bloque.forEach(p => {
                const pistaStr = p.pistaSugerida ? `PISTA ${p.pistaSugerida}` : '';
                const modoStr  = _modoLabel(p.tipo);
                const label    = [pistaStr, modoStr].filter(Boolean).join(' · ');
                texto += label ? `_${label}_\n` : '';
                texto += `${p.nombres || (p.ids || []).map(_gn).join(' / ')}\n\n`;
            });
            if (descansanBloque.length > 0) {
                texto += `🥤 _Descansan: ${descansanBloque.map(j => j.nombre).join(', ')}_\n\n`;
            }
        });
    }

    // Fallback: DOM si no hay datos en memoria
    if (bloques === 0) {
        const resultadoDiv = document.getElementById('resultado-planificacion');
        if (!resultadoDiv || resultadoDiv.innerText.trim().length < 10) {
            return alert("⚠️ No hay plan generado para copiar.");
        }
        resultadoDiv.querySelectorAll('.card').forEach(card => {
            const titulo = card.querySelector('b')?.innerText?.trim() || '';
            if (!titulo) return;
            const clone = card.cloneNode(true);
            clone.querySelectorAll('button, .btn-bloque-plan, .btn-primary-atp').forEach(el => el.remove());
            const lineas = clone.innerText.split('\n').map(l => l.trim())
                .filter(l => l && l !== titulo && !l.startsWith('🚫'));
            if (!lineas.length) return;
            bloques++;
            texto += `*${titulo}*\n${lineas.join('\n')}\n\n`;
        });
    }

    if (bloques === 0 || texto.trim().length < 30) {
        return alert("⚠️ No hay plan generado para copiar.");
    }

    texto += `━━━━━━━━━━━━━━━━\n`;
    texto += `📡 *Sigue los partidos en directo:*\n${URL_FANS}\n`;

    const _doClipboard = (t) => {
        navigator.clipboard.writeText(t).then(() => {
            alert("🚀 Plan copiado al portapapeles.\n¡Ya puedes pegarlo en el grupo de WhatsApp!");
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = t; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
            alert("🚀 Plan copiado al portapapeles.\n¡Ya puedes pegarlo en el grupo de WhatsApp!");
        });
    };
    _doClipboard(texto);
}


