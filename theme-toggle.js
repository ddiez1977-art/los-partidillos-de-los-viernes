/* ============================================================
   ATP PLATINUM — THEME TOGGLE
   Inyecta el botón en el hub y gestiona el cambio de tema.
   Se guarda la preferencia en localStorage.
   ============================================================ */

(function () {
    'use strict';

    const STORAGE_KEY = 'atp_theme';
    const CLASS_PT    = 'theme-platinum';

    /* ── 1. Aplicar tema guardado inmediatamente (antes del paint) ── */
    const saved = localStorage.getItem(STORAGE_KEY) || 'classic';
    if (saved === 'platinum') {
        document.documentElement.classList.add(CLASS_PT); // en <html> para FOUC
        document.body.classList.add(CLASS_PT);
    }

    /* ── 2. Crear y posicionar el botón ────────────────────────── */
    function crearBoton() {
        // Evitar duplicados
        if (document.getElementById('btn-theme-toggle')) return;

        const btn = document.createElement('button');
        btn.id = 'btn-theme-toggle';
        actualizarBoton(btn);

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleTema();
        });

        // Insertar justo debajo del título "ATP MASTER / PLATINUM SYSTEM"
        // dentro del hub-container, antes del primer botón de sección
        const hubFirstDiv = document.querySelector('#pantalla-inicio-hub .hub-container > div');
        if (hubFirstDiv) {
            // Lo insertamos después del bloque del título (primer div interno)
            const tituloBloq = hubFirstDiv.querySelector('div[style*="margin-bottom"]');
            if (tituloBloq) {
                tituloBloq.insertAdjacentElement('afterend', btn);
            } else {
                hubFirstDiv.prepend(btn);
            }
        } else {
            // Fallback: esquina superior derecha del hub
            btn.style.cssText += '; position:fixed; top:16px; right:16px; z-index:100002;';
            document.body.appendChild(btn);
        }
    }

    /* ── 3. Toggle ──────────────────────────────────────────────── */
    function toggleTema() {
        const esPlatinum = document.body.classList.toggle(CLASS_PT);
        document.documentElement.classList.toggle(CLASS_PT, esPlatinum);
        localStorage.setItem(STORAGE_KEY, esPlatinum ? 'platinum' : 'classic');
        const btn = document.getElementById('btn-theme-toggle');
        if (btn) actualizarBoton(btn);
        mostrarToast(esPlatinum
            ? '🌑 Tema Platinum Dark activado'
            : '☀️ Tema Clásico activado');
    }

    /* ── 4. Actualizar aspecto del botón ────────────────────────── */
    function actualizarBoton(btn) {
        const esPlatinum = document.body.classList.contains(CLASS_PT);
        if (esPlatinum) {
            btn.className = 'mode-platinum';
            btn.id = 'btn-theme-toggle';
            btn.innerHTML = '<span class="toggle-dot"></span> ☀️ CLASSIC MODE';
            btn.title = 'Cambiar al tema clásico';
        } else {
            btn.className = 'mode-classic';
            btn.id = 'btn-theme-toggle';
            btn.innerHTML = '<span class="toggle-dot"></span> 🌑 PLATINUM DARK';
            btn.title = 'Cambiar al tema oscuro Platinum';
        }
    }

    /* ── 5. Toast de confirmación ───────────────────────────────── */
    function mostrarToast(msg) {
        let toast = document.getElementById('atp-theme-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'atp-theme-toast';
            Object.assign(toast.style, {
                position: 'fixed',
                bottom: '24px',
                right: '20px',
                background: '#0f1923',
                color: '#ccff00',
                border: '1px solid #ccff00',
                borderRadius: '12px',
                padding: '12px 20px',
                fontSize: '0.9rem',
                fontWeight: '900',
                zIndex: '999999',
                opacity: '0',
                transform: 'translateY(20px)',
                transition: 'all 0.3s ease',
                pointerEvents: 'none',
                fontFamily: "'Segoe UI', sans-serif",
                letterSpacing: '0.5px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
            });
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        // Animación
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
        }, 2500);
    }

    /* ── 6. Init: crear botón cuando el DOM esté listo ─────────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            crearBoton();
            // Reaplicar tema al body (puede no estar aún cuando se ejecuta el script)
            if (saved === 'platinum') {
                document.body.classList.add(CLASS_PT);
            }
        });
    } else {
        crearBoton();
        if (saved === 'platinum') {
            document.body.classList.add(CLASS_PT);
        }
    }

    /* ── 7. Re-crear botón si el hub se muestra de nuevo ────────── */
    // El hub puede ocultarse y mostrarse vía JS (volverAlHub, etc.)
    // Observamos cambios de display en #pantalla-inicio-hub
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            if (m.type === 'attributes' && m.attributeName === 'style') {
                const hub = document.getElementById('pantalla-inicio-hub');
                if (hub && hub.style.display !== 'none') {
                    // Pequeño delay para que el DOM se estabilice
                    setTimeout(crearBoton, 50);
                }
            }
        });
    });

    // Esperar a que el hub exista
    function initObserver() {
        const hub = document.getElementById('pantalla-inicio-hub');
        if (hub) {
            observer.observe(hub, { attributes: true, attributeFilter: ['style'] });
        } else {
            setTimeout(initObserver, 200);
        }
    }
    initObserver();

    /* ── 8. Exponer toggle globalmente por si otros scripts lo necesitan ── */
    window.atpTheme = { toggle: toggleTema };

})();
