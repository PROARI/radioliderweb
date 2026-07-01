document.addEventListener('DOMContentLoaded', () => {
    // 1. Registrar Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
                .catch(err => console.error('Error al registrar Service Worker:', err));
        });
    }

    // Elementos del Modal PWA
    const pwaModal = document.getElementById('pwaModal');
    const closePwa = document.getElementById('closePwa');
    const installApp = document.getElementById('installApp');

    if (!pwaModal || !closePwa || !installApp) {
        console.warn('Elementos del modal PWA no encontrados en el HTML.');
        return;
    }

    let deferredPrompt = null;

    // Verificar cooldown de 24 horas y si ya está instalado
    function checkShowEligibility() {
        const isInstalled = localStorage.getItem('pwaInstalled') === 'true';
        if (isInstalled) {
            return false;
        }

        const dismissedTime = localStorage.getItem('pwaDismissedTime');
        if (dismissedTime) {
            const now = Date.now();
            const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
            if (now - parseInt(dismissedTime, 10) < cooldownPeriod) {
                console.log('El modal de instalación PWA está en cooldown de 24 horas.');
                return false;
            }
        }
        return true;
    }

    // Escuchar evento de instalación del navegador
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevenir el banner de instalación automático por defecto del navegador
        e.preventDefault();
        // Guardar el evento para dispararlo luego
        deferredPrompt = e;

        // Mostrar el modal si es elegible
        if (checkShowEligibility()) {
            pwaModal.style.display = 'flex';
        }
    });

    // Acción al presionar "INSTALAR AHORA"
    installApp.addEventListener('click', async () => {
        if (!deferredPrompt) return;

        // Ocultar modal
        pwaModal.style.display = 'none';

        // Disparar prompt nativo del navegador
        deferredPrompt.prompt();

        // Esperar la respuesta del usuario
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Elección del usuario: ${outcome}`);

        if (outcome === 'accepted') {
            localStorage.setItem('pwaInstalled', 'true');
            localStorage.removeItem('pwaDismissedTime');
        } else {
            // Si rechaza la instalación nativa, iniciar cooldown de 24 horas
            localStorage.setItem('pwaDismissedTime', Date.now().toString());
        }

        // Limpiar variable
        deferredPrompt = null;
    });

    // Función para manejar el rechazo manual
    function dismissPwa() {
        pwaModal.style.display = 'none';
        localStorage.setItem('pwaDismissedTime', Date.now().toString());
    }

    // Botón de cerrar (X)
    closePwa.addEventListener('click', () => {
        dismissPwa();
    });

    // Cerrar al hacer clic fuera del contenido del modal
    window.addEventListener('click', (e) => {
        if (e.target === pwaModal) {
            dismissPwa();
        }
    });

    // Detectar si la app fue instalada exitosamente (también de forma nativa por el navegador)
    window.addEventListener('appinstalled', (evt) => {
        console.log('Radio Lider PWA fue instalada exitosamente.');
        localStorage.setItem('pwaInstalled', 'true');
        localStorage.removeItem('pwaDismissedTime');
        pwaModal.style.display = 'none';
    });
});
