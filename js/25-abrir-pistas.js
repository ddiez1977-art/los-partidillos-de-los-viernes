/* ============================================================
   ATP PLATINUM — 25-abrir-pistas.js
   Abrir pistas, sugerencias BBDD
   ── Refactor: extraído de script.js (líneas [(8280, 8327)])
   ── Carga global clásica: este archivo NO es un módulo ES6.
      Todas las funciones siguen siendo globales (window.*) para
      mantener compatibilidad con onclick="..." en el HTML.
   ============================================================ */

function abrirPistas() {
    const modal = document.getElementById('modal-pistas');
    const inputBusqueda = document.getElementById('input-search-asistencia');
    const inputNuevo = document.getElementById('input-nuevo-asistente');
    
    if (!modal) return;
    
    // 1. Mostrar el modal con Flex
    modal.style.display = 'flex';
    
    // 2. Limpiar todos los campos de entrada para empezar de cero
    if (inputBusqueda) {
        inputBusqueda.value = "";
    }
    if (inputNuevo) {
        inputNuevo.value = "";
    }

    // 3. Resetear visualmente la lista (por si había checks marcados)
    // Esto fuerza a que se vuelva a leer la BBDD actualizada
    filtrarAsistencia();

    // 4. Foco automático en el buscador para ganar velocidad
    if (inputBusqueda) {
        setTimeout(() => inputBusqueda.focus(), 100);
    }

    // 5. Opcional: Actualizar el datalist de la cantera si lo implementaste
    if (typeof actualizarSugerenciasBusqueda === 'function') {
        actualizarSugerenciasBusqueda();
    }
    
    console.log("📋 Modal de asistencia abierto y sincronizado con la Cantera.");
}

function actualizarSugerenciasBBDD() {
    const dataList = document.getElementById('lista-nombres-cantera');
    if (!dataList) return;

    // Obtenemos todos los jugadores de la BBDD que NO están ya en la pista hoy
    const sugerencias = db.jugadores.filter(j => 
        !window.jugadoresHoy.some(h => h.id.toString() === j.id.toString())
    );

    // Limpiamos y llenamos el datalist
    dataList.innerHTML = sugerencias.map(j => `<option value="${escapeHtml(j.nombre)}">`).join('');
}

