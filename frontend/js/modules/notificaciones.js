
/**
 * ============================================
 * MERCAGO - NOTIFICACIONES
 * ============================================
 *
 * Funciones:
 * - Consultar notificaciones
 * - Mostrar contador de no leídas
 * - Marcar una notificación como leída
 * - Marcar todas como leídas
 * - Consultar el pedido relacionado
 *
 * Las notificaciones se conservan en SQL Server.
 */

let notificacionesAbiertas = false;
let cargandoNotificaciones = false;
let procesandoLectura = false;
let notificacionesActuales = [];

// ============================================
// CONSULTAR NOTIFICACIONES
// ============================================

async function cargarNotificaciones() {

    if (cargandoNotificaciones) return;

    if (
        !currentUser ||
        currentUser.rol !== "CLIENTE"
    ) {
        cerrarNotificaciones(true);
        return;
    }

    const contenido = document.getElementById(
        "listaNotificaciones"
    );

    if (!contenido) return;

    cargandoNotificaciones = true;

    contenido.innerHTML = `
        <p class="notificacion-vacia">
            Cargando notificaciones...
        </p>
    `;

    try {

        const datos = await apiRequest(
            "/pedidos/notificaciones"
        );

        if (!Array.isArray(datos)) {
            throw new Error(
                "La API no devolvió una lista válida."
            );
        }

        // Ordenar desde la más reciente
        notificacionesActuales = [...datos].sort(
            (a, b) =>
                new Date(b.fecha) - new Date(a.fecha)
        );

        mostrarNotificaciones(notificacionesActuales);

        actualizarContadorNotificaciones(
            notificacionesActuales
        );

    } catch (error) {

        console.error(
            "Error cargando notificaciones:",
            error
        );

        contenido.innerHTML = `
            <p class="notificacion-error">
                ${escapeHtml(error.message)}
            </p>
        `;

    } finally {
        cargandoNotificaciones = false;
    }
}

// ============================================
// MOSTRAR NOTIFICACIONES
// ============================================

function mostrarNotificaciones(datos) {

    const contenido = document.getElementById(
        "listaNotificaciones"
    );

    if (!contenido) return;

    if (datos.length === 0) {

        contenido.innerHTML = `
            <div class="notificacion-vacia">
                <div style="font-size:30px;margin-bottom:10px">
                    🔔
                </div>

                Todavía no tienes notificaciones.
            </div>
        `;

        return;
    }

    contenido.innerHTML = datos.map(n => {

        const idNotificacion = Number(
            n.idNotificacion
        );

        const idPedido = Number(n.idPedido);

        const notificacionValida =
            Number.isSafeInteger(idNotificacion) &&
            idNotificacion > 0;

        const pedidoValido =
            Number.isSafeInteger(idPedido) &&
            idPedido > 0;

        const noLeida = esNotificacionNoLeida(n);

        const texto = String(n.mensaje ?? "");

        return `
            <div
                class="notificacion-item
                ${noLeida ? "notificacion-nueva" : ""}"
            >

                <div class="notificacion-icono">
                    ${texto.includes("entregado")
                        ? "✅"
                        : texto.includes("cancelado")
                            ? "❌"
                            : "🚚"}
                </div>

                <div class="notificacion-contenido">

                    <b>
                        Actualización de pedido
                    </b>

                    ${noLeida ? `
                        <span class="notificacion-etiqueta">
                            Nueva
                        </span>
                    ` : ""}

                    <p>
                        ${escapeHtml(texto)}
                    </p>

                    <small>
                        ${escapeHtml(
                            fechaColombia(n.fecha)
                        )}
                    </small>

                    <div class="notificacion-acciones">

                        ${pedidoValido ? `
                            <button
                                class="secondary"
                                type="button"
                                onclick="abrirPedidoNotificado(
                                    ${idPedido}
                                )"
                            >
                                Ver pedido
                            </button>
                        ` : ""}

                        ${noLeida && notificacionValida ? `
                            <button
                                class="secondary"
                                type="button"
                                onclick="marcarNotificacionLeida(
                                    ${idNotificacion}
                                )"
                            >
                                Marcar como leída
                            </button>
                        ` : ""}

                    </div>

                </div>
            </div>
        `;

    }).join("");
}

// ============================================
// IDENTIFICAR NOTIFICACIONES NUEVAS
// ============================================

function esNotificacionNoLeida(notificacion) {

    return (
        notificacion.leida === false ||
        notificacion.leida === 0 ||
        notificacion.leida === "0"
    );
}

// ============================================
// ACTUALIZAR CONTADOR
// ============================================

function actualizarContadorNotificaciones(datos) {

    const contador = document.getElementById(
        "contadorNotificaciones"
    );

    if (!contador) return;

    const pendientes = datos.filter(
        esNotificacionNoLeida
    ).length;

    if (pendientes > 0) {

        contador.textContent =
            pendientes > 99 ? "99+" : pendientes;

        contador.style.display = "inline-flex";

    } else {

        contador.textContent = "";
        contador.style.display = "none";
    }
}

// ============================================
// MARCAR UNA NOTIFICACIÓN COMO LEÍDA
// ============================================

async function marcarNotificacionLeida(id) {

    if (procesandoLectura) return;

    const idNotificacion = Number(id);

    if (
        !Number.isSafeInteger(idNotificacion) ||
        idNotificacion <= 0
    ) {
        toast("Notificación inválida");
        return;
    }

    procesandoLectura = true;

    try {

        await apiRequest(
            `/pedidos/notificaciones/${idNotificacion}/leer`,
            {
                method: "PATCH"
            }
        );

        // Solo actualizar después de que SQL Server
        // confirme la operación.
        await cargarNotificaciones();

        toast("Notificación marcada como leída");

    } catch (error) {

        console.error(
            "Error marcando notificación:",
            error
        );

        toast(error.message);

    } finally {
        procesandoLectura = false;
    }
}

// ============================================
// MARCAR TODAS COMO LEÍDAS
// ============================================

async function marcarTodasLeidas() {

    if (procesandoLectura) return;

    if (
        !currentUser ||
        currentUser.rol !== "CLIENTE"
    ) {
        toast("Debes iniciar sesión como cliente");
        return;
    }

    const pendientes = notificacionesActuales.filter(
        esNotificacionNoLeida
    );

    if (pendientes.length === 0) {
        toast("No tienes notificaciones pendientes");
        return;
    }

    procesandoLectura = true;

    try {

        await apiRequest(
            "/pedidos/notificaciones/leer-todas",
            {
                method: "PATCH"
            }
        );

        await cargarNotificaciones();

        toast("Todas las notificaciones fueron leídas");

    } catch (error) {

        console.error(
            "Error marcando todas como leídas:",
            error
        );

        toast(error.message);

    } finally {
        procesandoLectura = false;
    }
}

// ============================================
// ABRIR PANEL
// ============================================

async function abrirNotificaciones() {

    if (
        !currentUser ||
        currentUser.rol !== "CLIENTE"
    ) {
        toast("Inicia sesión como cliente");
        await go("login");
        return;
    }

    const panel = document.getElementById(
        "panelNotificaciones"
    );

    if (!panel) return;

    if (notificacionesAbiertas) {
        cerrarNotificaciones();
        return;
    }

    panel.hidden = false;
    notificacionesAbiertas = true;

    await cargarNotificaciones();
}

// ============================================
// CERRAR PANEL
// ============================================

function cerrarNotificaciones(limpiar = false) {

    const panel = document.getElementById(
        "panelNotificaciones"
    );

    if (panel) {
        panel.hidden = true;
    }

    notificacionesAbiertas = false;

    if (limpiar) {

        notificacionesActuales = [];

        const contenido = document.getElementById(
            "listaNotificaciones"
        );

        if (contenido) {
            contenido.textContent = "";
        }

        actualizarContadorNotificaciones([]);
    }
}

// ============================================
// ABRIR PEDIDO RELACIONADO
// ============================================

async function abrirPedidoNotificado(idPedido) {

    const id = Number(idPedido);

    if (
        !Number.isSafeInteger(id) ||
        id <= 0
    ) {
        toast("Identificador inválido");
        return;
    }

    cerrarNotificaciones();

    await verPedido(id);
}

// ============================================
// INICIALIZACIÓN
// ============================================

function iniciarModuloNotificaciones() {

    document.addEventListener("click", event => {

        const botonSesion = event.target.closest(
            "#sessionButton"
        );

        if (botonSesion && !currentUser) {
            cerrarNotificaciones(true);
        }

        if (!notificacionesAbiertas) return;

        const panel = document.getElementById(
            "panelNotificaciones"
        );

        const boton = document.getElementById(
            "btnNotificaciones"
        );

        if (
            panel &&
            !panel.contains(event.target) &&
            !boton?.contains(event.target)
        ) {
            cerrarNotificaciones();
        }
    });

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            cerrarNotificaciones();
        }
    });

    console.log(
        "MercaGo: notificaciones.js cargado"
    );
}

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        iniciarModuloNotificaciones
    );

} else {

    iniciarModuloNotificaciones();
}
