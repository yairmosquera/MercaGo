
/**
 * MERCAGO - ADMINISTRACIÓN
 * Gestión de pedidos del supermercado
 */

// ============================================
// CARGAR PANEL
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

        // Indicadores
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

        // Listado y acciones
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
        console.error("Error administrativo:", error);

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

    const entrada = window.prompt(
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
        console.error("Error al despachar:", error);
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
        console.error("Error al entregar:", error);
        toast(error.message);
    }
}

console.log("MercaGo: admin.js cargado");
