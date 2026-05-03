/* ============================================================
   ATP PLATINUM — fans/01-config-firebase-fans.js
   Config Firebase + escapeHtml + viewer counter + listener principal
   ── Refactor: extraído de fans.js (líneas 1-72)
   ============================================================ */

// ✅ FIX XSS: helper para escapar nombres en innerHTML en fans.js
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 1. CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyCd45h83axpDzPQOJqf61FmiqHfXXtGb8M",
    authDomain: "los-partidillos-de-los-viernes.firebaseapp.com",
    databaseURL: "https://los-partidillos-de-los-viernes-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "los-partidillos-de-los-viernes",
    storageBucket: "los-partidillos-de-los-viernes.firebasestorage.app",
    messagingSenderId: "561411700558",
    appId: "1:561411700558:web:fbaf92d3f170a2f5dc901f"
};

// Inicializamos (guard contra doble inicialización en recargas parciales)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let db = {}; // Memoria local

// ── CONTADOR DE VIEWERS EN TIEMPO REAL ─────────────────────────────────────
// Usa la presencia de Firebase: cuando el usuario cierra la pestaña,
// Firebase limpia su nodo automáticamente con onDisconnect().
(function initViewerCounter() {
    const viewersRef = database.ref('fansViewers');
    const myRef = viewersRef.push(); // nodo único por sesión

    // Al desconectarse (cierre de pestaña, pérdida de red…) se borra solo
    myRef.onDisconnect().remove();

    // Registrar presencia
    myRef.set({ ts: firebase.database.ServerValue.TIMESTAMP })
        .catch(() => { /* FANS-FIX: error silencioso de presencia ignorado — no crítico */ });

    // Escuchar el total en tiempo real y actualizar el badge
    viewersRef.on('value', (snap) => {
        const count = snap.numChildren();
        const el = document.getElementById('fans-viewer-count');
        if (el) el.textContent = count;
    });
})();

// 2. CONEXIÓN EN TIEMPO REAL (El corazón del portal)
database.ref('torneoPlatinum').on('value', (snapshot) => {
    db = snapshot.val() || {};

    renderPistasFans();
    renderRankingFans();
    actualizarTickerFans();
    actualizarBotonInscripcion();
    renderHistorialFans();
}, (error) => {
    console.error('❌ Error conectando con Firebase:', error);
    const contenedorPistas = document.getElementById('fans-pistas-container');
    const contenedorRanking = document.getElementById('fans-ranking-container');
    const mensajeError = '<p style="text-align:center; color:#ff4444; padding:20px;">⚠️ Sin conexión. Refresca la página.</p>';
    if (contenedorPistas) contenedorPistas.innerHTML = mensajeError;
    if (contenedorRanking) contenedorRanking.innerHTML = mensajeError;
    // ✅ FIX Bug 4: arrancar el ticker aunque Firebase falle
    actualizarTickerFans();
});

// 3. RENDER DE PISTAS
