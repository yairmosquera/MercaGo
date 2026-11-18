
/**
 * ============================================
 * MERCAGO - HISTORIAL DE COSTOS
 * FASE 15
 * ============================================
 */

let historialCostosDatos = [];
let historialCostosCargando = false;

function historialCostosDinero(valor) {
    if (valor === null || valor === undefined) {
        return "Sin registrar";
    }

    return money(Number(valor) || 0);
}

function historialCostosFecha(valor) {

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return "Fecha no disponible";
    }

    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Bogota"
    }).format(fecha);
}

// ============================================
// CREAR VENTANA
// ============================================

function crearVentanaHistorialCostos() {

    if (document.getElementById(
        "historialCostosModal"
    )) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "historialCostosModal";
    modal.className = "inventario-modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div
            class="inventario-ventana"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historialCostosTitulo"
        >

            <div class="inventario-encabezado">

                <div>
                    <h2 id="historialCostosTitulo">
                        Historial de costos
                    </h2>

                    <p>
                        Auditoría de cambios de adquisición
                    </p>
                </div>

                <button
                    type="button"
                    class="secondary"
                    onclick="cerrarHistorialCostos()"
                >
                    ✕ Cerrar
                </button>

            </div>

            <div class="inventario-herramientas">

                <input
                    type="search"
                    id="historialCostosBuscar"
                    placeholder="Buscar producto, administrador o motivo..."
                >

                <button
                    type="button"
                    class="primary"
                    onclick="cargarHistorialCostos()"
                >
                    ↻ Actualizar
                </button>

            </div>

            <p
                id="historialCostosMensaje"
                class="inventario-nota"
                role="status"
            ></p>

            <div class="inventario-tabla-contenedor">

                <table class="inventario-tabla">

                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Producto</th>
                            <th>Anterior</th>
                            <th>Nuevo</th>
                            <th>Diferencia</th>
                            <th>Administrador</th>
                            <th>Motivo</th>
                        </tr>
                    </thead>

                    <tbody id="historialCostosTabla">
                        <tr>
                            <td colspan="7">
                                Consultando movimientos...
                            </td>
                        </tr>
                    </tbody>

                </table>

            </div>

            <p class="inventario-nota">
                Se muestran hasta 200 cambios recientes.
                Los registros corresponden a costos
                de adquisición, no a movimientos
                de existencias.
            </p>

        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", evento => {
        if (evento.target === modal) {
            cerrarHistorialCostos();
        }
    });

    document.getElementById(
        "historialCostosBuscar"
    ).addEventListener(
        "input",
        renderizarHistorialCostos
    );
}

// ============================================
// ABRIR
// ============================================

async function abrirHistorialCostos() {

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("Acceso exclusivo para administradores");
        return;
    }

    crearVentanaHistorialCostos();

    document.getElementById(
        "historialCostosModal"
    ).hidden = false;

    document.body.classList.add(
        "inventario-bloqueo-scroll"
    );

    await cargarHistorialCostos();
}

// ============================================
// CERRAR
// ============================================

function cerrarHistorialCostos() {

    const modal = document.getElementById(
        "historialCostosModal"
    );

    if (!modal) return;

    modal.hidden = true;

    const otros = [
        "costosModal",
        "inventarioModal",
        "historialInventarioModal",
        "dashboardInventarioModal",
        "reporteVentasModal",
        "analisisVentasModal",
        "rentabilidadModal"
    ];

    const otroAbierto = otros.some(id => {
        const elemento = document.getElementById(id);
        return elemento && !elemento.hidden;
    });

    if (!otroAbierto) {
        document.body.classList.remove(
            "inventario-bloqueo-scroll"
        );
    }
}

// ============================================
// CONSULTAR AUDITORÍA
// ============================================

async function cargarHistorialCostos() {

    if (historialCostosCargando) return;

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("No autorizado");
        return;
    }

    historialCostosCargando = true;

    const mensaje = document.getElementById(
        "historialCostosMensaje"
    );

    mensaje.textContent =
        "Consultando historial en SQL Server...";

    try {

        const datos = await apiRequest(
            "/productos/admin/costos/historial"
        );

        if (!Array.isArray(datos)) {
            throw new Error(
                "El servidor devolvió datos inválidos"
            );
        }

        historialCostosDatos = datos;

        renderizarHistorialCostos();

    } catch (error) {

        console.error(
            "Error consultando historial:",
            error
        );

        mensaje.textContent = error.message;

        toast("No fue posible consultar el historial");

    } finally {

        historialCostosCargando = false;
    }
}

// ============================================
// MOSTRAR HISTORIAL
// ============================================

function renderizarHistorialCostos() {

    const busqueda = document.getElementById(
        "historialCostosBuscar"
    ).value.trim().toLowerCase();

    const filas = historialCostosDatos.filter(m => {

        return [
            m.producto,
            m.administrador,
            m.motivo
        ].some(valor =>
            String(valor ?? "")
                .toLowerCase()
                .includes(busqueda)
        );
    });

    document.getElementById(
        "historialCostosMensaje"
    ).textContent =
        `${filas.length} registros mostrados ` +
        `de ${historialCostosDatos.length} consultados.`;

    const tabla = document.getElementById(
        "historialCostosTabla"
    );

    if (!filas.length) {

        tabla.innerHTML = `
            <tr>
                <td colspan="7">
                    No se encontraron movimientos.
                </td>
            </tr>
        `;

        return;
    }

    tabla.innerHTML = filas.map(m => {

        const diferencia = m.diferencia === null
            ? null
            : Number(m.diferencia);

        const diferenciaTexto = diferencia === null
            ? "Costo inicial"
            : (
                diferencia > 0 ? "+" : ""
            ) + historialCostosDinero(diferencia);

        return `
            <tr>
                <td>
                    ${escapeHtml(
                        historialCostosFecha(m.fecha)
                    )}
                </td>

                <td>
                    ${escapeHtml(m.producto)}
                </td>

                <td>
                    ${historialCostosDinero(
                        m.costoAnterior
                    )}
                </td>

                <td>
                    ${historialCostosDinero(
                        m.costoNuevo
                    )}
                </td>

                <td>
                    ${escapeHtml(diferenciaTexto)}
                </td>

                <td>
                    ${escapeHtml(m.administrador)}
                </td>

                <td>
                    ${escapeHtml(m.motivo)}
                </td>
            </tr>
        `;
    }).join("");
}

// ============================================
// ESCAPE
// ============================================

document.addEventListener(
    "keydown",
    evento => {

        if (evento.key !== "Escape") return;

        const modal = document.getElementById(
            "historialCostosModal"
        );

        if (!modal || modal.hidden) return;

        evento.stopImmediatePropagation();
        cerrarHistorialCostos();

    },
    true
);

console.log(
    "MercaGo: historialCostos.js cargado"
);
