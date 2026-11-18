
/**
 * MERCAGO - SEGUIMIENTO
 * Consulta del estado de entregas
 */

// ============================================
// SELECCIONAR PEDIDO
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
// ACTUALIZAR SEGUIMIENTO
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

        const timeline = document.getElementById(
            "trackingTimeline"
        );

        if (estado === "Cancelado") {
            timeline.innerHTML = `
                <div class="notice">
                    Este pedido fue cancelado.
                </div>
            `;
            return;
        }

        const pasos = [
            "Pendiente",
            "En camino",
            "Entregado"
        ];

        const indice = pasos.indexOf(estado);

        timeline.innerHTML = pasos.map((paso, i) => `
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
        console.error("Error de seguimiento:", error);

        document.getElementById(
            "trackingTimeline"
        ).textContent = error.message;
    }
}

console.log("MercaGo: seguimiento.js cargado");
