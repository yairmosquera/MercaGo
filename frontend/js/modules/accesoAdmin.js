
/**
 * MERCAGO - ACCESO AL PANEL ADMINISTRATIVO
 *
 * Permite regresar al panel desde cualquier
 * página cuando la sesión es administrativa.
 */

(function () {
    "use strict";

    function actualizarAccesoAdmin() {

        const boton = document.getElementById(
            "btnPanelAdministrador"
        );

        if (!boton) return;

        const admin =
            typeof currentUser !== "undefined" &&
            currentUser?.rol === "ADMINISTRADOR";

        boton.hidden = !admin;
    }

    function iniciar() {

        const botonSesion = document.getElementById(
            "sessionButton"
        );

        actualizarAccesoAdmin();

        // Detectar cambios de inicio/cierre de sesión.

        if (botonSesion) {

            new MutationObserver(
                actualizarAccesoAdmin
            ).observe(botonSesion, {
                childList: true,
                characterData: true,
                subtree: true,
                attributes: true
            });
        }

        // Actualizar al cambiar de sección.

        document.addEventListener("click", () => {
            queueMicrotask(actualizarAccesoAdmin);
        });

        window.addEventListener(
            "pageshow",
            actualizarAccesoAdmin
        );
    }

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            iniciar,
            { once: true }
        );

    } else {

        iniciar();
    }

})();
