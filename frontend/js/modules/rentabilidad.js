
/**
 * MERCAGO - REPORTE DE RENTABILIDAD
 * FASE 14.4
 */

let rentabilidadDatos = null;
let rentabilidadConsultando = false;

const rentabilidadMoneda = numero =>
    money(Number(numero) || 0);

const rentabilidadNumero = numero =>
    (Number(numero) || 0).toLocaleString("es-CO");

// ============================================
// FORMATEAR FECHA
// ============================================

function rentabilidadFecha(fecha) {

    return [
        fecha.getFullYear(),

        String(
            fecha.getMonth() + 1
        ).padStart(2, "0"),

        String(
            fecha.getDate()
        ).padStart(2, "0")

    ].join("-");
}

// ============================================
// CREAR VENTANA
// ============================================

function crearRentabilidad() {

    if (
        document.getElementById(
            "rentabilidadModal"
        )
    ) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "rentabilidadModal";
    modal.className = "inventario-modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div
            class="inventario-ventana"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rentabilidadTitulo"
        >

            <div class="inventario-encabezado">

                <div>
                    <h2 id="rentabilidadTitulo">
                        Rentabilidad de productos
                    </h2>

                    <p>
                        Margen bruto sobre pedidos entregados,
                        con costos históricos
                    </p>
                </div>

                <button
                    class="secondary"
                    type="button"
                    onclick="cerrarRentabilidad()"
                >
                    ✕ Cerrar
                </button>

            </div>

            <!-- FILTROS -->

            <form
                id="rentabilidadFiltros"
                class="inventario-herramientas"
            >

                <label>
                    Desde

                    <input
                        id="rentabilidadDesde"
                        type="date"
                        required
                    >
                </label>

                <label>
                    Hasta

                    <input
                        id="rentabilidadHasta"
                        type="date"
                        required
                    >
                </label>

                <button
                    id="rentabilidadConsultar"
                    class="primary"
                    type="submit"
                >
                    Consultar
                </button>

                <button
                    class="secondary"
                    type="button"
                    onclick="exportarRentabilidadCSV()"
                >
                    ↓ CSV
                </button>

            </form>

            <p
                class="inventario-nota"
                id="rentabilidadMensaje"
                role="status"
            ></p>

            <!-- INDICADORES -->

            <div class="inventario-indicadores">

                <div class="inventario-indicador">

                    <span>Ventas de productos</span>

                    <strong id="rbVentas">
                        $0
                    </strong>

                </div>

                <div class="inventario-indicador">

                    <span>Costos conocidos</span>

                    <strong id="rbCostos">
                        $0
                    </strong>

                </div>

                <div class="inventario-indicador">

                    <span>Margen conocido</span>

                    <strong id="rbMargen">
                        $0
                    </strong>

                </div>

                <div class="inventario-indicador">

                    <span>Líneas sin costo</span>

                    <strong id="rbFaltantes">
                        0
                    </strong>

                </div>

            </div>

            <!-- AVISO DE COSTOS FALTANTES -->

            <div
                class="notice"
                id="rentabilidadAviso"
                role="status"
            ></div>

            <!-- TABLA -->

            <div
                class="inventario-tabla-contenedor"
                style="margin-top:18px"
            >

                <table class="inventario-tabla">

                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Unidades</th>
                            <th>Venta total</th>
                            <th>Venta con costo</th>
                            <th>Costo conocido</th>
                            <th>Margen conocido</th>
                            <th>Sin costo</th>
                        </tr>
                    </thead>

                    <tbody id="rentabilidadTabla">
                        <tr>
                            <td colspan="7">
                                Selecciona un período
                            </td>
                        </tr>
                    </tbody>

                </table>

            </div>

            <p class="inventario-nota">
                No incluye ingresos ni costos de domicilio,
                impuestos, comisiones ni gastos operativos.
                Filtra por fecha de creación del pedido
                y únicamente considera pedidos cuyo
                estado actual es Entregado.

                Los costos ausentes no equivalen a cero.
            </p>

        </div>
    `;

    document.body.appendChild(modal);

    // Fechas iniciales: últimos 30 días.

    const hoy = new Date();
    const inicio = new Date(hoy);

    inicio.setDate(
        inicio.getDate() - 29
    );

    document.getElementById(
        "rentabilidadDesde"
    ).value = rentabilidadFecha(inicio);

    document.getElementById(
        "rentabilidadHasta"
    ).value = rentabilidadFecha(hoy);

    document.getElementById(
        "rentabilidadFiltros"
    ).addEventListener("submit", evento => {

        evento.preventDefault();

        cargarRentabilidad();
    });

    modal.addEventListener("click", evento => {

        if (evento.target === modal) {
            cerrarRentabilidad();
        }
    });
}

// ============================================
// ABRIR VENTANA
// ============================================

async function abrirRentabilidad() {

    if (
        currentUser?.rol !== "ADMINISTRADOR"
    ) {
        toast(
            "Acceso exclusivo para administradores"
        );
        return;
    }

    crearRentabilidad();

    document.getElementById(
        "rentabilidadModal"
    ).hidden = false;

    document.body.classList.add(
        "inventario-bloqueo-scroll"
    );

    await cargarRentabilidad();
}

// ============================================
// CERRAR VENTANA
// ============================================

function cerrarRentabilidad() {

    const modal = document.getElementById(
        "rentabilidadModal"
    );

    if (!modal) return;

    modal.hidden = true;

    const otrosModales = [
        "inventarioModal",
        "dashboardInventarioModal",
        "historialInventarioModal",
        "reporteVentasModal",
        "analisisVentasModal",
        "costosModal"
    ];

    const hayOtroModal = otrosModales.some(id => {

        const elemento = document.getElementById(id);

        return elemento && !elemento.hidden;
    });

    if (!hayOtroModal) {

        document.body.classList.remove(
            "inventario-bloqueo-scroll"
        );
    }
}

// ============================================
// CONSULTAR RENTABILIDAD
// ============================================

async function cargarRentabilidad() {

    if (rentabilidadConsultando) {
        return;
    }

    if (
        currentUser?.rol !== "ADMINISTRADOR"
    ) {
        return;
    }

    const desde = document.getElementById(
        "rentabilidadDesde"
    ).value;

    const hasta = document.getElementById(
        "rentabilidadHasta"
    ).value;

    const dias = (
        Date.parse(`${hasta}T00:00:00Z`) -
        Date.parse(`${desde}T00:00:00Z`)
    ) / 86400000;

    if (
        !Number.isFinite(dias) ||
        dias < 0 ||
        dias > 365
    ) {

        toast(
            "Selecciona fechas válidas, hasta 366 días"
        );

        return;
    }

    rentabilidadConsultando = true;

    const boton = document.getElementById(
        "rentabilidadConsultar"
    );

    const mensaje = document.getElementById(
        "rentabilidadMensaje"
    );

    boton.disabled = true;

    mensaje.textContent =
        "Consultando rentabilidad...";

    try {

        const datos = await apiRequest(
            "/pedidos/admin/rentabilidad" +
            `?desde=${encodeURIComponent(desde)}` +
            `&hasta=${encodeURIComponent(hasta)}`
        );

        if (
            !datos?.resumen ||
            !Array.isArray(datos.productos)
        ) {

            throw new Error(
                "Respuesta incompleta de la API"
            );
        }

        rentabilidadDatos = datos;

        mostrarRentabilidad();

        mensaje.textContent =
            `Período: ${desde} a ${hasta}`;

    } catch (error) {

        console.error(
            "Error de rentabilidad:",
            error
        );

        mensaje.textContent = error.message;

        toast(
            "No se pudo consultar rentabilidad"
        );

    } finally {

        boton.disabled = false;

        rentabilidadConsultando = false;
    }
}

// ============================================
// MOSTRAR RESULTADOS
// ============================================

function mostrarRentabilidad() {

    const {
        resumen,
        productos
    } = rentabilidadDatos;

    document.getElementById(
        "rbVentas"
    ).textContent =
        rentabilidadMoneda(
            resumen.ventasProductos
        );

    document.getElementById(
        "rbCostos"
    ).textContent =
        rentabilidadMoneda(
            resumen.costoConocido
        );

    document.getElementById(
        "rbMargen"
    ).textContent =
        rentabilidadMoneda(
            resumen.margenConocido
        );

    document.getElementById(
        "rbFaltantes"
    ).textContent =
        rentabilidadNumero(
            resumen.lineasSinCosto
        );

    const faltantes = Number(
        resumen.lineasSinCosto
    ) || 0;

    document.getElementById(
        "rentabilidadAviso"
    ).textContent = faltantes

        ? `⚠ ${faltantes} líneas no tienen costo histórico. ` +
          `${rentabilidadMoneda(resumen.ventasSinCosto)} ` +
          `en ventas de productos no se incluyen en el ` +
          `margen calculado. No es una utilidad total.`

        : "✓ Todas las líneas del período tienen costo " +
          "histórico registrado. El margen corresponde " +
          "a productos, no a la utilidad neta.";

    const tabla = document.getElementById(
        "rentabilidadTabla"
    );

    tabla.innerHTML = productos.length

        ? productos.map(producto => `

            <tr>

                <td>
                    ${escapeHtml(producto.producto)}
                </td>

                <td>
                    ${rentabilidadNumero(producto.unidades)}
                </td>

                <td>
                    ${rentabilidadMoneda(
                        producto.ventasProductos
                    )}
                </td>

                <td>
                    ${rentabilidadMoneda(
                        producto.ventasConCosto
                    )}
                </td>

                <td>
                    ${rentabilidadMoneda(
                        producto.costoConocido
                    )}
                </td>

                <td>
                    ${rentabilidadMoneda(
                        producto.margenConocido
                    )}
                </td>

                <td>
                    ${rentabilidadNumero(
                        producto.lineasSinCosto
                    )}
                </td>

            </tr>

        `).join("")

        : `
            <tr>
                <td colspan="7">
                    No existen ventas entregadas en el período
                </td>
            </tr>
        `;
}

// ============================================
// EXPORTAR CSV
// ============================================

function exportarRentabilidadCSV() {

    if (
        currentUser?.rol !== "ADMINISTRADOR" ||
        !rentabilidadDatos
    ) {

        toast("Consulta primero el reporte");

        return;
    }

    // Evitar ejecución de fórmulas en Excel.

    function seguro(valor) {

        let texto = String(valor ?? "");

        if (/^\s*[=+\-@\t\r]/.test(texto)) {
            texto = "'" + texto;
        }

        return `"${texto.replace(/"/g, '""')}"`;
    }

    const datos = rentabilidadDatos;

    const filas = [

        ["Rentabilidad MercaGo"],

        ["Desde", datos.periodo.desde],

        ["Hasta", datos.periodo.hasta],

        [
            "Ventas de productos",
            datos.resumen.ventasProductos
        ],

        [
            "Ventas sin costo",
            datos.resumen.ventasSinCosto
        ],

        [
            "Costo conocido",
            datos.resumen.costoConocido
        ],

        [
            "Margen conocido",
            datos.resumen.margenConocido
        ],

        [
            "Líneas sin costo",
            datos.resumen.lineasSinCosto
        ],

        [],

        [
            "Producto",
            "Unidades",
            "Ventas totales",
            "Ventas con costo",
            "Costo conocido",
            "Margen conocido",
            "Líneas sin costo"
        ],

        ...datos.productos.map(producto => [

            producto.producto,

            producto.unidades,

            producto.ventasProductos,

            producto.ventasConCosto,

            producto.costoConocido,

            producto.margenConocido,

            producto.lineasSinCosto
        ])
    ];

    const contenido = filas
        .map(fila => fila.map(seguro).join(";"))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF", contenido],
        {
            type: "text/csv;charset=utf-8;"
        }
    );

    const url = URL.createObjectURL(blob);

    const enlace = document.createElement("a");

    enlace.href = url;

    enlace.download =
        `MercaGo_Rentabilidad_` +
        `${datos.periodo.desde}_` +
        `${datos.periodo.hasta}.csv`;

    document.body.appendChild(enlace);

    enlace.click();

    enlace.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

// ============================================
// CERRAR CON ESCAPE
// ============================================

document.addEventListener(
    "keydown",
    evento => {

        if (evento.key !== "Escape") {
            return;
        }

        const modal = document.getElementById(
            "rentabilidadModal"
        );

        if (
            modal &&
            !modal.hidden
        ) {

            evento.stopImmediatePropagation();

            cerrarRentabilidad();
        }
    },
    true
);

console.log(
    "MercaGo: rentabilidad.js cargado correctamente"
);
