
/**
 * ============================================
 * MERCAGO - REPORTE ADMINISTRATIVO DE VENTAS
 * ============================================
 */

let reporteVentasDatos = null;
let reporteVentasCargando = false;

function reporteDinero(valor) {
    return money(Number(valor) || 0);
}

function reporteNumero(valor) {
    return Number(valor || 0).toLocaleString("es-CO");
}

function reporteFechaLocal(fecha) {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return "Sin fecha";

    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Bogota"
    }).format(d);
}

function reporteFechaInput(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

function crearVentanaReporteVentas() {

    if (document.getElementById("reporteVentasModal")) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "reporteVentasModal";
    modal.className = "inventario-modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div class="inventario-ventana reporte-ventas-ventana"
             role="dialog"
             aria-modal="true"
             aria-labelledby="reporteVentasTitulo">

            <div class="inventario-encabezado">
                <div>
                    <h2 id="reporteVentasTitulo">
                        Reporte de ventas
                    </h2>
                    <p>
                        Análisis de pedidos y ventas entregadas
                    </p>
                </div>

                <button class="secondary"
                        type="button"
                        onclick="cerrarReporteVentas()">
                    ✕ Cerrar
                </button>
            </div>

            <form id="reporteVentasFiltros"
                  class="inventario-herramientas">

                <label>
                    Desde
                    <input type="date"
                           id="reporteDesde"
                           required>
                </label>

                <label>
                    Hasta
                    <input type="date"
                           id="reporteHasta"
                           required>
                </label>

                <button class="primary"
                        id="reporteConsultarBoton"
                        type="submit">
                    Consultar
                </button>

                <button class="secondary"
                        type="button"
                        onclick="exportarReporteVentas()">
                    ↓ Exportar CSV
                </button>
            </form>

            <p id="reporteVentasMensaje"
               class="inventario-nota"
               role="status">
                Selecciona un período.
            </p>

            <div class="reporte-ventas-metricas">

                <div class="inventario-indicador">
                    <span>Pedidos registrados</span>
                    <strong id="rvPedidos">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Pedidos entregados</span>
                    <strong id="rvEntregados">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Pedidos cancelados</span>
                    <strong id="rvCancelados">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Ingresos entregados</span>
                    <strong id="rvIngresos">$0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Venta promedio</span>
                    <strong id="rvPromedio">$0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Otros estados</span>
                    <strong id="rvOtros">0</strong>
                </div>
            </div>

            <div class="reporte-ventas-secciones">

                <section class="reporte-ventas-panel">
                    <h3>Ventas por día</h3>
                    <div id="rvDias"></div>
                </section>

                <section class="reporte-ventas-panel">
                    <h3>Pedidos por estado</h3>
                    <div id="rvEstados"></div>
                </section>

            </div>

            <section class="reporte-ventas-panel">
                <h3>Productos más vendidos</h3>

                <div class="inventario-tabla-contenedor">
                    <table class="inventario-tabla">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Unidades</th>
                                <th>Importe</th>
                            </tr>
                        </thead>
                        <tbody id="rvProductos"></tbody>
                    </table>
                </div>
            </section>

            <section class="reporte-ventas-panel">
                <h3>Pedidos recientes del período</h3>

                <div class="inventario-tabla-contenedor">
                    <table class="inventario-tabla">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Estado</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody id="rvTablaPedidos"></tbody>
                    </table>
                </div>
            </section>

            <p class="inventario-nota">
                Los ingresos consideran únicamente pedidos
                entregados. El período corresponde a la
                fecha de creación registrada en SQL Server.
                Se muestran hasta 100 pedidos recientes
                y 20 productos más vendidos.
            </p>

        </div>
    `;

    document.body.appendChild(modal);

    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 29);

    document.getElementById("reporteDesde").value =
        reporteFechaInput(inicio);

    document.getElementById("reporteHasta").value =
        reporteFechaInput(hoy);

    document.getElementById("reporteVentasFiltros")
        .addEventListener("submit", evento => {
            evento.preventDefault();
            cargarReporteVentas();
        });

    modal.addEventListener("click", evento => {
        if (evento.target === modal) {
            cerrarReporteVentas();
        }
    });
}

// ============================================
// ABRIR / CERRAR
// ============================================

async function abrirReporteVentas() {

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("Acceso exclusivo para administradores");
        return;
    }

    crearVentanaReporteVentas();

    document.getElementById(
        "reporteVentasModal"
    ).hidden = false;

    document.body.classList.add(
        "inventario-bloqueo-scroll"
    );

    await cargarReporteVentas();
}

function cerrarReporteVentas() {

    const modal = document.getElementById(
        "reporteVentasModal"
    );

    if (modal) {
        modal.hidden = true;
    }

    const hayOtroModalAbierto = [
        "inventarioModal",
        "historialInventarioModal",
        "dashboardInventarioModal"
    ].some(id => {
        const elemento = document.getElementById(id);
        return elemento && !elemento.hidden;
    });

    if (!hayOtroModalAbierto) {
        document.body.classList.remove(
            "inventario-bloqueo-scroll"
        );
    }
}

// ============================================
// CONSULTAR REPORTE
// ============================================

async function cargarReporteVentas() {

    if (reporteVentasCargando) return;

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("No autorizado");
        return;
    }

    const desde = document.getElementById(
        "reporteDesde"
    ).value;

    const hasta = document.getElementById(
        "reporteHasta"
    ).value;

    if (!desde || !hasta || desde > hasta) {
        toast("Selecciona un rango de fechas válido");
        return;
    }

    const dias = (
        Date.parse(hasta + "T00:00:00Z") -
        Date.parse(desde + "T00:00:00Z")
    ) / 86400000;

    if (!Number.isFinite(dias) || dias > 365) {
        toast("El período no puede superar 366 días");
        return;
    }

    reporteVentasCargando = true;

    const boton = document.getElementById(
        "reporteConsultarBoton"
    );

    const mensaje = document.getElementById(
        "reporteVentasMensaje"
    );

    boton.disabled = true;
    mensaje.textContent = "Consultando ventas en SQL Server...";

    try {

        const datos = await apiRequest(
            `/pedidos/admin/reporte-ventas` +
            `?desde=${encodeURIComponent(desde)}` +
            `&hasta=${encodeURIComponent(hasta)}`
        );

        reporteVentasDatos = datos;

        renderizarReporteVentas();

        mensaje.textContent =
            `Período consultado: ${desde} a ${hasta}.`;

    } catch (error) {

        console.error("Error de reporte:", error);

        mensaje.textContent = error.message;
        toast("No fue posible generar el reporte");

    } finally {

        reporteVentasCargando = false;
        boton.disabled = false;
    }
}

// ============================================
// RENDERIZAR REPORTE
// ============================================

function renderizarReporteVentas() {

    const datos = reporteVentasDatos;

    if (!datos) return;

    const resumen = datos.resumen || {};

    const pedidos = Number(resumen.pedidos || 0);
    const entregados = Number(resumen.entregados || 0);
    const cancelados = Number(resumen.cancelados || 0);
    const otros = Number(resumen.otros || 0);
    const ingresos = Number(resumen.ingresos || 0);

    const promedio = entregados > 0
        ? ingresos / entregados
        : 0;

    const indicadores = {
        rvPedidos: reporteNumero(pedidos),
        rvEntregados: reporteNumero(entregados),
        rvCancelados: reporteNumero(cancelados),
        rvOtros: reporteNumero(otros),
        rvIngresos: reporteDinero(ingresos),
        rvPromedio: reporteDinero(promedio)
    };

    for (const [id, valor] of Object.entries(indicadores)) {
        document.getElementById(id).textContent = valor;
    }

    // ========================================
    // VENTAS DIARIAS
    // ========================================

    const dias = datos.ventasDiarias || [];

    const mayor = Math.max(
        1,
        ...dias.map(d => Number(d.ingresos) || 0)
    );

    document.getElementById("rvDias").innerHTML =
        dias.length
            ? dias.map(d => {

                const ingreso = Number(d.ingresos) || 0;

                const porcentaje = Math.min(
                    100,
                    ingreso / mayor * 100
                );

                return `
                    <div class="reporte-barra-item">
                        <div class="reporte-barra-encabezado">
                            <span>${escapeHtml(d.fecha)}</span>
                            <strong>${reporteDinero(ingreso)}</strong>
                        </div>

                        <div class="reporte-barra-fondo">
                            <div class="reporte-barra-relleno"
                                 style="width:${porcentaje}%">
                            </div>
                        </div>
                    </div>
                `;

            }).join("")
            : `<p class="inventario-nota">
                   No hay pedidos entregados en el período.
               </p>`;

    // ========================================
    // ESTADOS
    // ========================================

    document.getElementById("rvEstados").innerHTML =
        (datos.estados || []).length
            ? datos.estados.map(e => `
                <div class="reporte-estado-fila">
                    <span>${escapeHtml(e.estado)}</span>
                    <strong>${reporteNumero(e.cantidad)}</strong>
                </div>
            `).join("")
            : `<p class="inventario-nota">
                   No hay pedidos registrados.
               </p>`;

    // ========================================
    // PRODUCTOS
    // ========================================

    document.getElementById("rvProductos").innerHTML =
        (datos.productos || []).length
            ? datos.productos.map(p => `
                <tr>
                    <td>${escapeHtml(p.producto)}</td>
                    <td>${reporteNumero(p.unidades)}</td>
                    <td>${reporteDinero(p.importe)}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="3">
                   No hay productos vendidos.
               </td></tr>`;

    // ========================================
    // PEDIDOS RECIENTES
    // ========================================

    document.getElementById("rvTablaPedidos").innerHTML =
        (datos.pedidos || []).length
            ? datos.pedidos.map(p => `
                <tr>
                    <td>#${Number(p.id)}</td>
                    <td>${escapeHtml(reporteFechaLocal(p.fecha))}</td>
                    <td>${escapeHtml(p.cliente)}</td>
                    <td>${escapeHtml(p.estado)}</td>
                    <td>${reporteDinero(p.total)}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="5">
                   No hay pedidos en el período.
               </td></tr>`;
}

// ============================================
// EXPORTAR CSV
// ============================================

function exportarReporteVentas() {

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("No autorizado");
        return;
    }

    if (!reporteVentasDatos) {
        toast("Primero consulta un período");
        return;
    }

    const datos = reporteVentasDatos;

    // Protege celdas de texto contra
    // fórmulas al abrir CSV en Excel.
    function csv(valor) {

        let texto = String(valor ?? "");

        if (/^\s*[=+\-@\t\r]/.test(texto)) {
            texto = "'" + texto;
        }

        return `"${texto.replace(/"/g, '""')}"`;
    }

    const filas = [
        ["Reporte de ventas MercaGo"],
        ["Desde", datos.periodo.desde],
        ["Hasta", datos.periodo.hasta],
        [],
        ["Resumen"],
        ["Pedidos", datos.resumen.pedidos],
        ["Entregados", datos.resumen.entregados],
        ["Cancelados", datos.resumen.cancelados],
        ["Otros estados", datos.resumen.otros],
        ["Ingresos entregados", datos.resumen.ingresos],
        [],
        ["Productos más vendidos"],
        ["Producto", "Unidades", "Importe"],
        ...(datos.productos || []).map(p => [
            p.producto,
            p.unidades,
            p.importe
        ]),
        [],
        ["Pedidos recientes"],
        ["ID", "Fecha", "Cliente", "Estado", "Total"],
        ...(datos.pedidos || []).map(p => [
            p.id,
            reporteFechaLocal(p.fecha),
            p.cliente,
            p.estado,
            p.total
        ])
    ];

    const contenido = filas
        .map(fila => fila.map(csv).join(";"))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF", contenido],
        { type: "text/csv;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download =
        `MercaGo_Ventas_${datos.periodo.desde}` +
        `_a_${datos.periodo.hasta}.csv`;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);

    toast("Reporte exportado correctamente");
}

// ============================================
// ESCAPE
// ============================================

document.addEventListener("keydown", evento => {

    if (evento.key !== "Escape") return;

    const modal = document.getElementById(
        "reporteVentasModal"
    );

    if (modal && !modal.hidden) {
        evento.stopImmediatePropagation();
        cerrarReporteVentas();
    }

}, true);

console.log("MercaGo: reporteVentas.js cargado");
