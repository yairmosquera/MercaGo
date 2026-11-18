
/**
 * MERCAGO - MÓDULO DE PRODUCTOS
 *
 * Responsabilidades:
 * - Consultar catálogo desde la API
 * - Mostrar productos
 * - Buscar productos
 * - Filtrar categorías
 */

// ============================================
// CONSULTAR PRODUCTOS
// ============================================

async function cargarProductos() {

    const grid = document.getElementById("productGrid");

    if (grid) {
        grid.innerHTML = "<p>Cargando productos...</p>";
    }

    try {

        const datos = await apiRequest("/productos");

        if (!Array.isArray(datos)) {
            throw new Error(
                "La API no devolvió una lista de productos"
            );
        }

        products = datos.map(p => ({
            id: Number(p.id),
            name: String(p.name ?? ""),
            cat: String(p.cat ?? ""),
            price: Number(p.price),
            emoji: String(p.emoji ?? "🛒"),
            stock: Number(p.stock ?? 0)
        }));

        renderProducts();

    } catch (error) {

        console.error("Error al cargar productos:", error);

        if (grid) {
            grid.innerHTML = `
                <p style="color:var(--danger)">
                    ${escapeHtml(error.message)}
                </p>
            `;
        }

        toast("No fue posible cargar los productos");
    }
}

// ============================================
// MOSTRAR CATÁLOGO
// ============================================

function renderProducts() {

    const grid = document.getElementById("productGrid");
    if (!grid) return;

    const buscar = document.getElementById("buscarProducto");

    const busqueda = (buscar?.value || "")
        .toLowerCase()
        .trim();

    const filtrados = products.filter(p => {

        const coincideTexto =
            p.name.toLowerCase().includes(busqueda) ||
            p.cat.toLowerCase().includes(busqueda);

        const coincideCategoria =
            !categoriaFiltro ||
            p.cat.toLowerCase().includes(
                categoriaFiltro.toLowerCase()
            );

        return coincideTexto && coincideCategoria;
    });

    if (filtrados.length === 0) {
        grid.innerHTML = `
            <div class="card">
                No se encontraron productos.
            </div>
        `;
        return;
    }

    grid.innerHTML = filtrados.map(p => `
        <article class="product">

            <div class="product-img">
                ${escapeHtml(p.emoji)}
            </div>

            <div class="meta">
                ${escapeHtml(p.cat)}
            </div>

            <h3>${escapeHtml(p.name)}</h3>

            <div class="price">
                ${money(p.price)}
            </div>

            <small style="color:var(--muted)">
                Disponibles: ${p.stock}
            </small>

            <button
                class="add"
                onclick="addToCart(${p.id})"
                ${p.stock <= 0 ? "disabled" : ""}
                title="Agregar al carrito"
            >
                +
            </button>

        </article>
    `).join("");
}

// ============================================
// FILTRAR POR CATEGORÍA
// ============================================

function filtrarCategoria(categoria) {

    categoriaFiltro = categoria;

    const elemento = document.getElementById(
        "categoriaActual"
    );

    if (elemento) {
        elemento.textContent = categoria;
    }

    go("catalog");
    renderProducts();
}

// ============================================
// LIMPIAR FILTROS
// ============================================

function limpiarFiltros() {

    categoriaFiltro = "";

    const buscar = document.getElementById("buscarProducto");
    const categoria = document.getElementById("categoriaActual");

    if (buscar) buscar.value = "";
    if (categoria) categoria.textContent = "";

    renderProducts();
}

// ============================================
// BUSCAR DESDE EL INICIO
// ============================================

function buscarDesdeInicio(texto) {

    categoriaFiltro = "";

    const categoria = document.getElementById("categoriaActual");
    const buscar = document.getElementById("buscarProducto");

    if (categoria) categoria.textContent = "";
    if (buscar) buscar.value = texto;

    go("catalog");
    renderProducts();
}

console.log("MercaGo: productos.js cargado");
