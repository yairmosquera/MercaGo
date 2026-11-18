
/**
 * ============================================
 * MERCAGO - HISTORIAL DE INVENTARIO
 * ============================================
 *
 * Funcionalidades:
 * - Consultar movimientos desde SQL Server
 * - Mostrar ajustes manuales
 * - Mostrar devoluciones por cancelación
 * - Mostrar tipo de movimiento
 * - Buscar por producto, usuario y motivo
 * - Mostrar cantidades anteriores y nuevas
 * - Mostrar diferencias positivas y negativas
 * - Regresar al inventario
 */

let historialMovimientos = [];
let historialCargando = false;

// ============================================
// CREAR VENTANA DE HISTORIAL
// ============================================

function crearVentanaHistorial() {

    if (
        document.getElementById(
            "historialInventarioModal"
        )
    ) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "historialInventarioModal";
    modal.className = "inventario-modal";
    modal.hidden = true;

    modal.innerHTML = `

        <div
            class="inventario-ventana"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historialTitulo"
        >

            <!-- ENCABEZADO -->

            <div class="inventario-encabezado">

                <div>

                    <h2 id="historialTitulo">
                        Historial de movimientos
                    </h2>

                    <p>
                        Trazabilidad y auditoría de inventario
                    </p>

                </div>

                <button
                    type="button"
                    class="secondary"
                    onclick="cerrarHistorialInventario()"
                >
                    ✕ Cerrar
                </button>

            </div>

            <!-- HERRAMIENTAS -->

            <div class="inventario-herramientas">

                <input
                    type="search"
                    id="historialBuscar"
                    placeholder="Buscar producto, usuario, tipo o motivo..."
                    aria-label="Buscar movimientos"
                >

                <select
                    id="historialFiltroTipo"
                    aria-label="Filtrar tipo de movimiento"
                >

                    <option value="todos">
                        Todos los movimientos
                    </option>

                    <option value="AJUSTE_MANUAL">
                        Ajustes manuales
                    </option>

                    <option value="DEVOLUCION">
                        Devoluciones
                    </option>

                    <option value="SALIDA_COMPRA">
                        Salidas por compra
                    </option>

                    <option value="INVENTARIO_INICIAL">
                        Inventario inicial
                    </option>

                </select>

                <button
                    type="button"
                    class="primary"
                    onclick="cargarHistorialInventario()"
                >
                    ↻ Actualizar historial
                </button>

            </div>

            <!-- RESUMEN -->

            <p
                id="historialResumen"
                class="inventario-nota"
                role="status"
            >
                Consultando movimientos...
            </p>

            <!-- TABLA -->

            <div class="inventario-tabla-contenedor">

                <table class="inventario-tabla">

                    <thead>

                        <tr>
                            <th>Movimiento</th>
                            <th>Fecha</th>
                            <th>Producto</th>
                            <th>Tipo</th>
                            <th>Usuario responsable</th>
                            <th>Anterior</th>
                            <th>Nuevo</th>
                            <th>Diferencia</th>
                            <th>Motivo</th>
                        </tr>

                    </thead>

                    <tbody id="historialTablaBody">

                        <tr>
                            <td colspan="9">
                                Consultando movimientos...
                            </td>
                        </tr>

                    </tbody>

                </table>

            </div>

            <p class="inventario-nota">

                Se muestran hasta los 200 movimientos
                más recientes registrados en la base
                de datos.

                La auditoría conserva los ajustes
                realizados desde la administración
                y los movimientos automáticos que
                se encuentren habilitados en el backend.

            </p>

        </div>
    `;

    document.body.appendChild(modal);

    // ========================================
    // CERRAR AL HACER CLIC FUERA
    // ========================================

    modal.addEventListener("click", evento => {

        if (evento.target === modal) {
            cerrarHistorialInventario();
        }
    });

    // ========================================
    // BUSCAR MOVIMIENTOS
    // ========================================

    document.getElementById(
        "historialBuscar"
    ).addEventListener(
        "input",
        renderizarHistorial
    );

    // ========================================
    // FILTRAR POR TIPO
    // ========================================

    document.getElementById(
        "historialFiltroTipo"
    ).addEventListener(
        "change",
        renderizarHistorial
    );
}

// ============================================
// ABRIR HISTORIAL
// ============================================

async function abrirHistorialInventario() {

    if (
        !currentUser ||
        currentUser.rol !== "ADMINISTRADOR"
    ) {
        toast(
            "Acceso exclusivo para administradores"
        );

        return;
    }

    crearVentanaHistorial();

    // Ocultar inventario principal.

    const inventario = document.getElementById(
        "inventarioModal"
    );

    if (inventario) {
        inventario.hidden = true;
    }

    // Mostrar historial.

    const historial = document.getElementById(
        "historialInventarioModal"
    );

    historial.hidden = false;

    document.body.classList.add(
        "inventario-bloqueo-scroll"
    );

    await cargarHistorialInventario();
}

// ============================================
// CERRAR HISTORIAL
// ============================================

function cerrarHistorialInventario() {

    const historial = document.getElementById(
        "historialInventarioModal"
    );

    if (!historial || historial.hidden) {
        return;
    }

    historial.hidden = true;

    // Regresar al inventario administrativo.

    const inventario = document.getElementById(
        "inventarioModal"
    );

    if (
        inventario &&
        currentUser?.rol === "ADMINISTRADOR"
    ) {

        inventario.hidden = false;

        document.body.classList.add(
            "inventario-bloqueo-scroll"
        );

    } else {

        document.body.classList.remove(
            "inventario-bloqueo-scroll"
        );
    }
}

// ============================================
// CONSULTAR MOVIMIENTOS
// ============================================

async function cargarHistorialInventario() {

    if (historialCargando) {
        return;
    }

    if (
        !currentUser ||
        currentUser.rol !== "ADMINISTRADOR"
    ) {
        toast("No autorizado");
        return;
    }

    historialCargando = true;

    const tbody = document.getElementById(
        "historialTablaBody"
    );

    const resumen = document.getElementById(
        "historialResumen"
    );

    if (tbody) {

        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    Cargando movimientos...
                </td>
            </tr>
        `;
    }

    if (resumen) {
        resumen.textContent =
            "Consultando historial de inventario...";
    }

    try {

        const datos = await apiRequest(
            "/productos/admin/movimientos"
        );

        if (!Array.isArray(datos)) {

            throw new Error(
                "La API no devolvió una lista válida"
            );
        }

        historialMovimientos = datos;

        renderizarHistorial();

    } catch (error) {

        console.error(
            "Error consultando historial:",
            error
        );

        if (tbody) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="9">
                        ${escapeHtml(error.message)}
                    </td>
                </tr>
            `;
        }

        if (resumen) {

            resumen.textContent =
                "No fue posible consultar los movimientos.";
        }

        toast(
            "No fue posible cargar el historial"
        );

    } finally {

        historialCargando = false;
    }
}

// ============================================
// DESCRIPCIÓN DEL TIPO DE MOVIMIENTO
// ============================================

function nombreTipoMovimiento(tipo) {

    switch (String(tipo ?? "")) {

        case "AJUSTE_MANUAL":
            return "Ajuste manual";

        case "DEVOLUCION":
            return "Devolución";

        case "SALIDA_COMPRA":
            return "Salida por compra";

        case "INVENTARIO_INICIAL":
            return "Inventario inicial";

        default:
            return String(tipo ?? "Sin clasificar");
    }
}

// ============================================
// FILTRAR Y MOSTRAR MOVIMIENTOS
// ============================================

function renderizarHistorial() {

    const tbody = document.getElementById(
        "historialTablaBody"
    );

    const buscarInput = document.getElementById(
        "historialBuscar"
    );

    const filtroInput = document.getElementById(
        "historialFiltroTipo"
    );

    const resumen = document.getElementById(
        "historialResumen"
    );

    if (
        !tbody ||
        !buscarInput ||
        !filtroInput ||
        !resumen
    ) {
        return;
    }

    const buscar = buscarInput.value
        .trim()
        .toLowerCase();

    const filtroTipo = filtroInput.value;

    const lista = historialMovimientos.filter(
        movimiento => {

            const tipo = String(
                movimiento.tipo ?? ""
            );

            const coincideTipo =
                filtroTipo === "todos" ||
                tipo === filtroTipo;

            const texto = [

                movimiento.producto,

                movimiento.administrador,

                movimiento.motivo,

                movimiento.idProducto,

                movimiento.id,

                tipo,

                nombreTipoMovimiento(tipo)

            ]
                .map(valor => String(valor ?? ""))
                .join(" ")
                .toLowerCase();

            const coincideBusqueda =
                texto.includes(buscar);

            return (
                coincideTipo &&
                coincideBusqueda
            );
        }
    );

    resumen.textContent =
        `${lista.length} movimientos mostrados ` +
        `de ${historialMovimientos.length} consultados`;

    // ========================================
    // SIN RESULTADOS
    // ========================================

    if (lista.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    No se encontraron movimientos
                    con los filtros seleccionados.
                </td>
            </tr>
        `;

        return;
    }

    // ========================================
    // CONSTRUIR TABLA
    // ========================================

    tbody.innerHTML = lista.map(movimiento => {

        const diferencia = Number(
            movimiento.diferencia
        );

        const textoDiferencia =
            diferencia > 0
                ? `+${diferencia}`
                : String(diferencia);

        const color =
            diferencia > 0
                ? "#18794e"
                : diferencia < 0
                    ? "#b42323"
                    : "#68796e";

        const tipoTexto = nombreTipoMovimiento(
            movimiento.tipo
        );

        const usuario = String(
            movimiento.administrador ??
            "Usuario no disponible"
        );

        const fecha = movimiento.fecha
            ? fechaColombia(movimiento.fecha)
            : "Sin fecha";

        return `

            <tr>

                <td>
                    #${Number(movimiento.id)}
                </td>

                <td>
                    ${escapeHtml(fecha)}
                </td>

                <td>
                    ${escapeHtml(
                        movimiento.producto ?? ""
                    )}
                </td>

                <td>
                    <span class="inventario-estado
                        ${movimiento.tipo === "SALIDA_COMPRA"
                            ? "agotado"
                            : "disponible"}">
                        ${escapeHtml(tipoTexto)}
                    </span>
                </td>

                <td>
                    ${escapeHtml(usuario)}
                </td>

                <td>
                    ${Number(movimiento.stockAnterior)}
                </td>

                <td>
                    ${Number(movimiento.stockNuevo)}
                </td>

                <td>
                    <strong
                        style="color:${color}"
                    >
                        ${textoDiferencia}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        movimiento.motivo ?? ""
                    )}
                </td>

            </tr>
        `;

    }).join("");
}

// ============================================
// CERRAR CON TECLA ESCAPE
// ============================================

document.addEventListener(
    "keydown",
    evento => {

        if (evento.key !== "Escape") {
            return;
        }

        const historial = document.getElementById(
            "historialInventarioModal"
        );

        if (
            historial &&
            !historial.hidden
        ) {

            cerrarHistorialInventario();
        }
    }
);

// ============================================
// MÓDULO CARGADO
// ============================================

console.log(
    "MercaGo: historialInventario.js cargado correctamente"
);
