
/**
 * ============================================
 * MERCAGO - DASHBOARD DE INVENTARIO
 * ============================================
 *
 * Consulta:
 * GET /api/productos/admin
 * GET /api/productos/admin/movimientos
 *
 * Análisis de:
 * - Existencias actuales
 * - Entradas y salidas de inventario
 * - Productos más vendidos en la muestra
 * - Movimientos diarios
 * - Movimientos recientes
 *
 * No modifica la base de datos.
 */

let dashboardInventarioCargando = false;
let dashboardInventarioProductos = [];
let dashboardInventarioMovimientos = [];

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function dashboardNumero(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function dashboardEntero(valor) {
    return dashboardNumero(valor)
        .toLocaleString("es-CO");
}

function dashboardFecha(fecha) {
    if (!fecha) return "Sin fecha";

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
        return "Fecha inválida";
    }

    return new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(valor);
}

function dashboardFechaHora(fecha) {
    if (!fecha) return "Sin fecha";

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
        return "Fecha inválida";
    }

    return new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(valor);
}

function dashboardFechaClave(fecha) {
    if (!fecha) return null;

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
        return null;
    }

    const partes = new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "America/Bogota",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).formatToParts(valor);

    const datos = Object.fromEntries(
        partes.map(parte => [
            parte.type,
            parte.value
        ])
    );

    return `${datos.year}-${datos.month}-${datos.day}`;
}

function dashboardTipoMovimiento(tipo) {
    const nombres = {
        SALIDA_COMPRA: "Compra",
        DEVOLUCION: "Devolución",
        INVENTARIO_INICIAL: "Inventario inicial",
        AJUSTE_MANUAL: "Ajuste manual"
    };

    return nombres[tipo] || tipo || "Sin clasificar";
}

// ============================================
// CREAR VENTANA
// ============================================

function crearDashboardInventario() {

    if (document.getElementById(
        "dashboardInventarioModal"
    )) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "dashboardInventarioModal";
    modal.className = "inventario-modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div class="inventario-ventana dashboard-inventario-ventana"
             role="dialog"
             aria-modal="true"
             aria-labelledby="dashboardInventarioTitulo">

            <div class="inventario-encabezado">
                <div>
                    <h2 id="dashboardInventarioTitulo">
                        Dashboard de inventario
                    </h2>

                    <p>
                        Análisis de existencias y movimientos
                    </p>
                </div>

                <button
                    class="secondary"
                    type="button"
                    onclick="cerrarDashboardInventario()">
                    ✕ Cerrar
                </button>
            </div>

            <div class="inventario-herramientas">
                <button
                    class="primary"
                    type="button"
                    id="dashboardActualizar"
                    onclick="cargarDashboardInventario()">
                    ↻ Actualizar datos
                </button>

                <button
                    class="secondary"
                    type="button"
                    onclick="volverDashboardAInventario()">
                    📦 Volver al inventario
                </button>
            </div>

            <p id="dashboardMensaje"
               class="inventario-nota"
               role="status">
                Consultando información...
            </p>

            <!-- INDICADORES PRINCIPALES -->

            <div class="dashboard-inventario-kpis">

                <div class="inventario-indicador">
                    <span>Productos activos</span>
                    <strong id="dashboardProductos">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Unidades disponibles</span>
                    <strong id="dashboardUnidades">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Stock bajo</span>
                    <strong id="dashboardBajo">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Agotados</span>
                    <strong id="dashboardAgotados">0</strong>
                </div>

            </div>

            <!-- RESUMEN DE MOVIMIENTOS -->

            <h3 class="dashboard-seccion-titulo">
                Movimientos registrados
            </h3>

            <div class="dashboard-inventario-kpis">

                <div class="inventario-indicador">
                    <span>Entradas de unidades</span>
                    <strong id="dashboardEntradas">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Salidas de unidades</span>
                    <strong id="dashboardSalidas">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Unidades vendidas</span>
                    <strong id="dashboardVendidas">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Movimientos consultados</span>
                    <strong id="dashboardMovimientos">0</strong>
                </div>

            </div>

            <div class="dashboard-paneles">

                <!-- PRODUCTOS MÁS VENDIDOS -->

                <section class="dashboard-panel">
                    <h3>
                        Productos con más unidades vendidas
                    </h3>

                    <p class="dashboard-descripcion">
                        Según salidas por compra registradas
                        en la muestra consultada.
                    </p>

                    <div id="dashboardTopProductos">
                        Sin datos todavía.
                    </div>
                </section>

                <!-- MOVIMIENTOS DIARIOS -->

                <section class="dashboard-panel">
                    <h3>
                        Entradas y salidas por día
                    </h3>

                    <p class="dashboard-descripcion">
                        Agrupadas por fecha de Colombia.
                        Incluye todos los tipos de movimiento.
                    </p>

                    <div id="dashboardMovimientosDiarios">
                        Sin datos todavía.
                    </div>
                </section>

            </div>

            <!-- PRODUCTOS QUE REQUIEREN REPOSICIÓN -->

            <section class="dashboard-panel dashboard-panel-ancho">
                <h3>
                    Productos que requieren reposición
                </h3>

                <div class="inventario-tabla-contenedor">
                    <table class="inventario-tabla">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Categoría</th>
                                <th>Existencias</th>
                                <th>Estado</th>
                            </tr>
                        </thead>

                        <tbody id="dashboardTablaCriticos">
                            <tr>
                                <td colspan="4">
                                    Consultando productos...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- MOVIMIENTOS RECIENTES -->

            <section class="dashboard-panel dashboard-panel-ancho">
                <h3>
                    Movimientos recientes
                </h3>

                <div class="inventario-tabla-contenedor">
                    <table class="inventario-tabla">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Producto</th>
                                <th>Tipo</th>
                                <th>Diferencia</th>
                                <th>Usuario</th>
                            </tr>
                        </thead>

                        <tbody id="dashboardTablaMovimientos">
                            <tr>
                                <td colspan="5">
                                    Consultando movimientos...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <p class="inventario-nota">
                El resumen de existencias es actual.
                El análisis histórico se limita a los
                movimientos devueltos por la API
                (actualmente hasta 200).
            </p>

        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", evento => {
        if (evento.target === modal) {
            cerrarDashboardInventario();
        }
    });
}

// ============================================
// ABRIR DASHBOARD
// ============================================

async function abrirDashboardInventario() {

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("Acceso exclusivo para administradores");
        return;
    }

    crearDashboardInventario();

    const inventario = document.getElementById(
        "inventarioModal"
    );

    if (inventario) {
        inventario.hidden = true;
    }

    const dashboard = document.getElementById(
        "dashboardInventarioModal"
    );

    dashboard.hidden = false;

    document.body.classList.add(
        "inventario-bloqueo-scroll"
    );

    await cargarDashboardInventario();
}

// ============================================
// CERRAR Y VOLVER
// ============================================

function cerrarDashboardInventario() {

    const modal = document.getElementById(
        "dashboardInventarioModal"
    );

    if (!modal || modal.hidden) return;

    modal.hidden = true;

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

function volverDashboardAInventario() {
    cerrarDashboardInventario();
}

// ============================================
// CONSULTAR API
// ============================================

async function cargarDashboardInventario() {

    if (dashboardInventarioCargando) return;

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("No autorizado");
        return;
    }

    dashboardInventarioCargando = true;

    const boton = document.getElementById(
        "dashboardActualizar"
    );

    const mensaje = document.getElementById(
        "dashboardMensaje"
    );

    if (boton) boton.disabled = true;

    if (mensaje) {
        mensaje.textContent =
            "Actualizando indicadores desde MercaGo...";
    }

    try {

        const [productos, movimientos] =
            await Promise.all([
                apiRequest("/productos/admin"),
                apiRequest("/productos/admin/movimientos")
            ]);

        if (
            !Array.isArray(productos) ||
            !Array.isArray(movimientos)
        ) {
            throw new Error(
                "La API devolvió datos inválidos"
            );
        }

        dashboardInventarioProductos = productos;
        dashboardInventarioMovimientos = movimientos;

        renderizarDashboardInventario();

        if (mensaje) {
            mensaje.textContent =
                `Datos actualizados. ` +
                `${movimientos.length} movimientos ` +
                `incluidos en el análisis.`;
        }

    } catch (error) {

        console.error(
            "Error cargando dashboard:",
            error
        );

        if (mensaje) {
            mensaje.textContent =
                `Error: ${error.message}`;
        }

        toast("No fue posible actualizar el dashboard");

    } finally {
        dashboardInventarioCargando = false;

        if (boton) {
            boton.disabled = false;
        }
    }
}

// ============================================
// RENDERIZAR INDICADORES
// ============================================

function renderizarDashboardInventario() {

    const activos = dashboardInventarioProductos
        .filter(p =>
            p.activo === true ||
            p.activo === 1
        );

    const unidades = activos.reduce(
        (suma, p) =>
            suma + dashboardNumero(p.stock),
        0
    );

    const bajos = activos.filter(
        p => dashboardNumero(p.stock) > 0 &&
             dashboardNumero(p.stock) <=
                 INVENTARIO_STOCK_MINIMO
    );

    const agotados = activos.filter(
        p => dashboardNumero(p.stock) <= 0
    );

    const entradas = dashboardInventarioMovimientos
        .reduce(
            (total, m) =>
                total + Math.max(
                    0,
                    dashboardNumero(m.diferencia)
                ),
            0
        );

    const salidas = dashboardInventarioMovimientos
        .reduce(
            (total, m) =>
                total + Math.max(
                    0,
                    -dashboardNumero(m.diferencia)
                ),
            0
        );

    const vendidas = dashboardInventarioMovimientos
        .filter(
            m => m.tipo === "SALIDA_COMPRA"
        )
        .reduce(
            (total, m) =>
                total + Math.max(
                    0,
                    -dashboardNumero(m.diferencia)
                ),
            0
        );

    const valores = {
        dashboardProductos: activos.length,
        dashboardUnidades: unidades,
        dashboardBajo: bajos.length,
        dashboardAgotados: agotados.length,
        dashboardEntradas: entradas,
        dashboardSalidas: salidas,
        dashboardVendidas: vendidas,
        dashboardMovimientos:
            dashboardInventarioMovimientos.length
    };

    for (const [id, valor] of Object.entries(valores)) {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = dashboardEntero(valor);
        }
    }

    renderizarDashboardTopProductos();
    renderizarDashboardDias();
    renderizarDashboardCriticos([...bajos, ...agotados]);
    renderizarDashboardRecientes();
}

// ============================================
// PRODUCTOS MÁS VENDIDOS
// ============================================

function renderizarDashboardTopProductos() {

    const contenedor = document.getElementById(
        "dashboardTopProductos"
    );

    if (!contenedor) return;

    const acumulados = new Map();

    for (const m of dashboardInventarioMovimientos) {

        if (m.tipo !== "SALIDA_COMPRA") {
            continue;
        }

        const cantidad = Math.max(
            0,
            -dashboardNumero(m.diferencia)
        );

        if (cantidad <= 0) continue;

        const id = Number(m.idProducto);

        const nombre = String(
            m.producto ?? `Producto #${id}`
        );

        if (!acumulados.has(id)) {
            acumulados.set(id, {
                nombre,
                cantidad: 0
            });
        }

        acumulados.get(id).cantidad += cantidad;
    }

    const principales = [...acumulados.values()]
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

    if (!principales.length) {

        contenedor.innerHTML = `
            <p class="inventario-nota">
                Todavía no hay salidas por compra
                en los movimientos consultados.
            </p>
        `;

        return;
    }

    const maximo = principales[0].cantidad;

    contenedor.innerHTML = principales.map(p => {

        const porcentaje = maximo > 0
            ? Math.round(p.cantidad / maximo * 100)
            : 0;

        return `
            <div class="dashboard-barra-item">

                <div class="dashboard-barra-cabecera">
                    <strong>
                        ${escapeHtml(p.nombre)}
                    </strong>

                    <span>
                        ${dashboardEntero(p.cantidad)}
                        unidades
                    </span>
                </div>

                <div class="dashboard-barra-fondo">
                    <div
                        class="dashboard-barra-relleno"
                        style="width:${porcentaje}%"
                    ></div>
                </div>

            </div>
        `;

    }).join("");
}

// ============================================
// ENTRADAS Y SALIDAS POR DÍA
// ============================================

function renderizarDashboardDias() {

    const contenedor = document.getElementById(
        "dashboardMovimientosDiarios"
    );

    if (!contenedor) return;

    const fechas = new Map();

    for (const m of dashboardInventarioMovimientos) {

        const clave = dashboardFechaClave(m.fecha);

        if (!clave) continue;

        if (!fechas.has(clave)) {
            fechas.set(clave, {
                fecha: clave,
                entradas: 0,
                salidas: 0
            });
        }

        const fila = fechas.get(clave);

        const diferencia = dashboardNumero(
            m.diferencia
        );

        if (diferencia > 0) {
            fila.entradas += diferencia;
        } else {
            fila.salidas += Math.abs(diferencia);
        }
    }

    const dias = [...fechas.values()]
        .sort((a, b) =>
            b.fecha.localeCompare(a.fecha)
        )
        .slice(0, 7)
        .reverse();

    if (!dias.length) {

        contenedor.innerHTML = `
            <p class="inventario-nota">
                Todavía no hay movimientos para
                mostrar en la gráfica.
            </p>
        `;

        return;
    }

    const maximo = Math.max(
        1,
        ...dias.flatMap(d => [
            d.entradas,
            d.salidas
        ])
    );

    contenedor.innerHTML = dias.map(d => {

        const entradaPct =
            Math.round(d.entradas / maximo * 100);

        const salidaPct =
            Math.round(d.salidas / maximo * 100);

        return `
            <div class="dashboard-dia">

                <strong>
                    ${escapeHtml(d.fecha)}
                </strong>

                <div class="dashboard-dia-fila">
                    <span>Entradas</span>

                    <div class="dashboard-barra-fondo">
                        <div
                            class="dashboard-barra-relleno entrada"
                            style="width:${entradaPct}%"
                        ></div>
                    </div>

                    <b>${dashboardEntero(d.entradas)}</b>
                </div>

                <div class="dashboard-dia-fila">
                    <span>Salidas</span>

                    <div class="dashboard-barra-fondo">
                        <div
                            class="dashboard-barra-relleno salida"
                            style="width:${salidaPct}%"
                        ></div>
                    </div>

                    <b>${dashboardEntero(d.salidas)}</b>
                </div>

            </div>
        `;

    }).join("");
}

// ============================================
// INVENTARIO CRÍTICO
// ============================================

function renderizarDashboardCriticos(productos) {

    const tbody = document.getElementById(
        "dashboardTablaCriticos"
    );

    if (!tbody) return;

    const ordenados = productos
        .sort(
            (a, b) =>
                dashboardNumero(a.stock) -
                dashboardNumero(b.stock)
        )
        .slice(0, 20);

    if (!ordenados.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    No hay productos activos con
                    existencias críticas.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = ordenados.map(p => {

        const stock = dashboardNumero(p.stock);

        const estado = stock <= 0
            ? "Agotado"
            : "Stock bajo";

        const clase = stock <= 0
            ? "agotado"
            : "bajo";

        return `
            <tr>
                <td>
                    ${escapeHtml(p.nombre ?? "")}
                </td>

                <td>
                    ${escapeHtml(p.categoria ?? "")}
                </td>

                <td>
                    ${dashboardEntero(stock)}
                </td>

                <td>
                    <span class="inventario-estado ${clase}">
                        ${estado}
                    </span>
                </td>
            </tr>
        `;

    }).join("");
}

// ============================================
// MOVIMIENTOS RECIENTES
// ============================================

function renderizarDashboardRecientes() {

    const tbody = document.getElementById(
        "dashboardTablaMovimientos"
    );

    if (!tbody) return;

    const recientes = dashboardInventarioMovimientos
        .slice(0, 10);

    if (!recientes.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    No hay movimientos registrados.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = recientes.map(m => {

        const diferencia = dashboardNumero(
            m.diferencia
        );

        const texto = diferencia > 0
            ? `+${dashboardEntero(diferencia)}`
            : dashboardEntero(diferencia);

        const clase = diferencia > 0
            ? "dashboard-positivo"
            : diferencia < 0
                ? "dashboard-negativo"
                : "";

        return `
            <tr>
                <td>
                    ${escapeHtml(
                        dashboardFechaHora(m.fecha)
                    )}
                </td>

                <td>
                    ${escapeHtml(m.producto ?? "")}
                </td>

                <td>
                    ${escapeHtml(
                        dashboardTipoMovimiento(m.tipo)
                    )}
                </td>

                <td class="${clase}">
                    <strong>${texto}</strong>
                </td>

                <td>
                    ${escapeHtml(m.administrador ?? "")}
                </td>
            </tr>
        `;

    }).join("");
}

// ============================================
// ESCAPE - PRIORIDAD SOBRE INVENTARIO
// ============================================

document.addEventListener(
    "keydown",
    evento => {

        if (evento.key !== "Escape") return;

        const modal = document.getElementById(
            "dashboardInventarioModal"
        );

        if (!modal || modal.hidden) return;

        // Evitar que los eventos de cierre del
        // inventario principal actúen también.
        evento.stopImmediatePropagation();

        cerrarDashboardInventario();

    },
    true
);

console.log(
    "MercaGo: dashboardInventario.js cargado"
);
