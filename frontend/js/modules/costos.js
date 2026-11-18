
/**
 * ============================================
 * MERCAGO - ADMINISTRACIÓN DE COSTOS
 * FASE 14.2
 * ============================================
 *
 * - Consultar costos
 * - Buscar productos
 * - Filtrar productos sin costo
 * - Actualizar costo de adquisición
 * - Calcular margen bruto unitario
 * - Calcular porcentaje de margen
 * - Identificar productos con margen negativo
 *
 * Acceso exclusivo para administradores.
 */

let costosProductos = [];
let costosCargando = false;
let costosGuardando = false;

// ============================================
// UTILIDADES
// ============================================

function costosNumero(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function costosDinero(valor) {
    return money(costosNumero(valor));
}

function costosPorcentaje(valor) {
    if (valor === null || valor === undefined) {
        return "Sin calcular";
    }

    return `${costosNumero(valor).toLocaleString(
        "es-CO",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )} %`;
}

// ============================================
// CREAR VENTANA
// ============================================

function crearVentanaCostos() {

    if (document.getElementById("costosModal")) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "costosModal";
    modal.className = "inventario-modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div class="inventario-ventana costos-ventana"
             role="dialog"
             aria-modal="true"
             aria-labelledby="costosTitulo">

            <div class="inventario-encabezado">

                <div>
                    <h2 id="costosTitulo">
                        Administración de costos
                    </h2>

                    <p>
                        Precios de adquisición y márgenes
                        de productos MercaGo
                    </p>
                </div>

                <button
                    type="button"
                    class="secondary"
                    onclick="cerrarCostos()">
                    ✕ Cerrar
                </button>

            </div>

            <!-- INDICADORES -->

            <div class="costos-indicadores">

                <div class="inventario-indicador">
                    <span>Productos activos</span>
                    <strong id="costosTotal">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Con costo registrado</span>
                    <strong id="costosRegistrados">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Sin costo registrado</span>
                    <strong id="costosPendientes">0</strong>
                </div>

                <div class="inventario-indicador">
                    <span>Margen negativo</span>
                    <strong id="costosNegativos">0</strong>
                </div>

            </div>

            <!-- BUSCADOR Y FILTROS -->

            <div class="inventario-herramientas">

                <input
                    id="costosBuscar"
                    type="search"
                    placeholder="Buscar producto o categoría..."
                    aria-label="Buscar costos"
                >

                <select
                    id="costosFiltro"
                    aria-label="Filtrar productos">

                    <option value="todos">
                        Todos los productos activos
                    </option>

                    <option value="sin-costo">
                        Sin costo registrado
                    </option>

                    <option value="con-costo">
                        Con costo registrado
                    </option>

                    <option value="negativos">
                        Margen negativo
                    </option>

                    <option value="inactivos">
                        Productos inactivos
                    </option>
                </select>

                <button
                    class="primary"
                    id="costosActualizarBoton"
                    type="button"
                    onclick="cargarCostos()">
                    ↻ Actualizar
                </button>

                <!-- FASE 15: AUDITORÍA DE COSTOS -->
                <button
                    class="secondary"
                    type="button"
                    onclick="abrirHistorialCostos()">
                    📋 Historial de costos
                </button>

            </div>

            <p id="costosMensaje"
               class="inventario-nota"
               role="status">
                Consultando productos...
            </p>

            <!-- TABLA -->

            <div class="inventario-tabla-contenedor">

                <table class="inventario-tabla">

                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Categoría</th>
                            <th>Precio venta</th>
                            <th>Costo unitario</th>
                            <th>Margen unitario</th>
                            <th>Margen %</th>
                            <th>Acción</th>
                        </tr>
                    </thead>

                    <tbody id="costosTablaBody">
                        <tr>
                            <td colspan="7">
                                Cargando costos...
                            </td>
                        </tr>
                    </tbody>

                </table>

            </div>

            <p class="inventario-nota">
                El margen bruto unitario es la diferencia
                entre precio de venta y costo de adquisición.
                No incluye domicilio, impuestos, comisiones
                ni gastos operativos. Los costos faltantes
                no se consideran iguales a cero.
            </p>

        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", evento => {
        if (evento.target === modal) {
            cerrarCostos();
        }
    });

    document.getElementById("costosBuscar")
        .addEventListener(
            "input",
            renderizarCostos
        );

    document.getElementById("costosFiltro")
        .addEventListener(
            "change",
            renderizarCostos
        );
}

// ============================================
// ABRIR VENTANA
// ============================================

async function abrirCostos() {

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("Acceso exclusivo para administradores");
        return;
    }

    crearVentanaCostos();

    const modal = document.getElementById(
        "costosModal"
    );

    modal.hidden = false;

    document.body.classList.add(
        "inventario-bloqueo-scroll"
    );

    await cargarCostos();
}

// ============================================
// CERRAR VENTANA
// ============================================

function cerrarCostos() {

    const modal = document.getElementById(
        "costosModal"
    );

    if (!modal || modal.hidden) {
        return;
    }

    modal.hidden = true;

    const otrosModales = [
        "inventarioModal",
        "historialInventarioModal",
        "dashboardInventarioModal",
        "reporteVentasModal",
        "analisisVentasModal"
    ];

    const hayOtrosAbiertos = otrosModales.some(id => {
        const elemento = document.getElementById(id);
        return elemento && !elemento.hidden;
    });

    if (!hayOtrosAbiertos) {
        document.body.classList.remove(
            "inventario-bloqueo-scroll"
        );
    }
}

// ============================================
// CONSULTAR COSTOS
// ============================================

async function cargarCostos() {

    if (costosCargando) {
        return;
    }

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("No autorizado");
        return;
    }

    costosCargando = true;

    const boton = document.getElementById(
        "costosActualizarBoton"
    );

    const mensaje = document.getElementById(
        "costosMensaje"
    );

    const tbody = document.getElementById(
        "costosTablaBody"
    );

    if (boton) boton.disabled = true;

    if (mensaje) {
        mensaje.textContent =
            "Consultando costos desde SQL Server...";
    }

    try {

        const datos = await apiRequest(
            "/productos/admin/costos"
        );

        if (!Array.isArray(datos)) {
            throw new Error(
                "La API no devolvió una lista válida"
            );
        }

        costosProductos = datos.map(producto => ({
            id: Number(producto.id),
            nombre: String(producto.nombre ?? ""),
            categoria: String(producto.categoria ?? ""),
            precio: Number(producto.precio),
            costo: producto.costo === null ||
                   producto.costo === undefined
                ? null
                : Number(producto.costo),
            stock: Number(producto.stock),
            activo:
                producto.activo === true ||
                producto.activo === 1
        }));

        renderizarIndicadoresCostos();
        renderizarCostos();

    } catch (error) {

        console.error(
            "Error consultando costos:",
            error
        );

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        ${escapeHtml(error.message)}
                    </td>
                </tr>
            `;
        }

        if (mensaje) {
            mensaje.textContent = error.message;
        }

        toast("No fue posible consultar los costos");

    } finally {

        costosCargando = false;

        if (boton) boton.disabled = false;
    }
}

// ============================================
// INDICADORES
// ============================================

function renderizarIndicadoresCostos() {

    const activos = costosProductos.filter(
        p => p.activo
    );

    const conCosto = activos.filter(
        p => p.costo !== null
    );

    const sinCosto = activos.filter(
        p => p.costo === null
    );

    const negativos = conCosto.filter(
        p => p.precio - p.costo < 0
    );

    const valores = {
        costosTotal: activos.length,
        costosRegistrados: conCosto.length,
        costosPendientes: sinCosto.length,
        costosNegativos: negativos.length
    };

    for (const [id, valor] of Object.entries(valores)) {

        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent =
                valor.toLocaleString("es-CO");
        }
    }
}

// ============================================
// FILTROS
// ============================================

function obtenerCostosFiltrados() {

    const busqueda = document.getElementById(
        "costosBuscar"
    )?.value.trim().toLowerCase() ?? "";

    const filtro = document.getElementById(
        "costosFiltro"
    )?.value ?? "todos";

    return costosProductos.filter(p => {

        const coincide = (
            p.nombre + " " + p.categoria
        ).toLowerCase().includes(busqueda);

        if (!coincide) return false;

        switch (filtro) {

            case "sin-costo":
                return p.activo && p.costo === null;

            case "con-costo":
                return p.activo && p.costo !== null;

            case "negativos":
                return p.activo &&
                    p.costo !== null &&
                    p.precio < p.costo;

            case "inactivos":
                return !p.activo;

            default:
                return p.activo;
        }
    }).sort(
        (a, b) => a.nombre.localeCompare(
            b.nombre,
            "es"
        )
    );
}

// ============================================
// MOSTRAR TABLA
// ============================================

function renderizarCostos() {

    const tbody = document.getElementById(
        "costosTablaBody"
    );

    const mensaje = document.getElementById(
        "costosMensaje"
    );

    if (!tbody) return;

    const productos = obtenerCostosFiltrados();

    if (mensaje) {
        mensaje.textContent =
            `${productos.length} productos mostrados ` +
            `de ${costosProductos.length} consultados.`;
    }

    if (productos.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    No se encontraron productos.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = productos.map(p => {

        const tieneCosto = p.costo !== null;

        const margen = tieneCosto
            ? p.precio - p.costo
            : null;

        const porcentaje = tieneCosto && p.precio > 0
            ? margen / p.precio * 100
            : null;

        const clase = margen !== null && margen < 0
            ? "costos-negativo"
            : "costos-positivo";

        return `
            <tr>

                <td>
                    <strong>
                        ${escapeHtml(p.nombre)}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(p.categoria)}
                </td>

                <td>
                    ${costosDinero(p.precio)}
                </td>

                <td>
                    ${tieneCosto
                        ? costosDinero(p.costo)
                        : '<span class="costos-pendiente">Sin registrar</span>'
                    }
                </td>

                <td class="${clase}">
                    ${margen === null
                        ? "Sin calcular"
                        : costosDinero(margen)
                    }
                </td>

                <td class="${clase}">
                    ${costosPorcentaje(porcentaje)}
                </td>

                <td>
                    <button
                        type="button"
                        class="secondary"
                        onclick="editarCostoProducto(${p.id})">
                        ✎ Editar costo
                    </button>
                </td>

            </tr>
        `;
    }).join("");
}

// ============================================
// MODIFICAR COSTO DE ADQUISICIÓN
// ============================================

async function editarCostoProducto(id) {

    if (costosGuardando) return;

    if (currentUser?.rol !== "ADMINISTRADOR") {
        toast("No autorizado");
        return;
    }

    const producto = costosProductos.find(
        p => p.id === id
    );

    if (!producto) {
        toast("Producto no encontrado");
        return;
    }

    const valor = window.prompt(
        `Costo de adquisición de "${producto.nombre}"\n` +
        `Precio de venta: ${costosDinero(producto.precio)}\n\n` +
        `Ingresa el costo unitario en pesos:`,
        producto.costo === null
            ? ""
            : String(producto.costo)
    );

    if (valor === null) return;

    const texto = valor.trim();
    const costo = Number(texto);

    if (
        !texto ||
        !Number.isFinite(costo) ||
        costo < 0 ||
        costo > 999999999 ||
        Math.round(costo * 100) / 100 !== costo
    ) {
        toast(
            "Ingresa un costo válido con máximo dos decimales"
        );
        return;
    }

    if (producto.costo === costo) {
        toast("El costo no ha cambiado");
        return;
    }

    const margen = producto.precio - costo;

    const porcentaje = producto.precio > 0
        ? margen / producto.precio * 100
        : null;

    const confirmado = window.confirm(
        `CONFIRMAR COSTO DE ADQUISICIÓN\n\n` +
        `Producto: ${producto.nombre}\n` +
        `Precio venta: ${costosDinero(producto.precio)}\n` +
        `Costo anterior: ${
            producto.costo === null
                ? "Sin registrar"
                : costosDinero(producto.costo)
        }\n` +
        `Costo nuevo: ${costosDinero(costo)}\n` +
        `Margen unitario: ${costosDinero(margen)}\n` +
        `Margen: ${costosPorcentaje(porcentaje)}\n\n` +
        `¿Deseas guardar el costo?`
    );

    if (!confirmado) return;

    costosGuardando = true;

    try {

        await apiRequest(
            `/productos/${id}/costo`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    costo
                })
            }
        );

        toast("Costo actualizado correctamente");

        await cargarCostos();

    } catch (error) {

        console.error(
            "Error actualizando costo:",
            error
        );

        toast(error.message);

    } finally {

        costosGuardando = false;
    }
}

// ============================================
// CERRAR CON ESCAPE
// ============================================

document.addEventListener(
    "keydown",
    evento => {

        if (evento.key !== "Escape") return;

        const modal = document.getElementById(
            "costosModal"
        );

        if (!modal || modal.hidden) return;

        // El historial se cierra primero desde historialCostos.js.
        const historial = document.getElementById(
            "historialCostosModal"
        );
        if (historial && !historial.hidden) return;

        evento.stopImmediatePropagation();

        cerrarCostos();
    },
    true
);

// ============================================
// MÓDULO CARGADO
// ============================================

console.log(
    "MercaGo: costos.js cargado correctamente"
);
