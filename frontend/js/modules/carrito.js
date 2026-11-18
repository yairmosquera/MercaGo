
/**
 * MERCAGO - MÓDULO DE CARRITO
 *
 * Responsabilidades:
 * - Agregar productos
 * - Modificar cantidades
 * - Validar existencias
 * - Calcular subtotal
 * - Mostrar resumen del carrito
 */

// ============================================
// AGREGAR PRODUCTOS
// ============================================

function addToCart(id) {

    const producto = products.find(p => p.id === id);

    if (!producto) {
        toast("Producto no encontrado");
        return;
    }

    const existente = cart.find(p => p.id === id);
    const cantidadActual = existente?.qty || 0;

    if (cantidadActual >= producto.stock) {
        toast("No hay suficientes existencias");
        return;
    }

    if (existente) {
        existente.qty++;
    } else {
        cart.push({
            ...producto,
            qty: 1
        });
    }

    updateCartCount();

    toast(producto.name + " agregado al carrito");
}

// ============================================
// CAMBIAR CANTIDAD
// ============================================

function changeQty(id, delta) {

    const item = cart.find(p => p.id === id);
    if (!item) return;

    const nuevaCantidad = item.qty + delta;
    const producto = products.find(p => p.id === id);

    if (
        delta > 0 &&
        producto &&
        nuevaCantidad > producto.stock
    ) {
        toast("No hay suficientes existencias");
        return;
    }

    if (nuevaCantidad <= 0) {
        cart = cart.filter(p => p.id !== id);
    } else {
        item.qty = nuevaCantidad;
    }

    updateCartCount();
    renderCart();
}

// ============================================
// ACTUALIZAR CONTADOR
// ============================================

function updateCartCount() {

    const cantidad = cart.reduce(
        (suma, item) => suma + item.qty,
        0
    );

    const contador = document.getElementById("cartCount");

    if (contador) {
        contador.textContent = cantidad;
    }
}

// ============================================
// CALCULAR SUBTOTAL
// ============================================

function calcularSubtotal() {

    return cart.reduce(
        (suma, item) => suma + item.price * item.qty,
        0
    );
}

// ============================================
// MOSTRAR CARRITO
// ============================================

function renderCart() {

    const box = document.getElementById("cartItems");
    if (!box) return;

    const cantidad = cart.reduce(
        (suma, item) => suma + item.qty,
        0
    );

    document.getElementById("cartSubtitle").textContent =
        cantidad + " productos agregados";

    if (cart.length === 0) {

        box.innerHTML = `
            <div style="text-align:center;padding:55px 0;color:var(--muted)">
                Tu carrito está vacío.

                <div style="margin-top:20px">
                    <button
                        class="primary"
                        onclick="go('catalog')"
                    >
                        Ir al catálogo
                    </button>
                </div>
            </div>
        `;

    } else {

        box.innerHTML = cart.map(item => `
            <div class="list-item">

                <div class="thumb">
                    ${escapeHtml(item.emoji)}
                </div>

                <div>
                    <b>${escapeHtml(item.name)}</b>

                    <p style="color:var(--muted)">
                        ${money(item.price)}
                    </p>

                    <strong>
                        ${money(item.price * item.qty)}
                    </strong>
                </div>

                <div class="qty">

                    <button onclick="changeQty(${item.id},-1)">
                        −
                    </button>

                    <span>${item.qty}</span>

                    <button onclick="changeQty(${item.id},1)">
                        +
                    </button>

                </div>
            </div>
        `).join("");
    }

    const subtotal = calcularSubtotal();
    const domicilio = cart.length ? COSTO_DOMICILIO : 0;

    document.getElementById("subtotal").textContent =
        money(subtotal);

    document.getElementById("cartDomicilio").textContent =
        money(domicilio);

    document.getElementById("total").textContent =
        money(subtotal + domicilio);
}

console.log("MercaGo: carrito.js cargado");
