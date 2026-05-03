/* ============================================================
   ATP PLATINUM — inscripciones/01-config-firebase-inscripciones.js
   Config Firebase + estado local + helper toArr
   ── Refactor: extraído de inscripciones.html (líneas 231-306)
   ============================================================ */

// ── FIREBASE ──────────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyCd45h83axpDzPQOJqf61FmiqHfXXtGb8M",
    authDomain: "los-partidillos-de-los-viernes.firebaseapp.com",
    databaseURL: "https://los-partidillos-de-los-viernes-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "los-partidillos-de-los-viernes",
    storageBucket: "los-partidillos-de-los-viernes.firebasestorage.app",
    messagingSenderId: "561411700558",
    appId: "1:561411700558:web:fbaf92d3f170a2f5dc901f"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ── ESTADO ───────────────────────────────────────────────────────────────
let dbLocal = { jugadores:[], convocatoriaActiva:[], convocatoriaAbierta:false };
let pistasReservadas = [];   // array de reservas
let numPistasClub    = 4;    // fallback; se actualiza desde Firebase

// ── ÚNICO LISTENER FIREBASE ───────────────────────────────────────────────
// Un solo .on('value') sobre el nodo raíz evita colisiones entre listeners.
database.ref('torneoPlatinum').on('value', (snap) => {
    const data = snap.val() || {};

    // — Inscripción —
    dbLocal.jugadores           = toArr(data.jugadores);
    dbLocal.convocatoriaActiva  = toArr(data.convocatoriaActiva);
    dbLocal.convocatoriaAbierta = data.convocatoriaAbierta || false;

    // — Pistas del club —
    // Leer cuántas pistas tiene el club desde múltiples fuentes
    if (data.numPistasClub && Number(data.numPistasClub) > 0) {
        numPistasClub = Number(data.numPistasClub);
    } else if (data.pistasEstado && typeof data.pistasEstado === 'object') {
        // pistasEstado = { hora: { pistaN: {...} } }
        // Contar el máximo número de pista que aparece en cualquier hora
        let maxPista = 0;
        Object.values(data.pistasEstado).forEach(hora => {
            if (hora && typeof hora === 'object') {
                Object.keys(hora).forEach(k => {
                    const n = Number(k);
                    if (!isNaN(n) && n > maxPista) maxPista = n;
                });
            }
        });
        if (maxPista > 0) numPistasClub = maxPista;
    }
    // Fallback: si no hay configuración, usar 8 (valor por defecto del admin)
    if (!numPistasClub || numPistasClub < 1) numPistasClub = 8;

    // — Reservas de pistas —
    const raw = data.pistasReservadas;
    if (Array.isArray(raw))                 pistasReservadas = raw.filter(Boolean);
    else if (raw && typeof raw === 'object') pistasReservadas = Object.values(raw).filter(Boolean);
    else                                     pistasReservadas = [];

    // Actualizar vistas
    actualizarInscripcion();
    if (document.getElementById('tab-pistas').style.display !== 'none') {
        renderPistas();
    }

}, (err) => {
    console.error('Firebase error:', err);
    document.getElementById('lista-jugadores').innerHTML =
        '<div class="no-results">⚠️ Error de conexión. Recarga la página.</div>';
    const pill = document.getElementById('portal-status');
    if (pill) { pill.textContent = '⚠️ SIN CONEXIÓN'; pill.className = 'portal-status closed'; }
});

function toArr(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
    return [];
}

// ══════════════════════════════════════════════════════════════════════════
