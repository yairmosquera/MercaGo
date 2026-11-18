
/**
 * ============================================
 * MERCAGO - APLICACIÓN PRINCIPAL
 * ============================================
 *
 * Responsabilidades:
 * - Estado compartido
 * - Utilidades generales
 * - Navegación
 * - Inicialización
 *
 * Las reglas de cada funcionalidad
 * están organizadas en módulos separados.
 */

// ============================================
// ESTADO COMPARTIDO
// ============================================

const COSTO_DOMICILIO = 4000;

let products = [];
let cart = [];
let pedidos = [];
let categoriaFiltro = "";

let pedidoSeleccionado = null;
let ultimoPedido = null;
let procesandoPedido = false;

let toastTimeout = null;

// ============================================
// UTILIDADES
// ============================================

function money(valor) {
    return "$" + Number(valor || 0).toLocaleString(
        "es-CO",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    );
}

function escapeHtml(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        c => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[c]
    );
}

function fechaColombia(fecha) {

    if (!fecha) return "-";

    const d = new Date(fecha);

    if (Number.isNaN(d.getTime())) {
        return "-";
    }

    return d.toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function fechaEsHoy(fecha) {

    if (!fecha) return false;

    const fechaPedido = new Date(fecha);

    if (Number.isNaN(fechaPedido.getTime())) {
        return false;
    }

    const formato = d =>
        new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Bogota",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(d);

    return formato(fechaPedido) === formato(new Date());
}

function toast(mensaje) {

    const elemento = document.getElementById("toast");

    if (!elemento) return;

    clearTimeout(toastTimeout);

    elemento.textContent = mensaje;
    elemento.classList.add("show");

    toastTimeout = setTimeout(() => {
        elemento.classList.remove("show");
    }, 3000);
}

function estadoHtml(estado) {

    const cancelado = estado === "Cancelado";

    return `
        <span class="status ${cancelado ? "cancel" : ""}">
            ${escapeHtml(estado)}
        </span>
    `;
}

// ============================================
// NAVEGACIÓN
// ============================================

async function go(id) {

    // Proteger finalización de compra
    if (id === "checkout") {

        if (!currentUser) {
            toast("Inicia sesión antes de comprar");
            id = "login";

        } else if (currentUser.rol !== "CLIENTE") {
            toast("Ingresa con una cuenta de cliente");
            return;

        } else if (cart.length === 0) {
            toast("Tu carrito está vacío");
            id = "cart";

        } else {

            const nombre = document.getElementById(
                "checkoutNombre"
            );

            if (nombre) {
                nombre.value = currentUser.nombre || "";
            }
        }
    }

    // Proteger pantallas del cliente
    if (["orders", "tracking"].includes(id)) {

        if (!currentUser) {
            toast("Inicia sesión para consultar tus pedidos");
            id = "login";

        } else if (currentUser.rol !== "CLIENTE") {
            toast("Esta sección es para clientes");
            return;
        }
    }

    // Proteger panel administrativo
    if (id === "admin") {

        if (
            !authToken ||
            currentUser?.rol !== "ADMINISTRADOR"
        ) {
            toast("Acceso exclusivo para administradores");
            id = "login";

        } else {

            try {
                await apiRequest("/auth/admin/verificar");

            } catch (error) {
                toast("No fue posible validar los permisos");
                return;
            }
        }
    }

    // Verificar pantalla solicitada
    const pantalla = document.getElementById(id);

    if (!pantalla || !pantalla.classList.contains("page")) {
        console.warn("Pantalla no encontrada:", id);
        return;
    }

    // Ocultar pantallas
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    // Mostrar pantalla
    pantalla.classList.add("active");

    // Activar opción del menú
    document.querySelectorAll(".nav button").forEach(btn => {

        btn.classList.toggle(
            "active",
            btn.dataset.page === id
        );
    });

    // Ejecutar lógica específica
    switch (id) {

        case "cart":
            renderCart();
            break;

        case "checkout":
            updateCheckout();
            break;

        case "orders":
            await cargarPedidos();
            break;

        case "tracking":
            await actualizarSeguimiento();
            break;

        case "admin":
            await cargarPanelAdmin();
            break;
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ============================================
// INICIALIZACIÓN
// ============================================

async function iniciarMercaGo() {

    try {

        // Recuperar sesión autenticada
        await restoreSession();

        // Actualizar contador del carrito
        updateCartCount();

        // Cargar productos desde la API
        await cargarProductos();

        // Recuperar último pedido seleccionado
        const ultimo = Number(
            sessionStorage.getItem(
                "mercago_ultimo_pedido"
            )
        );

        if (
            currentUser?.rol === "CLIENTE" &&
            Number.isSafeInteger(ultimo) &&
            ultimo > 0
        ) {
            pedidoSeleccionado = ultimo;
        }

        console.log(
            "MercaGo inicializado correctamente"
        );

    } catch (error) {

        console.error(
            "Error al inicializar MercaGo:",
            error
        );

        toast("Ocurrió un error al iniciar la aplicación");
    }
}

// ============================================
// INICIAR MERCAGO
// ============================================

iniciarMercaGo();
