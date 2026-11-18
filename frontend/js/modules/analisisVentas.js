
/**
 * ============================================
 * MERCAGO - ANÁLISIS COMPARATIVO
 * FASE 13
 * ============================================
 */

let analisisVentasDatos = null;
let analisisVentasCargando = false;

function avNumero(valor) {
    return (Number(valor) || 0)
        .toLocaleString("es-CO");
}

function avDinero(valor) {
    return money(Number(valor) || 0);
}

function avFechaInput(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(
        fecha.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
        fecha.getDate()
    ).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

function avVariacion(valor) {

    if (valor === null ||
        valor === undefined) {
        return "Sin base de comparación";
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "No disponible";
    }

    const signo = numero > 0 ? "+" : "";

    return `${signo}${numero.toFixed(2)} %`;
}

// ============================================
// CREAR VENTANA
// ============================================

function crearVentanaAnalisisVentas() {

    if (document.getElementById(
        "analisisVentasModal"
    )) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "analisisVentasModal";
    modal.className = "inventario-modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div class="inventario-ventana"
             role="dialog"
             aria-modal="true"
             aria-labelledby="analisisVentasTitulo">

            <div class="inventario-encabezado">

                <div>
                    <h2 id="analisisVentasTitulo">
                        Análisis comparativo de ventas
                    </h2>

                    <p>
                        Comparación de períodos y participación
                        de categorías
                    </p>
                </div>

                <button
                    class="secondary"
                    type="button"
                    onclick="cerrarAnalisisVentas()">
                    ✕ Cerrar
                </button>

            </div>

            <form id="avFormulario"
                  class="inventario-herramientas">

                <label>
                    Desde
                    <input
                        id="avDesde"
                        type="date"
                        required
                    >
                </label>

                <label>
                    Hasta
                    <input
                        id="avHasta"
                        type="date"
                        required
                    >
                </label>

                <button
                    id="avConsultar"
                    class="primary"
                    type="submit">
                    Comparar
                </button>

            </form>

            <p id="avMensaje"
               class="inventario-nota"
               role="status">
                Selecciona el período.
            </p>

            <h3>Comparación de períodos</h3>

            <div class="reporte-ventas-metricas">

                <div class="inventario-indicador">
                    <span>Ingresos del período</span>
                    <strong id="avIngresosActuales">$0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Ingresos anteriores</span>
                    <strong id="avIngresosAnteriores">$0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Variación de ingresos</span>
                    <strong id="avVariacionIngresos">0 %</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Pedidos entregados</span>
                    <strong id="avPedidosActuales">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Entregados anteriores</span>
                    <strong id="avPedidosAnteriores">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Variación de pedidos</span>
                    <strong id="avVariacionPedidos">0 %</strong>
                </div>

            </div>

            <section class="reporte-ventas-panel">

                <h3>Ventas por categoría</h3>

                <p class="inventario-nota">
                    Participación sobre el importe de
                    los productos de pedidos entregados,
                    sin incluir domicilio.
                </p>

                <div id="avGraficaCategorias"></div>

            </section>

            <section class="reporte-ventas-panel">

                <h3>Detalle por categoría</h3>

                <div class="inventario-tabla-contenedor">

                    <table class="inventario-tabla">

                        <thead>
                            <tr>
                                <th>Categoría</th>
                                <th>Unidades</th>
                                <th>Importe</th>
                                <th>Participación</th>
                            </tr>
                        </thead>

                        <tbody id="avTablaCategorias">

                            <tr>
                                <td colspan="4">
                                    Sin información.
                                </td>
                            </tr>

                        </tbody>

                    </table>

                </div>

            </section>

            <p class="inventario-nota">
                Los resultados corresponden a pedidos
                actualmente entregados y se agrupan
                por fecha de creación. Las categorías
                se obtienen de la clasificación actual
                de los productos.
            </p>

        </div>
    `;

    document.body.appendChild(modal);

    const hoy = new Date();
    const inicio = new Date(hoy);

    inicio.setDate(
        inicio.getDate() - 29
    );

    document.getElementById("avDesde").value =
        avFechaInput(inicio);

    document.getElementById("avHasta").value =
        avFechaInput(hoy);

    document.getElementById("avFormulario")
        .addEventListener("submit", evento => {

            evento.preventDefault();

            cargarAnalisisVentas();
        });

    modal.addEventListener("click", evento => {

        if (evento.target === modal) {
            cerrarAnalisisVentas();
        }
    });
}

// ============================================
// ABRIR / CERRAR
// ============================================

async function abrirAnalisisVentas() {

    if (
        currentUser?.rol !== "ADMINISTRADOR"
    ) {
        toast(
            "Acceso exclusivo para administradores"
        );
        return;
    }

    crearVentanaAnalisisVentas();

    document.getElementById(
        "analisisVentasModal"
    ).hidden = false;

    document.body.classList.add(
        "inventario-bloqueo-scroll"
    );

    await cargarAnalisisVentas();
}

function cerrarAnalisisVentas() {

    const modal = document.getElementById(
        "analisisVentasModal"
    );

    if (!modal) return;

    modal.hidden = true;

    const otrosModales = [
        "inventarioModal",
        "dashboardInventarioModal",
        "historialInventarioModal",
        "reporteVentasModal"
    ];

    const algunoAbierto =
        otrosModales.some(id => {

            const elemento =
                document.getElementById(id);

            return elemento && !elemento.hidden;
        });

    if (!algunoAbierto) {

        document.body.classList.remove(
            "inventario-bloqueo-scroll"
        );
    }
}

// ============================================
// CONSULTAR API
// ============================================

async function cargarAnalisisVentas() {

    if (analisisVentasCargando) return;

    if (
        currentUser?.rol !== "ADMINISTRADOR"
    ) {
        toast("No autorizado");
        return;
    }

    const desde = document.getElementById(
        "avDesde"
    ).value;

    const hasta = document.getElementById(
        "avHasta"
    ).value;

    const inicio = Date.parse(
        desde + "T00:00:00Z"
    );

    const fin = Date.parse(
        hasta + "T00:00:00Z"
    );

    const dias = (fin - inicio) / 86400000;

    if (
        !Number.isFinite(dias) ||
        dias < 0 ||
        dias > 365
    ) {
        toast(
            "Selecciona un período válido de hasta 366 días"
        );

        return;
    }

    analisisVentasCargando = true;

    const boton = document.getElementById(
        "avConsultar"
    );

    const mensaje = document.getElementById(
        "avMensaje"
    );

    boton.disabled = true;
    mensaje.textContent = "Consultando análisis...";

    try {

        const datos = await apiRequest(
            "/pedidos/admin/analisis-ventas" +
            `?desde=${encodeURIComponent(desde)}` +
            `&hasta=${encodeURIComponent(hasta)}`
        );

        if (
            !datos ||
            !datos.comparacion ||
            !Array.isArray(datos.categorias)
        ) {
            throw new Error(
                "La API devolvió datos incompletos"
            );
        }

        analisisVentasDatos = datos;

        renderizarAnalisisVentas();

        mensaje.textContent =
            `Período analizado: ${desde} a ${hasta}. ` +
            `Comparación con los ${dias + 1} días anteriores.`;

    } catch (error) {

        console.error(
            "Error consultando análisis:",
            error
        );

        mensaje.textContent = error.message;

        toast(
            "No se pudo consultar el análisis comparativo"
        );

    } finally {

        analisisVentasCargando = false;
        boton.disabled = false;
    }
}

// ============================================
// MOSTRAR INDICADORES Y CATEGORÍAS
// ============================================

function renderizarAnalisisVentas() {

    if (!analisisVentasDatos) return;

    const datos = analisisVentasDatos;
    const comparacion = datos.comparacion;

    const actual = comparacion.actual || {};
    const anterior = comparacion.anterior || {};

    const indicadores = {

        avIngresosActuales:
            avDinero(actual.ingresos),

        avIngresosAnteriores:
            avDinero(anterior.ingresos),

        avVariacionIngresos:
            avVariacion(
                comparacion.variacionIngresos
            ),

        avPedidosActuales:
            avNumero(actual.pedidosEntregados),

        avPedidosAnteriores:
            avNumero(anterior.pedidosEntregados),

        avVariacionPedidos:
            avVariacion(
                comparacion.variacionPedidos
            )
    };

    for (const [id, valor] of Object.entries(
        indicadores
    )) {
        document.getElementById(id).textContent =
            valor;
    }

    // ========================================
    // GRÁFICA DE PARTICIPACIÓN
    // ========================================

    const categorias = datos.categorias;

    const grafica = document.getElementById(
        "avGraficaCategorias"
    );

    if (!categorias.length) {

        grafica.innerHTML = `
            <p class="inventario-nota">
                No se registraron ventas entregadas
                por categoría en este período.
            </p>
        `;

    } else {

        grafica.innerHTML = categorias.map(
            categoria => {

                const porcentaje = Math.min(
                    100,
                    Math.max(
                        0,
                        Number(
                            categoria.participacion
                        ) || 0
                    )
                );

                return `
                    <div class="reporte-barra-item">

                        <div class="reporte-barra-encabezado">

                            <span>
                                ${escapeHtml(
                                    categoria.categoria
                                )}
                            </span>

                            <strong>
                                ${porcentaje.toFixed(2)} %
                            </strong>

                        </div>

                        <div class="reporte-barra-fondo">

                            <div
                                class="reporte-barra-relleno"
                                style="width:${porcentaje}%"
                            ></div>

                        </div>

                    </div>
                `;
            }
        ).join("");
    }

    // ========================================
    // TABLA DE CATEGORÍAS
    // ========================================

    const tabla = document.getElementById(
        "avTablaCategorias"
    );

    tabla.innerHTML = categorias.length

        ? categorias.map(categoria => `

            <tr>

                <td>
                    ${escapeHtml(
                        categoria.categoria
                    )}
                </td>

                <td>
                    ${avNumero(
                        categoria.unidades
                    )}
                </td>

                <td>
                    ${avDinero(
                        categoria.importe
                    )}
                </td>

                <td>
                    ${Number(
                        categoria.participacion || 0
                    ).toFixed(2)} %
                </td>

            </tr>

        `).join("")

        : `
            <tr>
                <td colspan="4">
                    Sin ventas por categoría.
                </td>
            </tr>
        `;
}

// ============================================
// CERRAR CON ESCAPE
// ============================================

document.addEventListener(
    "keydown",
    evento => {

        if (evento.key !== "Escape") return;

        const modal = document.getElementById(
            "analisisVentasModal"
        );

        if (!modal || modal.hidden) return;

        evento.stopImmediatePropagation();

        cerrarAnalisisVentas();
    },
    true
);

console.log(
    "MercaGo: analisisVentas.js cargado"
);
