
/**
 * MERCAGO - PEDIDOS
 * Historial y cancelación
 */

// ============================================
// CARGAR HISTORIAL
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
            throw new Error("Respuesta de pedidos inválida");
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
        console.error("Error al consultar pedidos:", error);

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
// CANCELAR PEDIDO
// ============================================

async function cancelarPedido(id) {

    const confirmado = window.confirm(
        `¿Deseas cancelar el pedido #MG-${id}?`
    );

    if (!confirmado) return;

    try {
        await apiRequest(`/pedidos/${id}/cancelar`, {
            method: "PATCH"
        });

        toast("Pedido cancelado correctamente");

        await cargarProductos();
        await cargarPedidos();

    } catch (error) {
        console.error("Error al cancelar pedido:", error);
        toast(error.message);
    }
}

// ============================================
// CONSULTAR NOTIFICACIONES
// ============================================

async function consultarNotificaciones() {

    if (!currentUser || currentUser.rol !== "CLIENTE") {
        return [];
    }

    try {
        const datos = await apiRequest(
            "/pedidos/notificaciones"
        );

        return Array.isArray(datos) ? datos : [];

    } catch (error) {
        console.error(
            "Error consultando notificaciones:",
            error
        );
        return [];
    }
}

console.log("MercaGo: pedidos.js cargado");
