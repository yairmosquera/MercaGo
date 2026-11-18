
/**
 * ============================================
 * MERCAGO - INVENTARIO ADMINISTRATIVO
 * ============================================
 *
 * CRUD DE PRODUCTOS
 * CONTROL DE EXISTENCIAS
 * AUDITORÍA DE INVENTARIO
 *
 * Funcionalidades:
 * - Consultar productos
 * - Crear productos
 * - Editar productos
 * - Actualizar existencias con motivo
 * - Activar y desactivar productos
 * - Consultar historial de movimientos
 * - Filtrar inventario
 * - Mostrar alertas de stock
 * - Exportar inventario a CSV
 *
 * ============================================
 */

// ============================================
// CONFIGURACIÓN Y VARIABLES
// ============================================

const INVENTARIO_STOCK_MINIMO = 5;

let inventarioProductos = [];
let inventarioCategorias = [];

let inventarioBusqueda = "";
let inventarioFiltro = "todos";

let inventarioCargando = false;
let inventarioGuardando = false;

// ============================================
// CREAR VENTANA DE INVENTARIO
// ============================================

function crearVentanaInventario() {

    if (document.getElementById("inventarioModal")) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "inventarioModal";
    modal.className = "inventario-modal";
    modal.hidden = true;

    modal.innerHTML = `

        <div
            class="inventario-ventana"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventarioTitulo"
        >

            <!-- ENCABEZADO -->

            <div class="inventario-encabezado">

                <div>

                    <h2 id="inventarioTitulo">
                        Gestión de inventario
                    </h2>

                    <p>
                        Administración de productos MercaGo
                    </p>

                </div>

                <button
                    class="secondary"
                    type="button"
                    onclick="cerrarInventario()"
                >
                    ✕ Cerrar
                </button>

            </div>

            <!-- INDICADORES -->

            <div class="inventario-indicadores">

                <div class="inventario-indicador">

                    <span>Productos activos</span>

                    <strong id="inventarioTotalProductos">
                        0
                    </strong>

                </div>

                <div class="inventario-indicador">

                    <span>Unidades activas</span>

                    <strong id="inventarioTotalUnidades">
                        0
                    </strong>

                </div>

                <div class="inventario-indicador">

                    <span>Inventario bajo</span>

                    <strong id="inventarioStockBajo">
                        0
                    </strong>

                </div>

                <div class="inventario-indicador">

                    <span>Agotados</span>

                    <strong id="inventarioAgotados">
                        0
                    </strong>

                </div>

            </div>

            <!-- ALERTA -->

            <div
                id="inventarioAlerta"
                class="notice"
                style="margin-bottom:20px"
                role="status"
            ></div>

            <!-- HERRAMIENTAS -->

            <div class="inventario-herramientas">

                <input
                    id="inventarioBuscar"
                    type="search"
                    placeholder="Buscar producto o categoría..."
                    aria-label="Buscar productos"
                >

                <select
                    id="inventarioFiltro"
                    aria-label="Filtrar inventario"
                >

                    <option value="todos">
                        Todos
                    </option>

                    <option value="disponibles">
                        Disponibles
                    </option>

                    <option value="bajo">
                        Inventario bajo
                    </option>

                    <option value="agotados">
                        Agotados
                    </option>

                    <option value="inactivos">
                        Inactivos
                    </option>

                </select>

                <!-- CREAR PRODUCTO -->

                <button
                    class="primary"
                    type="button"
                    onclick="abrirFormularioProducto()"
                >
                    + Nuevo producto
                </button>

                <!-- REPOSICIÓN -->

                <button
                    class="secondary"
                    type="button"
                    onclick="mostrarPendientesReposicion()"
                >
                    ⚠ Reposición
                </button>

                <!-- HISTORIAL DE INVENTARIO -->

                <button
                    class="secondary"
                    type="button"
                    onclick="abrirHistorialInventario()"
                >
                    📋 Historial
                </button>

                <!-- DASHBOARD DE INVENTARIO -->

                <button
                    class="secondary"
                    type="button"
                    onclick="abrirDashboardInventario()"
                >
                    📊 Dashboard
                </button>

                <!-- EXPORTACIÓN CSV -->

                <button
                    class="secondary"
                    type="button"
                    onclick="exportarInventarioCSV()"
                >
                    ↓ CSV
                </button>

                <!-- ACTUALIZAR -->

                <button
                    class="secondary"
                    type="button"
                    onclick="cargarInventario()"
                >
                    ↻ Actualizar
                </button>

            </div>

            <!-- TABLA DE INVENTARIO -->

            <div class="inventario-tabla-contenedor">

                <table class="inventario-tabla">

                    <thead>

                        <tr>
                            <th>ID</th>
                            <th>Producto</th>
                            <th>Categoría</th>
                            <th>Precio</th>
                            <th>Existencias</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>

                    </thead>

                    <tbody id="inventarioTablaBody">

                        <tr>
                            <td colspan="7">
                                Consultando inventario...
                            </td>
                        </tr>

                    </tbody>

                </table>

            </div>

            <p class="inventario-nota">

                Stock bajo: entre 1 y
                ${INVENTARIO_STOCK_MINIMO} unidades.

                Desactivar un producto lo oculta del
                catálogo, pero no elimina su historial.

                Los ajustes manuales de existencias
                quedan registrados en la auditoría.

            </p>

            <!-- ====================================
                 FORMULARIO CREAR / EDITAR PRODUCTO
            ==================================== -->

            <div
                id="inventarioFormularioContenedor"
                class="inventario-formulario-contenedor"
                hidden
            >

                <form
                    id="inventarioFormulario"
                    class="inventario-formulario"
                >

                    <div class="inventario-encabezado">

                        <h3 id="inventarioFormularioTitulo">
                            Nuevo producto
                        </h3>

                        <button
                            class="secondary"
                            type="button"
                            onclick="cerrarFormularioProducto()"
                        >
                            ✕
                        </button>

                    </div>

                    <input
                        id="productoEditarId"
                        type="hidden"
                    >

                    <div class="inventario-form-grid">

                        <!-- NOMBRE -->

                        <div class="form-group">

                            <label for="productoNombre">
                                Nombre
                            </label>

                            <input
                                id="productoNombre"
                                type="text"
                                maxlength="150"
                                required
                            >

                        </div>

                        <!-- CATEGORÍA -->

                        <div class="form-group">

                            <label for="productoCategoria">
                                Categoría
                            </label>

                            <select
                                id="productoCategoria"
                                required
                            ></select>

                        </div>

                        <!-- PRECIO -->

                        <div class="form-group">

                            <label for="productoPrecio">
                                Precio
                            </label>

                            <input
                                id="productoPrecio"
                                type="number"
                                min="0"
                                max="999999999"
                                step="0.01"
                                required
                            >

                        </div>

                        <!-- IMAGEN -->

                        <div class="form-group">

                            <label for="productoImagen">
                                Emoji o imagen
                            </label>

                            <input
                                id="productoImagen"
                                type="text"
                                maxlength="100"
                                placeholder="🛒"
                            >

                        </div>

                        <!-- EXISTENCIAS INICIALES -->

                        <div
                            class="form-group"
                            id="grupoStockInicial"
                        >

                            <label for="productoStock">
                                Existencias iniciales
                            </label>

                            <input
                                id="productoStock"
                                type="number"
                                min="0"
                                max="2147483647"
                                step="1"
                                value="0"
                                required
                            >

                        </div>

                    </div>

                    <!-- ERRORES -->

                    <p
                        id="inventarioFormularioError"
                        class="error-message"
                        role="alert"
                    ></p>

                    <!-- BOTONES -->

                    <div class="inventario-form-acciones">

                        <button
                            type="button"
                            class="secondary"
                            onclick="cerrarFormularioProducto()"
                        >
                            Cancelar
                        </button>

                        <button
                            id="inventarioGuardarBoton"
                            type="submit"
                            class="primary"
                        >
                            Guardar producto
                        </button>

                    </div>

                </form>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    // Cerrar al hacer clic fuera
    modal.addEventListener("click", evento => {

        if (evento.target === modal) {
            cerrarInventario();
        }

    });

    // Búsqueda
    document.getElementById("inventarioBuscar")
        .addEventListener("input", evento => {

            inventarioBusqueda = evento.target.value
                .trim()
                .toLowerCase();

            renderizarInventario();

        });

    // Filtros
    document.getElementById("inventarioFiltro")
        .addEventListener("change", evento => {

            inventarioFiltro = evento.target.value;

            renderizarInventario();

        });

    // Guardar formulario
    document.getElementById("inventarioFormulario")
        .addEventListener("submit", guardarProducto);
}

// ============================================
// ABRIR INVENTARIO
// ============================================

async function abrirInventario() {

    if (
        !currentUser ||
        currentUser.rol !== "ADMINISTRADOR"
    ) {

        toast("Acceso exclusivo para administradores");
        return;
    }

    try {

        await apiRequest("/auth/admin/verificar");

    } catch (error) {

        toast("No fue posible validar los permisos");
        return;
    }

    crearVentanaInventario();

    document.getElementById(
        "inventarioModal"
    ).hidden = false;

    document.body.classList.add(
        "inventario-bloqueo-scroll"
    );

    await cargarInventario();
}

// ============================================
// CERRAR INVENTARIO
// ============================================

function cerrarInventario() {

    const modal = document.getElementById(
        "inventarioModal"
    );

    if (modal) {
        modal.hidden = true;
    }

    cerrarFormularioProducto();

    document.body.classList.remove(
        "inventario-bloqueo-scroll"
    );
}

// ============================================
// CONSULTAR INVENTARIO
// ============================================

async function cargarInventario() {

    if (inventarioCargando) {
        return;
    }

    if (
        !currentUser ||
        currentUser.rol !== "ADMINISTRADOR"
    ) {

        cerrarInventario();
        return;
    }

    inventarioCargando = true;

    const tabla = document.getElementById(
        "inventarioTablaBody"
    );

    if (tabla) {

        tabla.innerHTML = `
            <tr>
                <td colspan="7">
                    Actualizando inventario...
                </td>
            </tr>
        `;
    }

    try {

        const [productos, categorias] =
            await Promise.all([

                apiRequest("/productos/admin"),

                apiRequest("/productos/categorias")

            ]);

        if (
            !Array.isArray(productos) ||
            !Array.isArray(categorias)
        ) {

            throw new Error(
                "La API devolvió información inválida."
            );
        }

        inventarioProductos = productos.map(p => ({

            id: Number(p.id),

            nombre: String(p.nombre ?? ""),

            idCategoria: Number(p.idCategoria),

            categoria: String(p.categoria ?? ""),

            precio: Number(p.precio),

            imagen: String(p.imagen ?? "🛒"),

            stock: Number(p.stock),

            activo:
                p.activo === true ||
                p.activo === 1

        }));

        inventarioCategorias = categorias;

        actualizarIndicadoresInventario();

        renderizarInventario();

    } catch (error) {

        console.error(
            "Error consultando inventario:",
            error
        );

        if (tabla) {

            tabla.innerHTML = `
                <tr>
                    <td colspan="7">
                        ${escapeHtml(error.message)}
                    </td>
                </tr>
            `;
        }

        toast("No se pudo consultar el inventario");

    } finally {

        inventarioCargando = false;
    }
}

// ============================================
// INDICADORES DEL INVENTARIO
// ============================================

function actualizarIndicadoresInventario() {

    const activos = inventarioProductos.filter(
        producto => producto.activo
    );

    const unidades = activos.reduce(
        (total, producto) => total + producto.stock,
        0
    );

    const bajos = activos.filter(
        producto =>
            producto.stock > 0 &&
            producto.stock <= INVENTARIO_STOCK_MINIMO
    ).length;

    const agotados = activos.filter(
        producto => producto.stock <= 0
    ).length;

    document.getElementById(
        "inventarioTotalProductos"
    ).textContent = activos.length;

    document.getElementById(
        "inventarioTotalUnidades"
    ).textContent = unidades;

    document.getElementById(
        "inventarioStockBajo"
    ).textContent = bajos;

    document.getElementById(
        "inventarioAgotados"
    ).textContent = agotados;

    const alerta = document.getElementById(
        "inventarioAlerta"
    );

    const pendientes = bajos + agotados;

    alerta.textContent = pendientes > 0

        ? `⚠ ${pendientes} productos activos ` +
          `requieren reposición. ` +
          `${agotados} agotados y ${bajos} con stock bajo.`

        : "✓ No hay alertas de inventario activo.";
}

// ============================================
// DETERMINAR ESTADO
// ============================================

function estadoInventario(producto) {

    if (!producto.activo) {

        return {
            texto: "Inactivo",
            clase: "inactivo"
        };
    }

    if (producto.stock <= 0) {

        return {
            texto: "Agotado",
            clase: "agotado"
        };
    }

    if (
        producto.stock <= INVENTARIO_STOCK_MINIMO
    ) {

        return {
            texto: "Stock bajo",
            clase: "bajo"
        };
    }

    return {
        texto: "Disponible",
        clase: "disponible"
    };
}

// ============================================
// FILTRAR INVENTARIO
// ============================================

function obtenerInventarioFiltrado() {

    return inventarioProductos

        .filter(producto => {

            const coincide =

                producto.nombre
                    .toLowerCase()
                    .includes(inventarioBusqueda)

                ||

                producto.categoria
                    .toLowerCase()
                    .includes(inventarioBusqueda);

            if (!coincide) {
                return false;
            }

            switch (inventarioFiltro) {

                case "disponibles":

                    return producto.activo &&
                        producto.stock >
                        INVENTARIO_STOCK_MINIMO;

                case "bajo":

                    return producto.activo &&
                        producto.stock > 0 &&
                        producto.stock <=
                        INVENTARIO_STOCK_MINIMO;

                case "agotados":

                    return producto.activo &&
                        producto.stock <= 0;

                case "inactivos":

                    return !producto.activo;

                default:

                    return true;
            }

        })

        .sort((a, b) =>
            a.nombre.localeCompare(b.nombre, "es")
        );
}

// ============================================
// MOSTRAR PRODUCTOS EN TABLA
// ============================================

function renderizarInventario() {

    const tabla = document.getElementById(
        "inventarioTablaBody"
    );

    if (!tabla) {
        return;
    }

    const lista = obtenerInventarioFiltrado();

    if (lista.length === 0) {

        tabla.innerHTML = `
            <tr>
                <td colspan="7">
                    No se encontraron productos.
                </td>
            </tr>
        `;

        return;
    }

    tabla.innerHTML = lista.map(producto => {

        const estado = estadoInventario(producto);

        return `

            <tr>

                <td>
                    ${producto.id}
                </td>

                <td>

                    <strong>
                        ${escapeHtml(producto.imagen)}
                        ${escapeHtml(producto.nombre)}
                    </strong>

                </td>

                <td>
                    ${escapeHtml(producto.categoria)}
                </td>

                <td>
                    ${money(producto.precio)}
                </td>

                <td>
                    ${producto.stock}
                </td>

                <td>

                    <span class="inventario-estado
                        ${estado.clase}">

                        ${estado.texto}

                    </span>

                </td>

                <td class="inventario-acciones">

                    <!-- EDITAR PRODUCTO -->

                    <button
                        type="button"
                        class="secondary"
                        onclick="abrirFormularioProducto(
                            ${producto.id}
                        )"
                    >
                        Editar
                    </button>

                    <!-- ACTUALIZAR STOCK -->

                    <button
                        type="button"
                        class="secondary"
                        onclick="modificarStockProducto(
                            ${producto.id}
                        )"
                    >
                        Stock
                    </button>

                    <!-- ACTIVAR / DESACTIVAR -->

                    <button
                        type="button"
                        class="secondary"
                        onclick="cambiarActivoProducto(
                            ${producto.id}
                        )"
                    >

                        ${
                            producto.activo
                                ? "Desactivar"
                                : "Activar"
                        }

                    </button>

                </td>

            </tr>

        `;

    }).join("");
}

// ============================================
// ABRIR FORMULARIO DE PRODUCTOS
// ============================================

function abrirFormularioProducto(id = null) {

    const producto = id === null

        ? null

        : inventarioProductos.find(
            p => p.id === id
        );

    if (id !== null && !producto) {

        toast("Producto no encontrado");
        return;
    }

    const form = document.getElementById(
        "inventarioFormulario"
    );

    form.reset();

    document.getElementById(
        "inventarioFormularioError"
    ).textContent = "";

    document.getElementById(
        "productoEditarId"
    ).value = producto ? producto.id : "";

    document.getElementById(
        "inventarioFormularioTitulo"
    ).textContent = producto

        ? "Editar producto"

        : "Nuevo producto";

    // CATEGORÍAS

    const selector = document.getElementById(
        "productoCategoria"
    );

    selector.innerHTML = `

        <option value="">
            Selecciona categoría
        </option>

        ${inventarioCategorias.map(categoria => `

            <option value="${Number(categoria.id)}">

                ${escapeHtml(categoria.nombre)}

            </option>

        `).join("")}

    `;

    // COMPLETAR CAMPOS

    document.getElementById(
        "productoNombre"
    ).value = producto?.nombre ?? "";

    document.getElementById(
        "productoCategoria"
    ).value = producto

        ? String(producto.idCategoria)

        : "";

    document.getElementById(
        "productoPrecio"
    ).value = producto?.precio ?? "";

    document.getElementById(
        "productoImagen"
    ).value = producto?.imagen ?? "🛒";

    document.getElementById(
        "productoStock"
    ).value = producto?.stock ?? 0;

    // EL STOCK SE EDITA EN UNA OPERACIÓN APARTE

    document.getElementById(
        "grupoStockInicial"
    ).hidden = !!producto;

    document.getElementById(
        "productoStock"
    ).disabled = !!producto;

    document.getElementById(
        "inventarioGuardarBoton"
    ).textContent = producto

        ? "Guardar cambios"

        : "Crear producto";

    const contenedor = document.getElementById(
        "inventarioFormularioContenedor"
    );

    contenedor.hidden = false;

    contenedor.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// ============================================
// CERRAR FORMULARIO
// ============================================

function cerrarFormularioProducto() {

    const contenedor = document.getElementById(
        "inventarioFormularioContenedor"
    );

    if (contenedor) {

        contenedor.hidden = true;
    }
}

// ============================================
// GUARDAR PRODUCTO
// ============================================

async function guardarProducto(evento) {

    evento.preventDefault();

    if (inventarioGuardando) {
        return;
    }

    if (
        !currentUser ||
        currentUser.rol !== "ADMINISTRADOR"
    ) {
        toast("No autorizado");
        return;
    }

    const idTexto = document.getElementById(
        "productoEditarId"
    ).value;

    const id = idTexto

        ? Number(idTexto)

        : null;

    const datos = {

        nombre: document.getElementById(
            "productoNombre"
        ).value.trim(),

        idCategoria: Number(
            document.getElementById(
                "productoCategoria"
            ).value
        ),

        precio: Number(
            document.getElementById(
                "productoPrecio"
            ).value
        ),

        imagen: document.getElementById(
            "productoImagen"
        ).value.trim() || "🛒"

    };

    if (id === null) {

        datos.stock = Number(
            document.getElementById(
                "productoStock"
            ).value
        );
    }

    const errorElemento = document.getElementById(
        "inventarioFormularioError"
    );

    const boton = document.getElementById(
        "inventarioGuardarBoton"
    );

    errorElemento.textContent = "";

    inventarioGuardando = true;
    boton.disabled = true;

    try {

        if (id === null) {

            // CREAR PRODUCTO

            await apiRequest("/productos", {

                method: "POST",

                body: JSON.stringify(datos)

            });

        } else {

            // EDITAR PRODUCTO

            await apiRequest(
                `/productos/${id}`,
                {
                    method: "PUT",

                    body: JSON.stringify(datos)
                }
            );
        }

        cerrarFormularioProducto();

        toast(

            id === null

                ? "Producto creado correctamente"

                : "Producto actualizado correctamente"

        );

        await cargarInventario();

        await cargarProductos();

    } catch (error) {

        console.error(
            "Error guardando producto:",
            error
        );

        errorElemento.textContent = error.message;

    } finally {

        inventarioGuardando = false;
        boton.disabled = false;
    }
}

// ============================================
// MODIFICAR EXISTENCIAS CON AUDITORÍA
// ============================================

async function modificarStockProducto(id) {

    if (
        !currentUser ||
        currentUser.rol !== "ADMINISTRADOR"
    ) {

        toast("No autorizado");
        return;
    }

    const producto = inventarioProductos.find(
        p => p.id === id
    );

    if (!producto) {

        toast("Producto no encontrado");
        return;
    }

    // ========================================
    // 1. SOLICITAR NUEVAS EXISTENCIAS
    // ========================================

    const valor = window.prompt(

        `Nuevas existencias para "${producto.nombre}":`,

        String(producto.stock)

    );

    if (valor === null) {
        return;
    }

    const stock = Number(valor);

    if (

        valor.trim() === "" ||

        !Number.isSafeInteger(stock) ||

        stock < 0 ||

        stock > 2147483647

    ) {

        toast("Ingresa una cantidad entera válida");
        return;
    }

    // ========================================
    // 2. VERIFICAR SI EXISTE UN CAMBIO
    // ========================================

    if (stock === producto.stock) {

        toast("Las existencias no cambiaron");
        return;
    }

    // ========================================
    // 3. SOLICITAR MOTIVO DEL AJUSTE
    // ========================================

    const motivo = window.prompt(

        "Motivo del ajuste de inventario:",

        "Reposición de existencias"

    );

    if (motivo === null) {
        return;
    }

    const motivoLimpio = motivo.trim();

    if (

        motivoLimpio.length === 0 ||

        motivoLimpio.length > 300

    ) {

        toast(
            "El motivo debe tener entre 1 y 300 caracteres"
        );

        return;
    }

    // ========================================
    // 4. CALCULAR DIFERENCIA
    // ========================================

    const diferencia = stock - producto.stock;

    const signo = diferencia > 0 ? "+" : "";

    // ========================================
    // 5. CONFIRMAR AJUSTE
    // ========================================

    const confirmado = window.confirm(

        `CONFIRMAR AJUSTE DE INVENTARIO\n\n` +

        `Producto: ${producto.nombre}\n` +

        `Stock anterior: ${producto.stock}\n` +

        `Stock nuevo: ${stock}\n` +

        `Diferencia: ${signo}${diferencia}\n` +

        `Motivo: ${motivoLimpio}\n\n` +

        "¿Deseas registrar este movimiento?"

    );

    if (!confirmado) {
        return;
    }

    // ========================================
    // 6. ENVIAR AJUSTE AL BACKEND
    // ========================================

    try {

        const resultado = await apiRequest(

            `/productos/${id}/stock`,

            {

                method: "PATCH",

                body: JSON.stringify({

                    stock,

                    motivo: motivoLimpio

                })

            }

        );

        toast(

            resultado.mensaje ||

            "Existencias actualizadas correctamente"

        );

        // ====================================
        // 7. ACTUALIZAR INVENTARIO
        // ====================================

        await cargarInventario();

        await cargarProductos();

    } catch (error) {

        console.error(

            "Error actualizando stock:",

            error

        );

        toast(error.message);
    }
}

// ============================================
// ACTIVAR / DESACTIVAR PRODUCTO
// ============================================

async function cambiarActivoProducto(id) {

    if (
        !currentUser ||
        currentUser.rol !== "ADMINISTRADOR"
    ) {

        toast("No autorizado");
        return;
    }

    const producto = inventarioProductos.find(
        p => p.id === id
    );

    if (!producto) {
        return;
    }

    const nuevoActivo = !producto.activo;

    const accion = nuevoActivo

        ? "activar"

        : "desactivar";

    const confirmado = window.confirm(

        `¿Deseas ${accion} "${producto.nombre}"?`

    );

    if (!confirmado) {
        return;
    }

    try {

        await apiRequest(
            `/productos/${id}/activo`,
            {

                method: "PATCH",

                body: JSON.stringify({

                    activo: nuevoActivo

                })

            }
        );

        toast(

            nuevoActivo

                ? "Producto activado"

                : "Producto desactivado"

        );

        await cargarInventario();

        await cargarProductos();

    } catch (error) {

        console.error(
            "Error cambiando estado de producto:",
            error
        );

        toast(error.message);
    }
}

// ============================================
// MOSTRAR PRODUCTOS PARA REPOSICIÓN
// ============================================

function mostrarPendientesReposicion() {

    inventarioBusqueda = "";

    inventarioFiltro = "bajo";

    document.getElementById(
        "inventarioBuscar"
    ).value = "";

    document.getElementById(
        "inventarioFiltro"
    ).value = "bajo";

    renderizarInventario();

    toast(
        "Mostrando productos con inventario bajo"
    );
}

// ============================================
// EXPORTAR INVENTARIO CSV
// ============================================

function exportarInventarioCSV() {

    if (
        !currentUser ||
        currentUser.rol !== "ADMINISTRADOR"
    ) {

        toast("No autorizado");
        return;
    }

    const lista = obtenerInventarioFiltrado();

    if (lista.length === 0) {

        toast("No hay productos para exportar");
        return;
    }

    // ========================================
    // EVITAR FÓRMULAS EN CSV
    // ========================================

    const csvSeguro = valor => {

        let texto = String(valor ?? "");

        if (/^\s*[=+\-@\t\r]/.test(texto)) {

            texto = "'" + texto;
        }

        return `"${texto.replace(/"/g, '""')}"`;
    };

    // ========================================
    // CREAR FILAS
    // ========================================

    const filas = [

        [

            "ID",
            "Producto",
            "Categoría",
            "Precio",
            "Stock",
            "Estado"

        ],

        ...lista.map(producto => [

            producto.id,

            producto.nombre,

            producto.categoria,

            producto.precio,

            producto.stock,

            estadoInventario(producto).texto

        ])

    ];

    // ========================================
    // CONVERTIR A CSV
    // ========================================

    const contenido = filas.map(

        fila => fila.map(csvSeguro).join(";")

    ).join("\r\n");

    // ========================================
    // GENERAR ARCHIVO
    // ========================================

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

        "MercaGo_Inventario_" +

        new Date().toISOString().slice(0, 10) +

        ".csv";

    document.body.appendChild(enlace);

    enlace.click();

    enlace.remove();

    setTimeout(() => {

        URL.revokeObjectURL(url);

    }, 1000);

    toast("Inventario exportado correctamente");
}

// ============================================
// CERRAR CON ESCAPE
// ============================================

document.addEventListener("keydown", evento => {

    if (evento.key === "Escape") {

        // Si el historial está abierto,
        // historialInventario.js controla el cierre.
        const historial = document.getElementById(
            "historialInventarioModal"
        );

        if (historial && !historial.hidden) {
            return;
        }

        // El dashboard administra su propio cierre.
        const dashboard = document.getElementById(
            "dashboardInventarioModal"
        );

        if (dashboard && !dashboard.hidden) {
            return;
        }

        cerrarFormularioProducto();

        cerrarInventario();
    }
});

// ============================================
// MÓDULO CARGADO
// ============================================

console.log(
    "MercaGo: inventario.js cargado correctamente"
);
