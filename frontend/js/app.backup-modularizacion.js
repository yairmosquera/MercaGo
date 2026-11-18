
/**
 * ============================================
 * MERCAGO - APLICACIÓN PRINCIPAL
 * ============================================
 *
 * Responsabilidades:
 * - Navegación
 * - Catálogo de productos
 * - Carrito de compras
 * - Checkout
 * - Historial de pedidos
 * - Seguimiento
 * - Panel administrativo
 * - Inicialización
 *
 * Dependencias externas:
 * config/api.js
 * modules/auth.js
 *
 * ============================================
 */

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================

const COSTO_DOMICILIO = 4000;

let products = [];
let cart = [];
let pedidos = [];
let categoriaFiltro = "";

let pedidoSeleccionado = null;
let ultimoPedido = null;
let procesandoPedido = false;
let toastTimeout;


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

    return new Date(fecha).toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function fechaEsHoy(fecha) {
    if (!fecha) return false;

    const formato = d =>
        new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Bogota",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date(d));

    return formato(fecha) === formato(new Date());
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

    // Validación de checkout
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

    // Validación de historial y seguimiento
    if (["orders", "tracking"].includes(id)) {

        if (!currentUser) {
            toast("Inicia sesión para consultar tus pedidos");
            id = "login";

        } else if (currentUser.rol !== "CLIENTE") {
            toast("Esta sección es para clientes");
            return;
        }
    }

    // Validación de administrador
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

    // Cambiar pantalla
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    const pantalla = document.getElementById(id);

    if (pantalla) {
        pantalla.classList.add("active");
    }

    // Actualizar navegación
    document.querySelectorAll(".nav button").forEach(btn => {
        btn.classList.toggle(
            "active",
            btn.dataset.page === id
        );
    });

    // Cargar información de cada pantalla
    if (id === "cart") {
        renderCart();
    }

    if (id === "checkout") {
        updateCheckout();
    }

    if (id === "orders") {
        await cargarPedidos();
    }

    if (id === "tracking") {
        await actualizarSeguimiento();
    }

    if (id === "admin") {
        await cargarPanelAdmin();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ============================================
// CATÁLOGO DE PRODUCTOS
// ============================================

async function cargarProductos() {

    const grid = document.getElementById("productGrid");

    if (grid) {
        grid.innerHTML = "<p>Cargando productos...</p>";
    }

    try {
        const datos = await apiRequest("/productos");

        if (!Array.isArray(datos)) {
            throw new Error(
                "La API no devolvió una lista de productos"
            );
        }

        products = datos.map(p => ({
            id: Number(p.id),
            name: String(p.name ?? ""),
            cat: String(p.cat ?? ""),
            price: Number(p.price),
            emoji: String(p.emoji ?? "🛒"),
            stock: Number(p.stock ?? 0)
        }));

        renderProducts();

    } catch (error) {

        console.error("Error al cargar productos:", error);

        if (grid) {
            grid.innerHTML = `
                <p style="color:var(--danger)">
                    ${escapeHtml(error.message)}
                </p>
            `;
        }
    }
}

function renderProducts() {

    const grid = document.getElementById("productGrid");
    if (!grid) return;

    const buscar = document.getElementById("buscarProducto");

    const busqueda = (buscar?.value || "")
        .toLowerCase()
        .trim();

    const filtrados = products.filter(p => {

        const coincideTexto =
            p.name.toLowerCase().includes(busqueda) ||
            p.cat.toLowerCase().includes(busqueda);

        const coincideCategoria =
            !categoriaFiltro ||
            p.cat.toLowerCase().includes(
                categoriaFiltro.toLowerCase()
            );

        return coincideTexto && coincideCategoria;
    });

    if (filtrados.length === 0) {
        grid.innerHTML = `
            <div class="card">
                No se encontraron productos.
            </div>
        `;
        return;
    }

    grid.innerHTML = filtrados.map(p => `
        <article class="product">

            <div class="product-img">
                ${escapeHtml(p.emoji)}
            </div>

            <div class="meta">
                ${escapeHtml(p.cat)}
            </div>

            <h3>${escapeHtml(p.name)}</h3>

            <div class="price">
                ${money(p.price)}
            </div>

            <small style="color:var(--muted)">
                Disponibles: ${p.stock}
            </small>

            <button
                class="add"
                onclick="addToCart(${p.id})"
                ${p.stock <= 0 ? "disabled" : ""}
                title="Agregar al carrito"
            >
                +
            </button>

        </article>
    `).join("");
}


// ============================================
// FILTROS DE PRODUCTOS
// ============================================

function filtrarCategoria(categoria) {

    categoriaFiltro = categoria;

    const elemento = document.getElementById(
        "categoriaActual"
    );

    if (elemento) {
        elemento.textContent = categoria;
    }

    go("catalog");
    renderProducts();
}

function limpiarFiltros() {

    categoriaFiltro = "";

    const buscar = document.getElementById("buscarProducto");
    const categoria = document.getElementById("categoriaActual");

    if (buscar) buscar.value = "";
    if (categoria) categoria.textContent = "";

    renderProducts();
}

function buscarDesdeInicio(texto) {

    categoriaFiltro = "";

    const categoria = document.getElementById("categoriaActual");
    const buscar = document.getElementById("buscarProducto");

    if (categoria) categoria.textContent = "";
    if (buscar) buscar.value = texto;

    go("catalog");
    renderProducts();
}


// ============================================
// CARRITO DE COMPRAS
// ============================================

function addToCart(id) {

    const producto = products.find(p => p.id === id);

    if (!producto) {
        toast("Producto no encontrado");
        return;
    }

    const existente = cart.find(p => p.id === id);
    const cantidadActual = existente?.qty || 0;

    if (cantidadActual >= producto.stock) {
        toast("No hay suficientes existencias");
        return;
    }

    if (existente) {
        existente.qty++;

    } else {
        cart.push({
            ...producto,
            qty: 1
        });
    }

    updateCartCount();

    toast(producto.name + " agregado al carrito");
}

function changeQty(id, delta) {

    const item = cart.find(p => p.id === id);
    if (!item) return;

    const nuevaCantidad = item.qty + delta;

    const producto = products.find(p => p.id === id);

    if (
        delta > 0 &&
        producto &&
        nuevaCantidad > producto.stock
    ) {
        toast("No hay suficientes existencias");
        return;
    }

    if (nuevaCantidad <= 0) {
        cart = cart.filter(p => p.id !== id);

    } else {
        item.qty = nuevaCantidad;
    }

    updateCartCount();
    renderCart();
}

function updateCartCount() {

    const cantidad = cart.reduce(
        (suma, item) => suma + item.qty,
        0
    );

    const contador = document.getElementById("cartCount");

    if (contador) {
        contador.textContent = cantidad;
    }
}

function calcularSubtotal() {

    return cart.reduce(
        (suma, item) => suma + item.price * item.qty,
        0
    );
}

function renderCart() {

    const box = document.getElementById("cartItems");
    if (!box) return;

    const cantidad = cart.reduce(
        (suma, item) => suma + item.qty,
        0
    );

    document.getElementById("cartSubtitle").textContent =
        cantidad + " productos agregados";

    if (cart.length === 0) {

        box.innerHTML = `
            <div style="text-align:center;padding:55px 0;color:var(--muted)">
                Tu carrito está vacío.

                <div style="margin-top:20px">
                    <button class="primary" onclick="go('catalog')">
                        Ir al catálogo
                    </button>
                </div>
            </div>
        `;

    } else {

        box.innerHTML = cart.map(item => `
            <div class="list-item">

                <div class="thumb">
                    ${escapeHtml(item.emoji)}
                </div>

                <div>
                    <b>${escapeHtml(item.name)}</b>

                    <p style="color:var(--muted)">
                        ${money(item.price)}
                    </p>

                    <strong>
                        ${money(item.price * item.qty)}
                    </strong>
                </div>

                <div class="qty">
                    <button onclick="changeQty(${item.id},-1)">
                        −
                    </button>

                    <span>${item.qty}</span>

                    <button onclick="changeQty(${item.id},1)">
                        +
                    </button>
                </div>

            </div>
        `).join("");
    }

    const subtotal = calcularSubtotal();
    const domicilio = cart.length ? COSTO_DOMICILIO : 0;

    document.getElementById("subtotal").textContent =
        money(subtotal);

    document.getElementById("cartDomicilio").textContent =
        money(domicilio);

    document.getElementById("total").textContent =
        money(subtotal + domicilio);
}


// ============================================
// CHECKOUT
// ============================================

function updateCheckout() {

    const subtotal = calcularSubtotal();

    document.getElementById("checkoutSubtotal").textContent =
        money(subtotal);

    document.getElementById("checkoutDomicilio").textContent =
        money(COSTO_DOMICILIO);

    document.getElementById("checkoutTotal").textContent =
        money(subtotal + COSTO_DOMICILIO);
}


// ============================================
// CONFIRMAR PEDIDO
// ============================================

async function confirmOrder() {

    if (procesandoPedido) return;

    const boton = document.getElementById(
        "btnConfirmarPedido"
    );

    const mensaje = document.getElementById(
        "checkoutMensaje"
    );

    const direccion = document.getElementById(
        "checkoutDireccion"
    ).value.trim();

    const telefono = document.getElementById(
        "checkoutTelefono"
    ).value.trim();

    mensaje.textContent = "";

    if (!authToken || !currentUser) {
        toast("Debes iniciar sesión");
        await go("login");
        return;
    }

    if (currentUser.rol !== "CLIENTE") {
        mensaje.textContent =
            "Debes ingresar con una cuenta de cliente.";
        return;
    }

    if (cart.length === 0) {
        mensaje.textContent = "Tu carrito está vacío.";
        return;
    }

    if (!direccion) {
        mensaje.textContent =
            "Debes ingresar la dirección de entrega.";
        return;
    }

    if (!telefono) {
        mensaje.textContent =
            "Debes ingresar un número de teléfono.";
        return;
    }

    const datosPedido = {
        direccion,
        telefono,
        items: cart.map(item => ({
            id: item.id,
            qty: item.qty
        }))
    };

    procesandoPedido = true;

    boton.disabled = true;
    boton.textContent = "Procesando pedido...";

    let registrado = false;

    try {

        const resultado = await apiRequest("/pedidos", {
            method: "POST",
            body: JSON.stringify(datosPedido)
        });

        const pedido = resultado.pedido;

        if (!pedido || !pedido.id) {
            throw new Error(
                "El servidor no devolvió el número del pedido."
            );
        }

        registrado = true;

        ultimoPedido = pedido;
        pedidoSeleccionado = pedido.id;

        sessionStorage.setItem(
            "mercago_ultimo_pedido",
            String(pedido.id)
        );

        // Vaciar solamente después del registro
        cart = [];
        updateCartCount();

        mostrarPedidoConfirmado(pedido);

        // Mostrar confirmación antes de consultar
        // nuevamente el catálogo.
        await go("confirmed");

        toast("¡Pedido registrado correctamente!");

        // Actualizar existencias sin repetir compra
        await cargarProductos();

    } catch (error) {

        console.error("Error de compra:", error);

        if (registrado) {
            toast("Pedido registrado. No se pudo actualizar el catálogo.");

        } else {
            mensaje.textContent = error.message;
            toast("No se pudo confirmar el pedido");
        }

    } finally {

        procesandoPedido = false;
        boton.disabled = false;
        boton.textContent = "Confirmar pedido";
    }
}

function mostrarPedidoConfirmado(pedido) {

    const numero = "#MG-" + pedido.id;

    document.getElementById(
        "numeroPedidoConfirmado"
    ).textContent = numero;

    document.getElementById(
        "confirmNumero"
    ).textContent = numero;

    document.getElementById(
        "confirmEstado"
    ).textContent = pedido.estado;

    document.getElementById(
        "confirmSubtotal"
    ).textContent = money(pedido.subtotal);

    document.getElementById(
        "confirmDomicilio"
    ).textContent = money(pedido.costoDomicilio);

    document.getElementById(
        "confirmTotal"
    ).textContent = money(pedido.total);
}


// ============================================
// HISTORIAL DE PEDIDOS
// ============================================

async function cargarPedidos() {

    const tbody = document.getElementById("ordersBody");

    tbody.innerHTML = `
        <tr>
            <td colspan="5">Cargando pedidos...</td>
        </tr>
    `;

    try {

        pedidos = await apiRequest("/pedidos");

        if (!Array.isArray(pedidos)) {
            throw new Error(
                "Respuesta de pedidos inválida"
            );
        }

        if (pedidos.length === 0) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        Todavía no has realizado compras.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = pedidos.map(pedido => `
            <tr>

                <td>
                    <b>#MG-${pedido.id}</b>
                </td>

                <td>
                    ${fechaColombia(pedido.fecha)}
                </td>

                <td>
                    ${estadoHtml(pedido.estado)}
                </td>

                <td>
                    <b>${money(pedido.total)}</b>
                </td>

                <td>
                    <button
                        class="secondary"
                        onclick="verPedido(${pedido.id})"
                    >
                        Ver detalle
                    </button>

                    ${pedido.estado === "Pendiente" ? `
                        <button
                            class="secondary"
                            onclick="cancelarPedido(${pedido.id})"
                        >
                            Cancelar
                        </button>
                    ` : ""}

                </td>

            </tr>
        `).join("");

    } catch (error) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="color:var(--danger)">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}


// ============================================
// DETALLE DE PEDIDOS
// ============================================

async function verPedido(id) {

    pedidoSeleccionado = id;

    sessionStorage.setItem(
        "mercago_ultimo_pedido",
        String(id)
    );

    await go("tracking");
}


// ============================================
// SEGUIMIENTO
// ============================================

async function actualizarSeguimiento() {

    if (!pedidoSeleccionado) {

        const guardado = Number(
            sessionStorage.getItem("mercago_ultimo_pedido")
        );

        if (
            Number.isSafeInteger(guardado) &&
            guardado > 0
        ) {
            pedidoSeleccionado = guardado;
        }
    }

    if (!pedidoSeleccionado) {

        document.getElementById(
            "trackingTimeline"
        ).textContent =
            "Selecciona un pedido desde Mis pedidos.";

        return;
    }

    try {

        const resultado = await apiRequest(
            `/pedidos/${pedidoSeleccionado}`
        );

        const pedido = resultado.pedido;
        const estado = pedido.estado;

        document.getElementById(
            "trackingNumero"
        ).textContent = "#MG-" + pedido.id;

        document.getElementById(
            "trackingEstado"
        ).textContent = estado;

        document.getElementById(
            "trackingTitulo"
        ).textContent = "Estado actual: " + estado;

        document.getElementById(
            "trackingDireccion"
        ).textContent =
            "Dirección: " + (pedido.direccion || "");

        const pasos = [
            "Pendiente",
            "En camino",
            "Entregado"
        ];

        const indice = pasos.indexOf(estado);

        if (estado === "Cancelado") {

            document.getElementById(
                "trackingTimeline"
            ).innerHTML = `
                <div class="notice">
                    Este pedido fue cancelado.
                </div>
            `;

            return;
        }

        document.getElementById(
            "trackingTimeline"
        ).innerHTML = pasos.map((paso, i) => `
            <div class="step ${i <= indice ? "done" : ""}">

                <div class="dot">
                    ${i <= indice ? "✓" : i + 1}
                </div>

                <div>
                    <b>${paso}</b>

                    <p style="color:var(--muted)">
                        ${i <= indice
                            ? "Etapa alcanzada"
                            : "Pendiente"}
                    </p>
                </div>

            </div>
        `).join("");

    } catch (error) {

        document.getElementById(
            "trackingTimeline"
        ).textContent = error.message;
    }
}


// ============================================
// CANCELACIÓN DE PEDIDOS
// ============================================

async function cancelarPedido(id) {

    const confirmar = window.confirm(
        `¿Deseas cancelar el pedido #MG-${id}?`
    );

    if (!confirmar) return;

    try {

        await apiRequest(`/pedidos/${id}/cancelar`, {
            method: "PATCH"
        });

        toast("Pedido cancelado correctamente");

        await cargarProductos();
        await cargarPedidos();

    } catch (error) {
        toast(error.message);
    }
}


// ============================================
// PANEL ADMINISTRATIVO
// ============================================

async function cargarPanelAdmin() {

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("No autorizado");
        return;
    }

    const tbody = document.getElementById(
        "adminOrdersBody"
    );

    tbody.innerHTML = `
        <tr>
            <td colspan="5">Cargando pedidos...</td>
        </tr>
    `;

    try {

        const lista = await apiRequest("/pedidos");

        if (!Array.isArray(lista)) {
            throw new Error(
                "Respuesta inválida del servidor"
            );
        }

        const hoy = lista.filter(
            p => fechaEsHoy(p.fecha)
        );

        const pendientes = lista.filter(
            p => p.estado === "Pendiente"
        );

        const camino = lista.filter(
            p => p.estado === "En camino"
        );

        const entregadosHoy = hoy.filter(
            p => p.estado === "Entregado"
        );

        const ventas = entregadosHoy.reduce(
            (suma, p) => suma + Number(p.total),
            0
        );

        document.getElementById(
            "metricPedidos"
        ).textContent = hoy.length;

        document.getElementById(
            "metricPendientes"
        ).textContent = pendientes.length;

        document.getElementById(
            "metricCamino"
        ).textContent = camino.length;

        document.getElementById(
            "metricVentas"
        ).textContent = money(ventas);

        if (lista.length === 0) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        No hay pedidos registrados.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = lista.map(p => `
            <tr>

                <td>#MG-${p.id}</td>

                <td>${escapeHtml(p.cliente)}</td>

                <td>${estadoHtml(p.estado)}</td>

                <td>${money(p.total)}</td>

                <td>

                    ${p.estado === "Pendiente" ? `
                        <button
                            class="primary"
                            onclick="despacharPedido(${p.id})"
                        >
                            Despachar
                        </button>
                    ` : ""}

                    ${p.estado === "En camino" ? `
                        <button
                            class="primary"
                            onclick="entregarPedido(${p.id})"
                        >
                            Entregar
                        </button>
                    ` : ""}

                    ${p.estado === "Entregado" ? `
                        <span class="status">
                            Finalizado
                        </span>
                    ` : ""}

                    ${p.estado === "Cancelado" ? `
                        <span class="status cancel">
                            Cancelado
                        </span>
                    ` : ""}

                </td>

            </tr>
        `).join("");

    } catch (error) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="color:var(--danger)">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}


// ============================================
// DESPACHAR PEDIDO
// ============================================

async function despacharPedido(id) {

    const entrada = prompt(
        "Tiempo estimado de entrega en minutos:",
        "45"
    );

    if (entrada === null) return;

    const tiempo = Number(entrada);

    if (
        !Number.isInteger(tiempo) ||
        tiempo < 1 ||
        tiempo > 1440
    ) {
        toast("Ingresa un tiempo válido");
        return;
    }

    try {

        await apiRequest(`/pedidos/${id}/despachar`, {
            method: "PATCH",
            body: JSON.stringify({
                tiempoEstimadoMin: tiempo
            })
        });

        toast("Pedido marcado como En camino");

        await cargarPanelAdmin();

    } catch (error) {
        toast(error.message);
    }
}


// ============================================
// ENTREGAR PEDIDO
// ============================================

async function entregarPedido(id) {

    const confirmado = window.confirm(
        "¿Confirmas que el pedido fue entregado y pagado en efectivo?"
    );

    if (!confirmado) return;

    try {

        await apiRequest(`/pedidos/${id}/entregar`, {
            method: "PATCH"
        });

        toast("Pedido entregado correctamente");

        await cargarPanelAdmin();

    } catch (error) {
        toast(error.message);
    }
}


// ============================================
// NOTIFICACIONES
// ============================================

async function consultarNotificaciones() {

    if (
        !currentUser ||
        currentUser.rol !== "CLIENTE"
    ) {
        return [];
    }

    try {

        return await apiRequest(
            "/pedidos/notificaciones"
        );

    } catch (error) {

        console.error(
            "Error consultando notificaciones:",
            error
        );

        return [];
    }
}


// ============================================
// INICIALIZACIÓN
// ============================================

async function iniciarMercaGo() {

    // Función definida en modules/auth.js
    await restoreSession();

    updateCartCount();

    // Consultar catálogo desde SQL Server
    await cargarProductos();

    const ultimo = Number(
        sessionStorage.getItem(
            "mercago_ultimo_pedido"
        )
    );

    if (
        Number.isSafeInteger(ultimo) &&
        ultimo > 0
    ) {
        pedidoSeleccionado = ultimo;
    }

    console.log(
        "MercaGo inicializado correctamente"
    );
}


// ============================================
// INICIAR APLICACIÓN
// ============================================

iniciarMercaGo();
