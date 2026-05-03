// ✅ FIX XSS GLOBAL: helper para escapar nombres/emails de usuarios en innerHTML.
// Sin esto, un usuario con displayName "<img src=x onerror=alert(1)>" en Google
// puede inyectar HTML en el panel de solicitudes de acceso del admin.
function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const auth = firebase.auth();
window.rolUsuario = null;
// ✅ FIX BUG ROL TARDÍO: flag que verificarRol pone a true cuando termina.
// accederSistemaConAuth lo usa para distinguir "rol denegado" (mostrar alert)
// de "rol pendiente, Firebase aún consulta admins/arbitros" (esperar al rol).
// Sin esto, los primeros clicks tras cargar la app rebotaban con
// "Acceso restringido" porque rolUsuario era null mientras llegaba la respuesta.
window._rolResuelto = false;

// ── ARRANQUE ──────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
    if (user) await verificarRol(user, false); // false = no redirigir automáticamente
    else {
        // ✅ FIX BUG ROL TARDÍO: usuario cerró sesión o nunca la inició.
        // Reseteamos rol, marcamos resuelto (=sin permisos) y cancelamos
        // cualquier navegación que estuviera esperando.
        window.rolUsuario = null;
        window._rolResuelto = true;
        window._navegacionPendienteTrasRol = null;
        clearTimeout(window._timeoutEsperaRol);
    }
});

// ── VERIFICAR ROL ─────────────────────────────────────────────────────────────
async function verificarRol(user, redirigir = true) {
    // ✅ FIX BUG PERMISSION_DENIED EN CARGA — versión final tras analizar reglas reales:
    // Las reglas de Firebase típicas dejan al propio usuario leer /arbitros/{su_uid}
    // y /solicitudesAcceso/{su_uid}, pero solo a admins leer /admins/{cualquier_uid}.
    //
    // PROBLEMA: a veces las 3 lecturas fallan con permission_denied, INCLUSO la de
    // /arbitros/{su_uid} y /solicitudesAcceso/{su_uid} que la regla permite. La causa
    // suele ser una race condition: la SDK ejecuta .get() antes de que el token de
    // auth se haya propagado al backend de Realtime Database, así que las reglas
    // evalúan auth.uid como null y rechazan TODAS las lecturas.
    //
    // FIX: forzamos a que Firebase obtenga el token reciente antes de leer.
    // user.getIdToken(true) garantiza que el siguiente .get() llegue al servidor
    // con el token de auth válido, evitando el race condition.
    try {
        await user.getIdToken(/* forceRefresh */ true);
    } catch (e) {
        console.warn('No se pudo obtener token de auth:', e.message);
    }

    // Cada .get() captura su error individualmente. Si falla con permission_denied
    // (porque la regla bloquea o el token sigue sin llegar), tratamos como "no es
    // de ese rol" y seguimos al siguiente check, sin propagar la unhandled rejection
    // que antes aparecía como "Uncaught (in promise) Error: Permission denied".
    const _safeGet = ref => ref.get().then(
        snap => snap,
        err => {
            return { exists: () => false, val: () => null, _denied: true, _err: err.message };
        }
    );
    const _leerTodos = () => Promise.all([
        _safeGet(firebase.database().ref('admins/' + user.uid)),
        _safeGet(firebase.database().ref('arbitros/' + user.uid)),
        _safeGet(firebase.database().ref('solicitudesAcceso/' + user.uid))
    ]);

    let [snapAdmin, snapArbitro, snapSolicitud] = await _leerTodos();

    // ✅ FIX RETRY: si las 3 fallaron con permission_denied, casi seguro es race
    // condition con el token de auth. Esperamos 500ms y reintentamos. Solo 1 reintento
    // para no entrar en bucle si las reglas están realmente mal configuradas.
    const todasFallaron = snapAdmin._denied && snapArbitro._denied && snapSolicitud._denied;
    if (todasFallaron) {
        console.log('⏳ Las 3 lecturas fallaron, reintentando en 500ms tras refrescar token...');
        await new Promise(r => setTimeout(r, 500));
        try { await user.getIdToken(true); } catch(e) {}
        [snapAdmin, snapArbitro, snapSolicitud] = await _leerTodos();
    }

    // Logging de diagnóstico solo si siguen fallando tras el reintento
    if (snapAdmin._denied)     console.warn(`Lectura /admins/${user.uid}: ${snapAdmin._err}`);
    if (snapArbitro._denied)   console.warn(`Lectura /arbitros/${user.uid}: ${snapArbitro._err}`);
    if (snapSolicitud._denied) console.warn(`Lectura /solicitudesAcceso/${user.uid}: ${snapSolicitud._err}`);

    const esAdmin   = snapAdmin.exists()   && snapAdmin.val()   === true;
    const esArbitro = snapArbitro.exists() && snapArbitro.val() === true;

    // ✅ FIX BUG ROL TARDÍO: marcamos resuelto ANTES de cualquier branch.
    // Cualquier camino debajo deja el flag a true para que la guard de
    // accederSistemaConAuth pueda decidir bien.
    window._rolResuelto = true;

    // ✅ FIX BUG ROL TARDÍO: si había clicks pendientes encolados durante
    // la espera del rol, dispararlos ahora que sabemos quiénes somos.
    if (window._navegacionPendienteTrasRol) {
        const pendiente = window._navegacionPendienteTrasRol;
        window._navegacionPendienteTrasRol = null;
        // Reintentar con un pequeño delay para que termine el resto de
        // verificarRol (asignación de rolUsuario, cerrarLoginAdmin, etc.)
        setTimeout(() => {
            if (typeof accederSistemaConAuth === 'function') accederSistemaConAuth(pendiente);
        }, 30);
    }

    if (esAdmin) {
        window.rolUsuario = 'admin';
        cerrarLoginAdmin();
        iniciarEscuchaSolicitudes();
        if (redirigir && window._loginDestino) {
            const destino = window._loginDestino;
            window._loginDestino = null;
            esperarDatosYNavegar(destino);
        }
        return;
    }

    if (esArbitro) {
        window.rolUsuario = 'arbitro';
        cerrarLoginAdmin();
        if (redirigir && window._loginDestino) {
            const destino = window._loginDestino;
            window._loginDestino = null;
            esperarDatosYNavegar(destino);
        }
        return;
    }

    cerrarLoginAdmin();

    // ✅ DIAGNÓSTICO MEJORADO:
    // Si TODAS las lecturas fallaron con permission_denied tras el reintento,
    // las reglas de Firebase no permiten al usuario verificar su propio rol.
    // Mostramos info útil para que el admin del proyecto pueda añadir el UID.
    const todasDenied = snapAdmin._denied && snapArbitro._denied && snapSolicitud._denied;
    if (todasDenied) {
        console.warn(
            '⚠️ Las 3 lecturas de rol fallaron con permission_denied incluso tras refrescar token.\n' +
            '   Tu UID: ' + user.uid + '\n' +
            '   Tu email: ' + (user.email || 'sin email') + '\n' +
            '   Posibles causas:\n' +
            '   1. Tu UID no está en /admins/ ni /arbitros/ en Firebase Realtime DB.\n' +
            '   2. Las reglas no permiten al propio usuario leer su propio nodo.\n' +
            '   Solución: añadir tu UID a /admins/ con valor true (boolean) en Firebase Console.'
        );
        // Mostrar también un banner visible en el HUB para no obligar a abrir F12
        setTimeout(() => {
            const alertBox = document.getElementById('hub-status-alert');
            if (alertBox) {
                alertBox.innerHTML = `
                    <div style="background:rgba(255,140,0,0.12);color:#ff8c00;padding:14px;border-radius:10px;border:1px solid rgba(255,140,0,0.45);font-size:0.78rem;line-height:1.4;">
                        <b>⚠️ ROL NO VERIFICADO</b><br>
                        Tu UID no está registrado como admin/árbitro en Firebase.<br>
                        <span style="opacity:0.85;">Email: ${escapeHtml(user.email || '')}</span><br>
                        <span style="font-family:monospace;font-size:0.7rem;opacity:0.85;">UID: ${escapeHtml(user.uid)}</span>
                        <button onclick="navigator.clipboard.writeText('${user.uid}').then(()=>this.innerText='✓ COPIADO')" style="margin-left:8px;background:rgba(255,140,0,0.25);border:none;color:#ff8c00;padding:3px 8px;border-radius:5px;font-size:0.65rem;cursor:pointer;font-weight:900;">📋 COPIAR UID</button>
                    </div>`;
                window._mostrandoErrorJornada = true;  // que verificarEstadoHub no pise
            }
        }, 200);
    }

    // ✅ FIX BUG "Solicitud enviada" en arranque:
    // Si verificarRol() se llama desde onAuthStateChanged() con redirigir=false
    // (es decir, en cada CARGA de página, no por un login activo del usuario),
    // NO mandamos a la pantalla de espera. El usuario podría ser un visitante
    // que solo quiere ver el HUB con secciones públicas (HISTORIAL, GUÍA, RANKING
    // de lectura), y bloquearle todo con "Solicitud enviada" en cada carga es
    // demasiado agresivo. La pantalla de espera solo aparece cuando el usuario
    // hace login ACTIVAMENTE con email/contraseña (redirigir=true).
    if (!redirigir) {
        // Arranque automático: dejamos al usuario en el HUB sin rol específico.
        // accederSistemaConAuth se encargará de bloquear secciones protegidas
        // con un alert claro si las pulsa.
        return;
    }

    // Login activo: si llegamos aquí es porque el usuario hizo signInWith*
    // y queremos darle feedback explícito (pantalla de espera o solicitud).
    if (!snapSolicitud.exists() || snapSolicitud.val()?.estado === 'rechazado') {
        // Solo intentamos enviar la solicitud si la lectura de solicitudes funcionó.
        // Si fue denegada por reglas, el set también fallaría y duplicaría errores.
        if (!snapSolicitud._denied) {
            try {
                await enviarSolicitudAcceso(user);
            } catch (e) {
                console.warn('No se pudo enviar solicitud de acceso:', e.message);
            }
        }
    }
    mostrarPantallaEspera(user);
}

function esperarDatosYNavegar(destino) {
    if (window.jugadoresHoy && window.jugadoresHoy.length > 0) {
        accederSistema(destino);
        return;
    }
    const intervalo = setInterval(() => {
        if (window.jugadoresHoy && window.jugadoresHoy.length > 0) {
            clearInterval(intervalo);
            accederSistema(destino);
        }
    }, 100);
    // Entrar igualmente tras 3 segundos aunque no haya jugadores
    setTimeout(() => {
        clearInterval(intervalo);
        accederSistema(destino);
    }, 3000);
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function abrirLoginAdmin(destino) {
    window._loginDestino = destino || 'inicio';
    document.getElementById('pantalla-login-admin').style.display = 'flex';
    document.getElementById('login-error').textContent = '';
}

function cerrarLoginAdmin() {
    document.getElementById('pantalla-login-admin').style.display = 'none';
}

async function loginConGoogle() {
    mostrarErrorLogin('');
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result   = await auth.signInWithPopup(provider);
        await verificarRol(result.user, true);
    } catch (e) {
        mostrarErrorLogin('Error: ' + e.message);
    }
}

async function loginConEmail() {
    mostrarErrorLogin('');
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    if (!email || !pass) { mostrarErrorLogin('Rellena email y contraseña.'); return; }
    try {
        const result = await auth.signInWithEmailAndPassword(email, pass);
        await verificarRol(result.user, true);
    } catch (e) {
        mostrarErrorLogin('Email o contraseña incorrectos.');
    }
}

function mostrarErrorLogin(msg) {
    document.getElementById('login-error').textContent = msg;
}

// ── SOLICITUDES ───────────────────────────────────────────────────────────────
async function enviarSolicitudAcceso(user) {
    await firebase.database().ref('solicitudesAcceso/' + user.uid).set({
        nombre:    user.displayName || 'Sin nombre',
        email:     user.email       || '',
        foto:      user.photoURL    || '',
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        estado:    'pendiente'
    });
}

function mostrarPantallaEspera(user) {
    document.getElementById('espera-nombre').textContent = user.displayName || '';
    document.getElementById('espera-email').textContent  = user.email       || '';
    document.getElementById('pantalla-espera-arbitro').style.display = 'flex';

    // ✅ FIX BUG MEDIO: listener leak — el .on() anterior nunca llamaba a .off().
    // Si el usuario abría la pantalla de espera varias veces (ej. rechazado → reintento),
    // se acumulaban múltiples listeners sobre el mismo nodo, disparando verificarRol()
    // N veces en cada cambio de estado. Guardamos la ref y la desconectamos primero.
    const estadoRef = firebase.database().ref('solicitudesAcceso/' + user.uid + '/estado');
    if (window._esperaListener) {
        window._esperaRef && window._esperaRef.off('value', window._esperaListener);
    }
    window._esperaListener = async snap => {
        if (snap.val() === 'aprobado') {
            estadoRef.off('value', window._esperaListener);
            window._esperaListener = null;
            document.getElementById('pantalla-espera-arbitro').style.display = 'none';
            await verificarRol(user);
        }
        if (snap.val() === 'rechazado') {
            estadoRef.off('value', window._esperaListener);
            window._esperaListener = null;
            document.getElementById('pantalla-espera-arbitro').style.display = 'none';
            await auth.signOut();
            alert('❌ Tu solicitud de acceso ha sido rechazada.');
        }
    };
    window._esperaRef = estadoRef;
    estadoRef.on('value', window._esperaListener);
}

async function cancelarSolicitud() {
    const user = auth.currentUser;
    if (user) {
        await firebase.database().ref('solicitudesAcceso/' + user.uid).remove();
        await auth.signOut();
    }
    document.getElementById('pantalla-espera-arbitro').style.display = 'none';
}

// ── PANEL ADMIN: escucha solicitudes pendientes ───────────────────────────────
function iniciarEscuchaSolicitudes() {
    firebase.database().ref('solicitudesAcceso')
        .orderByChild('estado').equalTo('pendiente')
        .on('value', snap => {
            const panel = document.getElementById('panel-solicitudes-admin');
            if (!snap.exists()) { panel.style.display = 'none'; return; }

            let html = '';
            snap.forEach(child => {
                const uid  = child.key;
                const d    = child.val();
                html += `
                <div style="background:#1a2530; border:1px solid #C5A059; border-radius:12px;
                            padding:16px; margin-bottom:10px; box-shadow:0 4px 20px rgba(0,0,0,0.5);">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                        ${d.foto && /^https?:\/\//.test(d.foto)
                            ? `<img src="${escapeHtml(d.foto)}" style="width:40px;height:40px;border-radius:50%;border:2px solid #C5A059;">`
                            : `<div style="width:40px;height:40px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;">👤</div>`}
                        <div>
                            <div style="color:white;font-weight:700;font-size:0.9rem;">${escapeHtml(d.nombre)}</div>
                            <div style="color:#888;font-size:0.75rem;">${escapeHtml(d.email)}</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="gestionarSolicitud('${uid}','aprobado')"
                                style="flex:1;padding:8px;background:#ccff00;color:#0b1118;
                                       border:none;border-radius:8px;font-weight:900;cursor:pointer;">
                            ✅ Aprobar
                        </button>
                        <button onclick="gestionarSolicitud('${uid}','rechazado')"
                                style="flex:1;padding:8px;background:#334155;color:#ff4444;
                                       border:1px solid #ff4444;border-radius:8px;font-weight:700;cursor:pointer;">
                            ❌ Rechazar
                        </button>
                    </div>
                </div>`;
            });

            panel.innerHTML = `
                <div style="color:#C5A059;font-size:0.7rem;font-weight:800;
                            letter-spacing:2px;margin-bottom:8px;text-align:right;">
                    🔔 SOLICITUDES PENDIENTES
                </div>${html}`;
            panel.style.display = 'block';
        });
}

async function gestionarSolicitud(uid, decision) {
    const updates = {};
    updates['solicitudesAcceso/' + uid + '/estado'] = decision;
    if (decision === 'aprobado') updates['arbitros/' + uid] = true;
    await firebase.database().ref().update(updates);
}

// ── CONTROL DE ACCESO ─────────────────────────────────────────────────────────
const _seccionesAdmin   = ['admin-historico', 'bbdd-jugadores', 'analisis'];
// _seccionesProteg = secciones operativas que requieren al menos rol arbitro o admin
const _seccionesProteg  = ['inicio', 'jornada', 'hitos-votos', 'sec-mvp',
                           'ranking', 'control-pistas'];
// _seccionesLectura — accesibles con cualquier rol autenticado (no requieren arbitro)
const _seccionesLectura = ['historial', 'guia-uso'];

/**
 * accederSistemaConAuth — guard de AUTH + ROL.
 *
 * Sus únicas responsabilidades son:
 *   1. ¿Hay usuario logueado? Si no, abrir modal de login.
 *   2. ¿Tiene el rol que la sección exige? Si no, alert.
 *   3. Si todo OK, delega en navegarA() (que ya maneja jornada activa).
 *
 * NO comprueba jornada activa — eso lo hace navegarA. Esto evita la antigua
 * duplicación de lógica de validación que tenía listas distintas.
 */
function accederSistemaConAuth(seccion) {
    const user = auth.currentUser;
    if (!user) {
        abrirLoginAdmin(seccion);
        return;
    }

    // ✅ FIX BUG ROL TARDÍO: si hay user logueado pero el rol aún no está
    // resuelto (Firebase está consultando admins/arbitros/solicitudes),
    // ENCOLAR la navegación en lugar de rebotar con "Acceso restringido".
    // Cuando verificarRol() termine disparará el reintento automáticamente.
    // Síntoma sin este fix: los primeros clicks tras cargar la app salían
    // con el alert porque rolUsuario seguía a null durante 200-1000ms.
    if (!window._rolResuelto && window.rolUsuario === null) {
        // Mostrar feedback al usuario: rol cargando
        const banner = document.getElementById('hub-status-alert');
        if (banner) {
            banner.innerHTML = `
                <div style="background:rgba(0,212,255,0.12);color:#00d4ff;padding:12px;border-radius:10px;text-align:center;border:1px solid rgba(0,212,255,0.4);font-weight:bold;">
                    ⏳ Verificando permisos...
                </div>`;
        }
        // Encolar el destino para reintentar cuando verificarRol termine.
        window._navegacionPendienteTrasRol = seccion;
        // Red de seguridad: si tras 4 segundos sigue sin resolverse,
        // mostramos el alert clásico para no dejar al usuario colgado.
        clearTimeout(window._timeoutEsperaRol);
        window._timeoutEsperaRol = setTimeout(() => {
            if (!window._rolResuelto) {
                window._navegacionPendienteTrasRol = null;
                alert('⛔ No se pudo verificar tu rol. Revisa tu conexión y refresca la página.');
                if (typeof verificarEstadoHub === 'function') verificarEstadoHub();
            }
        }, 4000);
        return;
    }

    // Secciones exclusivas de admin
    if (_seccionesAdmin.includes(seccion) && window.rolUsuario !== 'admin') {
        alert('⛔ Solo el administrador puede acceder a esta sección.');
        return;
    }
    // Secciones operativas: requieren al menos rol arbitro o admin
    if (_seccionesProteg.includes(seccion) &&
        window.rolUsuario !== 'admin' && window.rolUsuario !== 'arbitro') {
        alert('⛔ Acceso restringido. Espera a que el administrador apruebe tu solicitud.');
        return;
    }
    // Secciones de lectura — accesibles con cualquier rol autenticado.
    // No requieren ser arbitro, solo tener sesión abierta.

    // Delegar en navegarA(): centraliza validación de jornada y navegación
    if (typeof navegarA === 'function') {
        navegarA(seccion);
    } else if (typeof accederSistema === 'function') {
        // Fallback por si navegarA aún no está disponible (no debería)
        accederSistema(seccion);
    }
}

// Hacer la función accesible globalmente para los onclick del HTML
window.accederSistemaConAuth = accederSistemaConAuth;
