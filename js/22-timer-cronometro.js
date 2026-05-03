/* ============================================================
   ATP PLATINUM — 22-timer-cronometro.js
   Cronómetro general (timer global) y compartir vía WhatsApp
   ── Refactor: extraído de script.js (líneas [(7262, 7399)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

/**
 * Inicia el cronómetro de la jornada y sincroniza con el Modo TV.
 */
function startTimer() {
    // 1. Evitar múltiples intervalos activos
    if (isRunning) return;
    if (countdown) clearInterval(countdown);  // Clear any leftover
    const inputTime = document.getElementById('input-time');
   
    // 2. Inicialización lógica: si no hay tiempo restante, cargamos el valor del input
    if (timeLeft === undefined || timeLeft === null || timeLeft <= 0) {
        // Fallback a 20 minutos si el input no tiene valor o no existe
        const minutosInput = (inputTime && inputTime.value) ? parseInt(inputTime.value) : 20;
        timeLeft = minutosInput * 60;
    }
    isRunning = true;
    // 3. Crear el intervalo de cuenta atrás
    countdown = setInterval(() => {
        if (timeLeft <= 0) {
            finalizarCronometro();
            return;
        }
        timeLeft--;
        actualizarInterfazTimer();
       
    }, 1000);
}

/**
 * Función auxiliar para actualizar los textos en el HTML y enviar datos a la TV
 */
// MODIFICACIÓN: Enviar tiempo a la TV cada segundo
function actualizarInterfazTimer() {
    const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    const tiempoFormateado = `${mins}:${secs}`;

    // Actualizar UI Principal
    const minElem = document.getElementById('minutes');
    const secElem = document.getElementById('seconds');
    if (minElem) minElem.innerText = mins;
    if (secElem) secElem.innerText = secs;

    // MANDAR A TV: Esto hace que el reloj de la TV se mueva al unísono
    if (window.tvChannel) {
        window.tvChannel.postMessage({ 
            action: 'UPDATE_TIMER', 
            time: tiempoFormateado 
        });
    }
}


/**
 * Acción cuando el tiempo llega a cero
 */
function finalizarCronometro() {
    clearInterval(countdown);
    isRunning = false;
    timeLeft = 0;
    countdown = null;  // Clear countdown
    // Alerta visual
    alert("🎾 ¡TIEMPO FINALIZADO! Fin de los partidos en juego.");
   
    // Notificar a la TV para que cambie a estado de "Descanso" o alerta
    if (window.tvChannel) {
        window.tvChannel.postMessage({ action: 'TIMER_FINISHED' });
    }
}
function pauseTimer() {
    if (countdown) clearInterval(countdown);
    countdown = null;
    isRunning = false;
    // Notificar a la TV que el tiempo se ha detenido
    if (window.tvChannel) {
        window.tvChannel.postMessage({
            action: 'TIMER_PAUSED'
        });
    }
}

function resetTimer() {
    // ✅ FIX: No llamamos a pauseTimer() porque envía TIMER_PAUSED a la TV,
    // lo que hace que la TV parpadee entre estado "pausado" y el UPDATE_TIMER
    // que mandamos justo después. Replicamos solo la parte de limpieza del
    // intervalo sin el postMessage innecesario.
    if (countdown) clearInterval(countdown);
    countdown = null;
    isRunning = false;

    const inputTime = document.getElementById('input-time');
    const valorBase = (inputTime && inputTime.value) ? parseInt(inputTime.value) : 15;

    timeLeft = valorBase * 60;

    const mins = valorBase.toString().padStart(2, '0');
    const secs = "00";

    if (document.getElementById('minutes')) document.getElementById('minutes').innerText = mins;
    if (document.getElementById('seconds')) document.getElementById('seconds').innerText = secs;

    // Enviamos directamente UPDATE_TIMER — sin TIMER_PAUSED previo
    if (window.tvChannel) {
        window.tvChannel.postMessage({
            action: 'UPDATE_TIMER',
            time: `${mins}:${secs}`
        });
    }
}
// 2. FUNCIÓN COMPARTIR (Asegúrate de que esté escrita así)
function compartirWhatsApp() {
    const lista = window.partidosFinalizadosHoy || [];
    if (lista.length === 0) return alert("⚠️ No hay resultados registrados hoy.");

    const URL_FANS = "https://los-partidillos-de-los-viernes.netlify.app/fans/fans.html";
    const hoy = new Date().toLocaleDateString();

    let mensaje = `🎾 *ATP MASTER - RESULTADOS* 🎾\n`;
    mensaje += `📅 ${hoy} · ${lista.length} partido${lista.length !== 1 ? 's' : ''}\n`;
    mensaje += `━━━━━━━━━━━━━━━━\n\n`;

    lista.forEach(p => {
        const modo = resolverModoPartido(p);
        // Marcador limpio: preferir marcador guardado; si es 0-0 con TB, mostrar TB
        let marcador = p.marcador && p.marcador !== '0-0' && p.marcador !== '0 - 0'
            ? p.marcador : `${p.juegosA || 0}-${p.juegosB || 0}`;
        if ((marcador === '0-0' || marcador === '0 - 0') && p.tiebreak) {
            marcador = `TB ${p.tbPuntosA || 0}-${p.tbPuntosB || 0}`;
        }
        mensaje += `${modo.icono} ${p.nombres} → *${marcador}*\n`;
    });

    mensaje += `\n━━━━━━━━━━━━━━━━\n`;
    mensaje += `📡 *Ranking en directo:* ${URL_FANS}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
}

